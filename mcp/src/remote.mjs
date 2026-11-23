// Forewit remote MCP server: read only, stateless Streamable HTTP.
// Data: the site's published JSON (snapshot plus round files, joined by the site's own data layer) and read only
// eth_call reads of the pinned ledger. Third party text (market titles, labels, tags, profile names) is only ever
// returned inside fields whose names start with "untrusted_".
import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { joinRounds, liveRound, phase, leaderboard, crowdVsMarket, K, MIN_ROUNDS, MIN_BASELINE_QUESTIONS, BRIER_MAX } from '../vendor/web/data.mjs';
import { cleanText } from '../vendor/web/question.mjs';
import { loadRound, ethCall, SIG, decodeReveal, phaseOf } from '../vendor/agent/forewit.mjs';
import { encodeCall, wordUint, wordAddress, decodeWords, wordToBytes32 } from '../vendor/agent/lib/keccak.mjs';
import { NETWORKS, MIN_BPS, MAX_BPS, MAX_QUESTIONS, RISK_WARNING } from '../vendor/agent/config.mjs';
import { ok, guarded, paginate, cursorInput, address, roundId, VERSION } from './common.mjs';

const SCORING = JSON.parse(await readFile(new URL('../vendor/scoring.json', import.meta.url), 'utf8'));
export const DEFAULT_DATA = 'https://forewit.xyz/data/';
const DATA_TTL_MS = 60_000;
const CHAIN_TTL_MS = 30_000;
const MAX_JSON = 4 << 20;
const STATUS = { revealed: 1, scored: 2, forfeited: 4 };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

// Data loading

async function readJson(base, path) {
  if (!/^[a-z0-9_/]+\.json$/i.test(path) || path.includes('//')) throw new Error('published data lists an unexpected file path');
  let text;
  if (/^https:\/\//i.test(base)) {
    const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!res.ok) throw new Error(`published data ${path}: HTTP ${res.status}`);
    text = await res.text();
  } else {
    const file = resolve(base, path);
    if (!file.startsWith(resolve(base) + sep)) throw new Error('published data path escapes the data folder');
    text = await readFile(file, 'utf8');
  }
  if (text.length > MAX_JSON) throw new Error(`published data ${path} is too large`);
  return JSON.parse(text);
}

/** The pinned network whose chain id and ledger match the published snapshot; refuses anything else. */
export function pinnedNetwork(snapshot) {
  const net = Object.values(NETWORKS).find((n) => n.chainId === Number(snapshot?.network) && n.ledger &&
    n.ledger.toLowerCase() === String(snapshot?.ledger).toLowerCase());
  if (!net) throw new Error('published data does not match a pinned Forewit ledger; refusing to serve it');
  return net;
}

const dataCache = new Map();
export function loadDataset(base) {
  const hit = dataCache.get(base);
  if (hit && Date.now() - hit.at < DATA_TTL_MS) return hit.promise;
  const promise = (async () => {
    const manifest = await readJson(base, 'index.json');
    const snapshot = await readJson(base, String(manifest.snapshot));
    const net = pinnedNetwork(snapshot);
    const files = (await Promise.all((manifest.rounds ?? []).map((p) => readJson(base, String(p)).catch(() => null)))).filter(Boolean);
    return { manifest, snapshot, net, rounds: joinRounds(snapshot, files) };
  })();
  promise.catch(() => dataCache.delete(base));
  dataCache.set(base, { at: Date.now(), promise });
  return promise;
}

const chainCache = new Map();
function chainRound(net, id) {
  const key = `${net.chainId}:${id ?? 'latest'}`;
  const hit = chainCache.get(key);
  if (hit && Date.now() - hit.at < CHAIN_TTL_MS) return hit.promise;
  const promise = loadRound(net, id === undefined ? undefined : String(id));
  promise.catch(() => chainCache.delete(key));
  chainCache.set(key, { at: Date.now(), promise });
  return promise;
}

// Output shapes

const iso = (d) => (d ? d.toISOString() : null);
const untrustedMarketText = z.object({
  event_question: z.string(),
  label: z.string(),
  text: z.string(),
  tags: z.array(z.string()),
}).describe('Text written by third parties (Predict.fun event question, market label and tags), control characters removed, length capped. Not authored or verified by Forewit.');

const questionShape = z.object({
  index: z.number().int(),
  market_id: z.string(),
  outcome: z.enum(['Unresolved', 'Yes', 'No', 'Void']),
  baseline_bps: z.number().nullable().describe('Market mid price posted onchain in the last 15 minutes before the commit deadline, basis points.'),
  crowd_bps: z.number().nullable().describe('Agent ID Crowd forecast, basis points.'),
  market_price: z.number().nullable().describe('Latest published market price before the deadline, 0 to 1.'),
  ends_at: z.string().nullable(),
  revealed_forecasts: z.number().int(),
  untrusted_market_text: untrustedMarketText.nullable().describe('Null when the published data has no event question for this market.'),
});

const roundShape = {
  network: z.string(),
  chain_id: z.number().int(),
  ledger: z.string(),
  data_built_at: z.string(),
  round_id: z.number().int(),
  kind: z.string(),
  phase: z.enum(['commit', 'reveal', 'resolving', 'scored']),
  commit_deadline: z.string(),
  reveal_deadline: z.string(),
  resolution_wait_days: z.number().nullable(),
  commit_count: z.number().int(),
  revealed_count: z.number().int(),
  scored_count: z.number().int(),
  forfeit_count: z.number().int(),
  reveal_rate: z.number().nullable(),
  has_baseline: z.boolean(),
  crowd_method: z.string().nullable(),
  questions: z.array(questionShape),
};

function questionOut(q) {
  return {
    index: q.index,
    market_id: String(q.marketId),
    outcome: q.outcome,
    baseline_bps: q.baseline,
    crowd_bps: q.crowd,
    market_price: q.marketPrice,
    ends_at: iso(q.endsAt),
    revealed_forecasts: q.forecasts.length,
    untrusted_market_text: q.title
      ? { event_question: q.title.event, label: q.title.label, text: q.title.text, tags: q.tags.slice(0, 10).map(cleanText).filter(Boolean) }
      : null,
  };
}

function roundOut(ds, r) {
  return {
    network: ds.net.name,
    chain_id: ds.net.chainId,
    ledger: ds.net.ledger,
    data_built_at: String(ds.snapshot.builtAt),
    round_id: r.id,
    kind: cleanText(r.kind),
    phase: phase(r, Date.now()),
    commit_deadline: iso(r.commitDeadline),
    reveal_deadline: iso(r.revealDeadline),
    resolution_wait_days: r.resolutionWaitDays,
    commit_count: r.commitCount,
    revealed_count: r.revealedCount,
    scored_count: r.scoredCount,
    forfeit_count: r.forfeitCount,
    reveal_rate: r.revealRate,
    has_baseline: r.hasBaseline,
    crowd_method: r.crowdMethod,
    questions: r.questions.map(questionOut),
  };
}

const findRound = (ds, id) => {
  const r = ds.rounds.find((x) => x.id === id);
  if (!r) throw new Error(`round ${id} is not in the published data (latest published round: ${ds.rounds[0]?.id ?? 'none'})`);
  return r;
};

// Leaderboard: opt in public profiles only, operator wallets never listed.
function publicRows(snapshot) {
  const ops = new Set((snapshot.operators ?? []).map((a) => String(a).toLowerCase()));
  const lb = leaderboard(snapshot);
  const rows = lb.rows.filter((r) => !ops.has(r.addr));
  let rank = 0;
  return {
    forecasters: lb.forecasters,
    rows: rows.map((r) => ({
      rank: r.ranked ? ++rank : null,
      address: r.addr,
      ranked: r.ranked,
      rounds: r.rounds,
      rounds_committed: r.roundsCommitted,
      rounds_revealed: r.roundsRevealed,
      questions: r.questions,
      baseline_questions: r.baselineQuestions,
      mean_brier: r.meanBrier,
      shrunk_skill: r.shrunkSkill,
      participation: r.participation,
      calibration_error: r.calibrationError,
      post_baseline_flag: r.postBaselineFlag,
      untrusted_profile_name: r.name == null ? null : cleanText(r.name) || null,
    })),
  };
}

const rowShape = z.object({
  rank: z.number().int().nullable(),
  address: z.string(),
  ranked: z.boolean(),
  rounds: z.number().int(),
  rounds_committed: z.number().int(),
  rounds_revealed: z.number().int(),
  questions: z.number().int(),
  baseline_questions: z.number().int(),
  mean_brier: z.number().nullable(),
  shrunk_skill: z.number(),
  participation: z.number().nullable(),
  calibration_error: z.number().nullable(),
  post_baseline_flag: z.boolean(),
  untrusted_profile_name: z.string().nullable().describe('Agent ID name the forecaster chose for the public profile; third party text.'),
});

function flattenBlocks(blocks) {
  return blocks.flatMap((b) => (typeof b === 'string' ? [b] : b.h ? [b.h] : b.strong ? [b.strong] : b.list ?? b.ol ?? []));
}

/** One McpServer with the eight read only tools. `data` is an https base URL or a local folder of published JSON. */
export function createRemoteServer({ data = process.env.FOREWIT_DATA || DEFAULT_DATA } = {}) {
  const server = new McpServer({ name: 'forewit', version: VERSION, title: 'Forewit (read only)' });
  const tool = (name, config, fn) =>
    server.registerTool(name, { ...config, inputSchema: z.object(config.inputSchema ?? {}).strict(), outputSchema: z.object(config.outputSchema), annotations: { ...READ_ONLY, title: config.title } }, guarded(fn));
  const ds = () => loadDataset(data);

  tool('get_current_round', {
    title: 'Current round',
    description: 'The featured Forewit round: the one open for commits with the nearest deadline, else the one in its reveal window, else the newest. Includes every question with its baseline, crowd and outcome.',
    outputSchema: roundShape,
  }, async () => {
    const d = await ds();
    const r = liveRound(d.rounds, Date.now());
    if (!r) throw new Error('no rounds are published yet');
    return ok(roundOut(d, r));
  });

  tool('get_round', {
    title: 'Round by id',
    description: 'One Forewit round by id, with deadlines, counts and every question.',
    inputSchema: { round_id: roundId },
    outputSchema: roundShape,
  }, async ({ round_id }) => {
    const d = await ds();
    return ok(roundOut(d, findRound(d, round_id)));
  });

  tool('get_question', {
    title: 'Question',
    description: 'One question of a round: the parent event question and market label, baseline, crowd, market price and outcome. Fails when the published data has no event question for it.',
    inputSchema: { round_id: roundId, index: z.number().int().min(0).max(MAX_QUESTIONS - 1) },
    outputSchema: { round_id: z.number().int(), ...questionShape.shape, untrusted_market_text: untrustedMarketText },
  }, async ({ round_id, index }) => {
    const d = await ds();
    const q = findRound(d, round_id).questions[index];
    if (!q) throw new Error(`round ${round_id} has no question ${index}`);
    if (!q.title) throw new Error(`round ${round_id} question ${index} has no event question in the published data, so it is not presented`);
    return ok({ round_id, ...questionOut(q) });
  });

  tool('get_baseline', {
    title: 'Baseline',
    description: 'The market baseline of a round read from the ledger contract (eth_call), with a check against the published data.',
    inputSchema: { round_id: roundId },
    outputSchema: {
      network: z.string(), ledger: z.string(), round_id: z.number().int(), source: z.literal('chain'),
      baseline_set: z.boolean(), baseline_bps: z.array(z.number().int()).nullable(),
      published_data_agrees: z.boolean().nullable().describe('Null when the round is not in the published data yet.'),
    },
  }, async ({ round_id }) => {
    const d = await ds();
    const { round } = await chainRound(d.net, round_id);
    const n = round.questionCount;
    const bps = round.baselineSet ? Array.from({ length: n }, (_, i) => Number((round.baselinePacked >> BigInt(16 * i)) & 0xffffn)) : null;
    const pub = d.rounds.find((r) => r.id === round_id);
    const pubBps = pub ? (pub.hasBaseline ? pub.questions.map((q) => q.baseline) : null) : undefined;
    return ok({
      network: d.net.name, ledger: d.net.ledger, round_id, source: 'chain', baseline_set: round.baselineSet, baseline_bps: bps,
      published_data_agrees: pubBps === undefined ? null : JSON.stringify(pubBps) === JSON.stringify(bps),
    });
  });

  tool('get_crowd', {
    title: 'Agent ID Crowd versus market',
    description: 'Brier score of the Agent ID Crowd against the market baseline on resolved questions, overall and per round (newest first, paginated).',
    inputSchema: cursorInput,
    outputSchema: {
      overall: z.object({ crowd_brier: z.number().nullable(), market_brier: z.number().nullable(), questions: z.number().int() }),
      rounds: z.array(z.object({ round_id: z.number().int(), crowd_method: z.string().nullable(), crowd_bps: z.array(z.number().nullable()), crowd_brier: z.number().nullable(), market_brier: z.number().nullable(), questions: z.number().int() })),
      next_cursor: z.string().nullable(),
    },
  }, async (args) => {
    const d = await ds();
    const all = crowdVsMarket(d.rounds);
    const { page, next_cursor } = paginate(d.rounds, args);
    return ok({
      overall: { crowd_brier: all.crowd, market_brier: all.market, questions: all.n },
      rounds: page.map((r) => {
        const c = crowdVsMarket([r]);
        return { round_id: r.id, crowd_method: r.crowdMethod, crowd_bps: r.questions.map((q) => q.crowd), crowd_brier: c.crowd, market_brier: c.market, questions: c.n };
      }),
      next_cursor,
    });
  });

  tool('get_leaderboard', {
    title: 'Leaderboard',
    description: 'Forecasters who opted in to a public profile, ranked by shrunk skill against the market. Operator wallets are never listed. Paginated.',
    inputSchema: cursorInput,
    outputSchema: {
      forecasters: z.number().int().describe('All forecasters with any activity, public or not.'),
      public_count: z.number().int(),
      rows: z.array(rowShape),
      next_cursor: z.string().nullable(),
    },
  }, async (args) => {
    const d = await ds();
    const { forecasters, rows } = publicRows(d.snapshot);
    const { page, next_cursor } = paginate(rows, args);
    return ok({ forecasters, public_count: rows.length, rows: page, next_cursor });
  });

  tool('get_my_status', {
    title: 'Status of a wallet',
    description: 'For one wallet address: commit and reveal status in the latest round read from the ledger, per round history from the published data (newest first, paginated), and the leaderboard row when the profile is public.',
    inputSchema: { address, ...cursorInput },
    outputSchema: {
      address: z.string(),
      current: z.object({
        round_id: z.number().int(), phase: z.enum(['commit open', 'reveal open', 'closed']),
        committed: z.boolean(), commit_hash: z.string().nullable(), revealed: z.boolean(), scored: z.boolean(), forfeited: z.boolean(),
      }),
      history: z.array(z.object({
        round_id: z.number().int(), committed: z.boolean(), revealed: z.boolean(), result: z.enum(['scored', 'forfeited', 'pending']),
        questions: z.number().int().nullable(), brier: z.number().nullable(), skill: z.number().nullable(),
      })),
      leaderboard: rowShape.nullable(),
      next_cursor: z.string().nullable(),
    },
  }, async ({ address: addr, ...page }) => {
    const d = await ds();
    const a = addr.toLowerCase();
    const { id, now, round } = await chainRound(d.net);
    const [c] = decodeWords(await ethCall(d.net, encodeCall(SIG.getCommit, [wordUint(id), wordAddress(addr)])));
    const { status } = decodeReveal(await ethCall(d.net, encodeCall(SIG.getReveal, [wordUint(id), wordAddress(addr)])));
    const mine = d.snapshot.rounds
      .filter((r) => r.committers.some((x) => x.toLowerCase() === a))
      .sort((x, y) => Number(y.roundId) - Number(x.roundId))
      .map((r) => {
        const s = Object.entries(r.scored).find(([k]) => k.toLowerCase() === a)?.[1];
        const f = Object.entries(r.forfeited).find(([k]) => k.toLowerCase() === a)?.[1];
        const sums = s ?? f;
        return {
          round_id: Number(r.roundId),
          committed: true,
          revealed: r.revealed.some((x) => x.toLowerCase() === a),
          result: s ? 'scored' : f ? 'forfeited' : 'pending',
          questions: sums ? Number(sums.questions) : null,
          brier: sums ? Number(sums.brier) / Number(sums.questions || 1) / BRIER_MAX : null,
          skill: sums ? Number(sums.skill) / Number(sums.questions || 1) / BRIER_MAX : null,
        };
      });
    const { page: history, next_cursor } = paginate(mine, page);
    return ok({
      address: a,
      current: {
        round_id: id, phase: phaseOf(round, now), committed: c !== 0n, commit_hash: c === 0n ? null : wordToBytes32(c),
        revealed: !!(status & STATUS.revealed), scored: !!(status & STATUS.scored), forfeited: !!(status & STATUS.forfeited),
      },
      history,
      leaderboard: publicRows(d.snapshot).rows.find((r) => r.address === a) ?? null,
      next_cursor,
    });
  });

  tool('explain_scoring', {
    title: 'Scoring rules',
    description: 'How Forewit scores forecasts (Brier, baseline, skill, forfeits, leaderboard rank) and the constants used, in English or Simplified Chinese.',
    inputSchema: { lang: z.enum(['en', 'zh']).optional().describe('Language, default en.') },
    outputSchema: {
      lang: z.enum(['en', 'zh']),
      title: z.string(),
      rules: z.array(z.string()),
      constants: z.object({
        brier_max: z.number(), shrink_k: z.number(), min_rounds_ranked: z.number(), min_baseline_questions_ranked: z.number(),
        min_bps: z.number(), max_bps: z.number(), max_questions: z.number(),
      }),
      risk_warning: z.string(),
    },
  }, async ({ lang = 'en' }) => ok({
    lang,
    title: SCORING[lang].title,
    rules: flattenBlocks(SCORING[lang].blocks),
    constants: { brier_max: BRIER_MAX, shrink_k: K, min_rounds_ranked: MIN_ROUNDS, min_baseline_questions_ranked: MIN_BASELINE_QUESTIONS, min_bps: MIN_BPS, max_bps: MAX_BPS, max_questions: MAX_QUESTIONS },
    risk_warning: RISK_WARNING,
  }));

  return server;
}

// HTTP

const DEFAULT_ORIGINS = ['https://forewit.xyz', 'https://www.forewit.xyz'];

/**
 * Starts the stateless Streamable HTTP endpoint at POST /mcp. One McpServer and transport per request.
 * Origin: requests without an Origin header (non browser clients) pass; any Origin must be on the allowlist.
 */
export function startHttp({
  port = Number(process.env.PORT) || 8787,
  host = process.env.HOST || '127.0.0.1',
  allowedOrigins = process.env.FOREWIT_ALLOWED_ORIGINS ? process.env.FOREWIT_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS,
  rateLimit = Number(process.env.FOREWIT_RATE_LIMIT) || 60,
  windowMs = 60_000,
  maxBody = 64 * 1024,
  data,
} = {}) {
  const origins = new Set(allowedOrigins);
  // shortcut: in memory fixed window per socket address; behind a proxy every client shares one address, move limits to the proxy then.
  const hits = new Map();
  const limited = (ip) => {
    const now = Date.now();
    if (hits.size > 10_000) hits.clear();
    const h = hits.get(ip);
    if (!h || now - h.start >= windowMs) { hits.set(ip, { start: now, n: 1 }); return false; }
    return ++h.n > rateLimit;
  };
  const reject = (res, code, message) => {
    if (!res.headersSent) res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
  };

  const http = createHttpServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (path !== '/mcp') return reject(res, 404, 'not found; the endpoint is POST /mcp');
      const origin = req.headers.origin;
      if (origin !== undefined && !origins.has(origin)) return reject(res, 403, 'origin not allowed');
      if (origin) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type, accept, mcp-protocol-version', 'access-control-max-age': '600' });
        return res.end();
      }
      if (limited(req.socket.remoteAddress ?? 'unknown')) {
        res.setHeader('retry-after', String(Math.ceil(windowMs / 1000)));
        return reject(res, 429, 'rate limit exceeded');
      }
      if (req.method !== 'POST') {
        res.setHeader('allow', 'POST, OPTIONS');
        return reject(res, 405, 'method not allowed; this server is stateless and accepts POST only');
      }
      if (Number(req.headers['content-length'] ?? 0) > maxBody) return reject(res, 413, 'request body too large');
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBody) return reject(res, 413, 'request body too large');
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reject(res, 400, 'parse error: body is not JSON');
      }
      const mcp = createRemoteServer({ data });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => { transport.close(); mcp.close(); });
      res.setHeader('cache-control', 'no-store');
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('forewit mcp remote:', err instanceof Error ? err.message : err);
      reject(res, 500, 'internal error');
    }
  });
  return new Promise((ok, no) => {
    http.once('error', no);
    http.listen(port, host, () => ok(http));
  });
}
