// Forewit keeper (milestone 2). One command per duty in docs/KEEPER.md.
// Run from the repo root: node --env-file=.env keeper/keeper.mjs <command> --network testnet|mainnet [options]
//   select    --commit-deadline <iso> [--kind daily|long]   apply docs/QUESTION_SELECTION.md v3, archive raw API data and output
//   open      --selection <file> [--resolution-days 7] [--reveal-hours 24]   createRound only (no baseline yet)
//   baseline  [--round <id>]                         snapshot books and setBaseline in clear; only in the last 15 minutes before the deadline
//   seal      [--round <id>]                         sealRound right after the deadline (alerts if no baseline was set)
//   finalize  --round <id>                           finalize every question resolved onchain; voidStale when allowed
//   score     --round <id>                           scoreBatch and forfeitBatch over every committer (from logs)
//   scores                                           post the ForewitScores root of the newest settled round (two provider check)
//   night     [--round <id>]                         wait for the baseline window, baseline, then seal (one job for GitHub Actions)
//   status    --round <id>
// Mainnet writes refuse to run unless LEDGER_MAINNET is set and KEEPER_CONFIRM_MAINNET=yes (Owais's per action yes).
// Keys never print. Baseline salts are stored with agent/lib/secure_file.mjs before any commit transaction.
import { tickIds } from './lib/cursor.mjs';
import { createPublicClient, createWalletClient, http, fallback, keccak256, toHex, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { takeBaseline } from './lib/baseline.mjs';
import * as sel from './lib/selection.mjs';

const args = Object.fromEntries(process.argv.slice(3).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? 'true' : arr[i + 1]]] : a), []));
const cmd = process.argv[2];
const NET = {
  testnet: { chain: bscTestnet, rpc: process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com', ledger: process.env.LEDGER_TESTNET, api: 'https://api-testnet.predict.fun', ctfs: { std: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743', yb: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f', ybnr: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5' } },
  mainnet: { chain: bsc, rpc: process.env.RPC_MAINNET_PRIMARY || process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com', rpc2: process.env.RPC_MAINNET_FALLBACK, ledger: process.env.LEDGER_MAINNET, api: 'https://api.predict.fun', ctfs: { std: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', yb: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', ybnr: '0xF64b0b318AAf83BD9071110af24D24445719A07F' } },
}[args.network || 'testnet'];
if (!NET) throw new Error('--network must be testnet or mainnet');
const isMainnet = NET.chain.id === 56;
// Rule v3.2 machinery (topic rounds, committers index, unsettled tick, multi round night). Off means the v3.1 keeper exactly.
const V32 = process.env.TOPIC_ROUNDS === 'on';
const num = (v, d) => { // unset GitHub variables arrive as ''
  if (v === undefined || v === '') return d;
  if (!/^\d+$/.test(String(v))) throw new Error(`bad number ${JSON.stringify(v)} in a TOPIC_ cap variable`);
  return Number(v);
};
// RPC endpoints in order: primary, keyed fallback (mainnet), publicnode last (the baseline has a 15 minute window)
const SECOND_RPC = isMainnet ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com';
const transport = (first) => fallback([...new Set([first, NET.rpc2, SECOND_RPC].filter(Boolean))].map((u) => http(u)));
const pub = createPublicClient({ chain: NET.chain, transport: transport(NET.rpc) });
// event logs need an RPC that serves eth_getLogs ranges (the bnbchain dataseed endpoints refuse them); override with LOGS_RPC_URL
const logsPub = createPublicClient({ chain: NET.chain, transport: transport(process.env.LOGS_RPC_URL || SECOND_RPC) });
// committed ABI so the keeper host needs no Foundry; CI fails if it drifts from contracts/out
const ABI = JSON.parse(readFileSync(process.env.KEEPER_ABI || 'keeper/abi/ForecastLedger_v1_2.json', 'utf8'));
const CTF_ABI = [parseAbiItem('function getOutcomeSlotCount(bytes32) view returns (uint256)'), parseAbiItem('function payoutDenominator(bytes32) view returns (uint256)')];
const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function alert(msg) {
  log('ALERT', msg);
  const { TELEGRAM_BOT_TOKEN: tg, TELEGRAM_CHAT_ID: chat } = process.env;
  if (tg && chat) await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: `Forewit keeper (${args.network || 'testnet'}): ${msg}` }) }).catch(() => log('telegram alert failed'));
  // GitHub issue comment: GitHub emails the repository owner (set ALERT_ISSUE_NUMBER; the workflow passes GITHUB_TOKEN)
  const { ALERT_ISSUE_NUMBER: issue, GITHUB_TOKEN: gh, GITHUB_REPOSITORY: repo } = process.env;
  if (issue && gh && repo) await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments`, { method: 'POST', headers: { authorization: `Bearer ${gh}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ body: `Keeper (${args.network || 'testnet'}): ${msg}` }) }).catch(() => log('issue alert failed'));
  if (process.env.ALERT_WEBHOOK_URL) await fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `Forewit keeper: ${msg}` }) }).catch(() => log('alert webhook failed'));
}

function keeperAccount() {
  if (isMainnet && process.env.KEEPER_CONFIRM_MAINNET !== 'yes') throw new Error('mainnet write refused: set KEEPER_CONFIRM_MAINNET=yes only after Owais says yes');
  const k = isMainnet ? process.env.MAINNET_KEEPER_PRIVATE_KEY : process.env.KEEPER_PRIVATE_KEY;
  if (!k) throw new Error('keeper key missing');
  return privateKeyToAccount(k);
}

// testnet instances A to D keep the pre rename labels; commits from the current CLI would not verify there
const DEPRECATED_TESTNET = ['0x73fffb21a497d173f1c3581467ca1f7385655fc3', '0xb27e432b871bdae0f558b0f1b4c87d5acb2ed80d', '0x03274897ddb1121ebdf1adf3b84e16d94a4c54be', '0xfbba24635ebfaaecd57fc199e4bc217c86fa80bf'];

async function ledger() {
  if (!NET.ledger) throw new Error(`ledger address missing: set LEDGER_${isMainnet ? 'MAINNET' : 'TESTNET'}`);
  if (DEPRECATED_TESTNET.includes(NET.ledger.toLowerCase())) throw new Error('LEDGER_TESTNET is a deprecated instance (A to D, old labels); use instance E');
  if ((await pub.getChainId()) !== NET.chain.id) throw new Error('RPC chain id mismatch; refusing');
  return NET.ledger;
}
const read = async (fn, a = []) => pub.readContract({ address: await ledger(), abi: ABI, functionName: fn, args: a });

/** Simulate, send, wait; retry up to `tries` with backoff; never resend after a mined revert. */
async function send(fn, a, { tries = 4, address, abi = ABI, until = Infinity } = {}) {
  const account = keeperAccount();
  const w = createWalletClient({ account, chain: NET.chain, transport: transport() });
  for (let i = 1; ; i++) {
    try {
      const { request } = await pub.simulateContract({ account, address: address ?? (await ledger()), abi, functionName: fn, args: a });
      const hash = await w.writeContract(request);
      const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (rc.status !== 'success') throw Object.assign(new Error(`${fn} reverted ${hash}`), { mined: true });
      log(fn, hash, 'gas', rc.gasUsed);
      return rc;
    } catch (e) {
      const msg = (e.shortMessage || e.message).split('\n')[0];
      if (e.mined || i >= tries || /revert/i.test(msg) || Date.now() + 5000 * 2 ** i > until) { await alert(`${fn} failed (attempt ${i}): ${msg}`); throw e; }
      log(`${fn} attempt ${i} failed: ${msg}; retrying`);
      await new Promise((r) => setTimeout(r, 5000 * 2 ** i));
    }
  }
}

function ctfFor(m) {
  if (!m.isYieldBearing) return NET.ctfs.std;
  return m.isNegRisk ? NET.ctfs.ybnr : NET.ctfs.yb;
}
async function apiGet(p) {
  // v3.2: a stalled request fails after 20 s, so one slow order book cannot eat the baseline window of the rounds after it
  const r = await fetch(NET.api + p, { headers: isMainnet ? { 'x-api-key': process.env.PREDICT_API_KEY } : {}, ...(V32 && { signal: AbortSignal.timeout(20_000) }) });
  if (!r.ok) throw new Error(`API ${p.split('?')[0]} HTTP ${r.status}`);
  return r.json();
}

async function select() {
  const cd = Date.parse(args['commit-deadline']);
  if (!cd) throw new Error('--commit-deadline <iso> required');
  const kind = args.kind || 'daily';
  if (!['daily', 'long'].includes(kind)) throw new Error('--kind daily|long');
  const raw = [];
  let cur = '';
  for (let i = 0; i < 200; i++) {
    const j = await apiGet('/v1/markets?status=OPEN&first=100&includeStats=true' + (cur ? '&after=' + cur : ''));
    raw.push(...j.data);
    cur = j.cursor;
    if (!cur) break;
  }
  // categories hold the only end time; fetch them only for markets passing the cheap filters (250 requests per minute)
  const cats = {};
  for (const slug of new Set(raw.filter((m) => sel.prefilter(m, kind)).map((m) => m.categorySlug))) cats[slug] = (await apiGet('/v1/categories/' + slug)).data;
  const asked = V32 ? askedSet() : new Set(); // rule v3.2: a market is asked in one round only
  const picks = raw
    .filter((m) => sel.eligible(m, cats[m.categorySlug], cd, kind) && !asked.has(String(m.id)))
    .map((m) => ({ marketId: m.id, conditionId: m.conditionId, ctf: ctfFor(m), category: m.categorySlug, endsAt: cats[m.categorySlug].endsAt, eventQuestion: cats[m.categorySlug].title, label: m.title, marketQuestion: m.question, tags: (cats[m.categorySlug].tags ?? []).map((t) => t.name), title: m.title, dailyCrypto: sel.isDailyCrypto(m), vol24h: m.stats?.volume24hUsd ?? 0 }));
  // one market per event; daily crypto first, then the most traded; then chain checks (2 slots, unresolved)
  picks.sort((x, y) => (y.dailyCrypto - x.dailyCrypto) || (y.vol24h - x.vol24h));
  const chosen = [], seen = new Set();
  for (const p of picks) {
    if (chosen.length >= sel.MAX_ROUND || seen.has(p.category)) continue;
    const [slots, den] = await Promise.all(CTF_ABI.map((fn) => pub.readContract({ address: p.ctf, abi: [fn], functionName: fn.name, args: [p.conditionId] })));
    if (slots !== 2n || den !== 0n) continue;
    seen.add(p.category);
    chosen.push(p);
  }
  const dir = `keeper/archive/${args.network || 'testnet'}/${new Date().toISOString().slice(0, 10)}_${kind}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/markets_raw.json`, JSON.stringify({ fetchedAt: new Date().toISOString(), markets: raw, categories: cats }));
  const out = { rule: sel.RULE, kind, commitDeadline: new Date(cd).toISOString(), resolutionDays: kind === 'long' ? 120 : 7, eligible: picks.length, chosen, funnel: sel.funnel(raw, cats, cd, kind, chosen.length) };
  writeFileSync(`${dir}/selection.json`, JSON.stringify(out, null, 2));
  log(`selection (${kind}): ${picks.length} eligible, ${chosen.length} chosen; archived in ${dir}`);
  if (chosen.length < sel.MIN_ROUND) await alert(`only ${chosen.length} questions pass rule v3.1 for a ${kind} round (minimum ${sel.MIN_ROUND})`);
  return out;
}

const sel_days = (file) => JSON.parse(readFileSync(file, 'utf8')).resolutionDays || 7;

async function open() {
  const sel = JSON.parse(readFileSync(args.selection, 'utf8'));
  const cd = BigInt(Math.floor(Date.parse(sel.commitDeadline) / 1000));
  const rd = cd + BigInt(Math.round(Number(args['reveal-hours'] || 24) * 3600));
  const wait = BigInt(Math.round(Number(args['resolution-days'] || sel_days(args.selection)) * 86400));
  const qs = sel.chosen.map((c) => ({ conditionId: c.conditionId, ctf: c.ctf, yesSlot: 0, marketId: BigInt(c.marketId) }));
  // public round file (data contract for the CLI and site): every question carries its parent event question and label.
  // Validated before createRound, so a bad question never leaves an onchain round without its public file.
  const { presentQuestion } = await import('../agent/lib/question.mjs');
  const questions = sel.chosen.map((c, i) => ({ index: i, marketId: String(c.marketId), conditionId: c.conditionId, ctf: c.ctf, eventQuestion: c.eventQuestion, label: c.label, marketQuestion: c.marketQuestion ?? null, endsAt: c.endsAt ?? null, tags: c.tags ?? [] }));
  questions.forEach((q) => presentQuestion(q)); // refuse to publish a question without its event question
  const before = await read('roundCount');
  await send('createRound', [qs, cd, rd, wait]);
  const roundId = before + 1n;
  mkdirSync('keeper/state', { recursive: true });
  writeFileSync(`keeper/state/round_${NET.chain.id}_${roundId}.json`, JSON.stringify({ roundId, commitDeadline: sel.commitDeadline, marketIds: sel.chosen.map((c) => c.marketId) }, big, 2));
  const pubDir = `keeper/archive/${args.network || 'testnet'}/rounds`;
  mkdirSync(pubDir, { recursive: true });
  writeFileSync(`${pubDir}/${roundId}.json`, JSON.stringify({ network: NET.chain.id, ledger: NET.ledger, roundId, kind: sel.kind ?? 'daily', board: sel.board ?? 'scored', featured: sel.featured ?? (sel.kind ?? 'daily') === 'daily', topic: sel.topic ?? null, horizon: sel.horizon ?? null, optional: sel.optional ?? false, funnel: sel.funnel ?? null, rule: sel.rule, commitDeadline: sel.commitDeadline, revealDeadline: new Date(Number(rd) * 1000).toISOString(), resolutionWaitSeconds: wait, questions }, big, 2));
  log(`round ${roundId} open; run "baseline --round ${roundId}" in the last 15 minutes before ${sel.commitDeadline} (target 5)`);
}

/** Markets already asked: the asked registry plus every market of every round ever opened (Featured rounds included). */
function askedSet() {
  const askedFile = `keeper/state/asked_${NET.chain.id}.json`;
  const asked = new Set(existsSync(askedFile) ? JSON.parse(readFileSync(askedFile, 'utf8')).map(String) : []);
  for (const f of (existsSync('keeper/state') ? readdirSync('keeper/state') : []).filter((f) => f.startsWith(`round_${NET.chain.id}_`) && f.endsWith('.json'))) {
    for (const id of JSON.parse(readFileSync(`keeper/state/${f}`, 'utf8')).marketIds ?? []) asked.add(String(id));
  }
  return asked;
}

/** Board of a round from its public round file: 'open' rounds get no baseline (rule v3.2); default 'scored'. */
function boardOf(r) {
  const f = `keeper/archive/${args.network || 'testnet'}/rounds/${r}.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).board ?? 'scored' : 'scored';
}

async function baseline(rIn, { until = Infinity } = {}) {
  const r = rIn ?? (await roundArg());
  if (boardOf(r) === 'open') return log(`round ${r}: open board, no baseline by rule v3.2`);
  const round = await read('getRound', [r]);
  if (round.baselineSet) return log(`round ${r}: baseline already set`);
  const deadlineMs = Number(round.commitDeadline) * 1000;
  const meta = JSON.parse(readFileSync(`keeper/state/round_${NET.chain.id}_${r}.json`, 'utf8'));
  const snap = await takeBaseline({ deadlineMs, marketIds: meta.marketIds, fetchBook: async (id) => (await apiGet(`/v1/markets/${id}/orderbook`)).data });
  for (const bk of snap.books) if (bk.source !== 'mid') await alert(`round ${r} market ${bk.marketId}: baseline from ${bk.source}, not a two sided mid`);
  const dir = `keeper/archive/${args.network || 'testnet'}/round_${r}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/baseline_books.json`, JSON.stringify(snap.books, big, 2)); // public archive of the raw books
  // posted in clear (ledger v1.2): retries stay inside the 15 minute window; the contract refuses anything later
  await send('setBaseline', [r, snap.packed], { tries: 5, until });
  log(`round ${r} baseline set ${Math.round((deadlineMs - Date.now()) / 1000)} s before the deadline`);
}

async function seal(rIn) {
  const r = rIn ?? (await roundArg());
  const round = await read('getRound', [r]);
  if (BigInt(Math.floor(Date.now() / 1000)) < round.commitDeadline) throw new Error('commit window still open');
  if (!round.isSealed) await send('sealRound', [r]);
  // market at the deadline, to measure the move inside the baseline posting window (pre registered 23 Nov 2026)
  const metaFile = `keeper/state/round_${NET.chain.id}_${r}.json`;
  const dir = `keeper/archive/${args.network || 'testnet'}/round_${r}`;
  if (existsSync(metaFile) && !existsSync(`${dir}/deadline_books.json`) && Date.now() - Number(round.commitDeadline) * 1000 < 5 * 60 * 1000) {
    const { midBps } = await import('./lib/baseline.mjs');
    const books = [];
    for (const id of JSON.parse(readFileSync(metaFile, 'utf8')).marketIds) {
      const b = (await apiGet(`/v1/markets/${id}/orderbook`).catch(() => null))?.data;
      books.push({ marketId: String(id), ...(b ? midBps(b) : null), takenAt: Date.now() });
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/deadline_books.json`, JSON.stringify(books, big, 2));
  }
  if (!round.baselineSet && boardOf(r) !== 'open') await alert(`round ${r}: no baseline was set before the deadline; the round scores with skill 0`);
  log(`round ${r} sealed`);
}

async function finalize(rIn) {
  const r = rIn ?? (await roundArg());
  const round = await read('getRound', [r]);
  const qs = await read('getQuestions', [r]);
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let i = 0; i < qs.length; i++) {
    if ((round.resolvedMask >> i) & 1) continue;
    const den = await pub.readContract({ address: qs[i].ctf, abi: [CTF_ABI[1]], functionName: 'payoutDenominator', args: [qs[i].conditionId] });
    if (den > 0n) await send('finalizeQuestion', [r, BigInt(i)]);
    else if (now > round.revealDeadline + round.resolutionWait) {
      const meta = existsSync(`keeper/state/round_${NET.chain.id}_${r}.json`) ? JSON.parse(readFileSync(`keeper/state/round_${NET.chain.id}_${r}.json`, 'utf8')) : null;
      const status = meta ? (await apiGet(`/v1/markets/${meta.marketIds[i]}`).catch(() => null))?.data?.status : null;
      if (['PRICE_PROPOSED', 'PRICE_DISPUTED'].includes(status)) { log(`round ${r} q${i}: resolution pending (${status}); not voiding`); continue; }
      // fail closed: an unknown status (API down, no state file) never voids for 7 more days, so a pending resolution survives an outage
      if (!status && now <= round.revealDeadline + round.resolutionWait + 7n * 86400n) { await alert(`round ${r} q${i}: market status unknown; not voiding yet`); continue; }
      await send('voidStale', [r, BigInt(i)]);
    }
  }
}

async function roundArg() {
  return args.round === undefined || args.round === 'latest' ? await read('roundCount') : BigInt(args.round);
}

let committersIndex = null;
const CONFIRMATIONS = 15n; // about 7 s of BSC blocks
const OVERLAP = 2000n; // blocks rescanned each run; duplicates are skipped
/** Committers of round r from keeper/state/committers_<chain>.json, extended forward from its last block. Without
 *  INDEXER_FROM_BLOCK_<NET> and no index file it falls back to the old walk back scan. */
async function committers(r) {
  const fb = process.env[`INDEXER_FROM_BLOCK_${isMainnet ? 'MAINNET' : 'TESTNET'}`];
  const file = `keeper/state/committers_${NET.chain.id}.json`;
  if (!V32 || (!fb && !existsSync(file))) return committersScan(r);
  if (!committersIndex) {
    const idx = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { lastBlock: String(BigInt(fb) - 1n), byRound: {} };
    const ev = ABI.find((x) => x.type === 'event' && x.name === 'Committed');
    // index only confirmed blocks and rescan an overlap each run, so one empty read near the tip cannot lose a commit
    const head = (await logsPub.getBlockNumber()) - CONFIRMATIONS;
    let span = 5000n;
    const start = BigInt(idx.lastBlock) + 1n - OVERLAP;
    for (let from = start > BigInt(fb ?? 0) ? start : BigInt(fb ?? 0); from <= head; ) {
      const to = from + span - 1n > head ? head : from + span - 1n;
      let logs;
      try {
        logs = await logsPub.getLogs({ address: await ledger(), event: ev, fromBlock: from, toBlock: to });
      } catch (e) {
        if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
        throw e;
      }
      for (const l of logs) {
        const list = (idx.byRound[String(l.args.roundId)] ||= []);
        if (!list.includes(l.args.forecaster)) list.push(l.args.forecaster);
      }
      idx.lastBlock = String(to);
      from = to + 1n;
    }
    mkdirSync('keeper/state', { recursive: true });
    writeFileSync(file, JSON.stringify(idx));
    committersIndex = idx;
  }
  return committersIndex.byRound[String(r)] ?? [];
}

async function committersScan(r) {
  const ev = ABI.find((x) => x.type === 'event' && x.name === 'Committed');
  const head = await logsPub.getBlockNumber();
  const created = (await read('getRound', [r])).createdAt;
  const out = new Set();
  // walk back until before the round was created (0.45 s blocks); halve the window when the RPC limits log ranges
  let span = 5000n;
  for (let to = head; to > 0n; ) {
    const from = to >= span ? to - span + 1n : 0n;
    let logs;
    try {
      logs = await logsPub.getLogs({ address: await ledger(), event: ev, args: { roundId: r }, fromBlock: from, toBlock: to });
    } catch (e) {
      if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
      throw e;
    }
    for (const l of logs) out.add(l.args.forecaster);
    if ((await logsPub.getBlock({ blockNumber: from })).timestamp < created) break;
    to = from - 1n;
  }
  return [...out];
}

async function score(rIn) {
  const r = rIn ?? (await roundArg());
  const round = await read('getRound', [r]);
  const all1 = (1n << BigInt(round.questionCount)) - 1n;
  if (BigInt(Math.floor(Date.now() / 1000)) <= round.revealDeadline || BigInt(round.resolvedMask) !== all1) return log(`round ${r}: not scorable yet`);
  const all = [];
  for (const a of await committers(r)) if (((await read('flags', [r, a])) & 6) === 0) all.push(a); // skip scored or forfeited
  log(`round ${r}: ${all.length} committers to process`);
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    await send('scoreBatch', [r, chunk]);
    await send('forfeitBatch', [r, chunk]);
  }
}

const SCORES_ABI = [
  parseAbiItem('function postRoot(uint64 roundId, uint64 snapshotBlock, bytes32 root, uint32 leafCount)'),
  parseAbiItem('function latestEpoch() view returns (uint256)'),
  parseAbiItem('function getEpoch(uint256) view returns ((bytes32 root, uint64 snapshotBlock, uint64 roundId, uint32 leafCount, uint48 postedAt, bool revoked))'),
];

/** ForewitScores root for the newest settled round (docs/SCORES.md 5.1). Posts only when two independent providers
 *  build the same root, leaf count and exclusions, and every leaf matches ledger storage at the snapshot block (review L3). */
async function scores() {
  const S = process.env[isMainnet ? 'SCORES_MAINNET' : 'SCORES_TESTNET'];
  if (!S) return log('scores: no ForewitScores address set; skipping');
  const [rpcA, rpcB] = isMainnet ? [process.env.RPC_MAINNET_PRIMARY, process.env.RPC_MAINNET_FALLBACK] : [process.env.BSC_TESTNET_RPC_URL, process.env.SCORES_CHECK_RPC_TESTNET];
  if (!rpcA || !rpcB || rpcA === rpcB) throw new Error('scores: two distinct RPC providers are required');
  const now = BigInt(Math.floor(Date.now() / 1000));
  let settled = 0n;
  for (let r = await read('roundCount'); r >= 1n && !settled; r--) {
    if (now <= (await read('getRound', [r])).revealDeadline) continue;
    let left = 0;
    for (const x of await committers(r)) if (((await read('flags', [r, x])) & 6) === 0) left++;
    if (!left) settled = r;
  }
  if (!settled) return log('scores: no settled round yet');
  const { build, recompute } = await import('../indexer/scores.mjs');
  const network = args.network || 'testnet', L = await ledger();
  const fb = process.env[`INDEXER_FROM_BLOCK_${isMainnet ? 'MAINNET' : 'TESTNET'}`];
  const fromBlock = fb ? BigInt(fb) : undefined;
  const A = await build({ network, ledger: L, fromBlock, roundId: settled, rpc: rpcA });
  if (!A.root) return log(`scores: round ${settled} settled, but no opted in scored holder yet; nothing to post`);
  const B = await build({ network, ledger: L, fromBlock, roundId: settled, snapshotBlock: BigInt(A.snapshotBlock), rpc: rpcB });
  const same = B.root === A.root && B.leafCount === A.leafCount && JSON.stringify(B.excluded) === JSON.stringify(A.excluded);
  if (!same) throw new Error(`scores: providers disagree at block ${A.snapshotBlock} (leaves ${A.leafCount} vs ${B.leafCount}); nothing posted`);
  const archive = createPublicClient({ chain: NET.chain, transport: http(rpcA) });
  for (const l of A.leaves) {
    const st = await archive.readContract({ address: L, abi: ABI, functionName: 'getStats', args: [l.forecaster], blockNumber: BigInt(A.snapshotBlock) });
    const n = BigInt(st.baselineQuestions);
    if (String(n) !== l.n || String(BigInt(st.sumSkill) / (n + 20n)) !== l.skill) throw new Error(`scores: leaf for ${l.forecaster} disagrees with getStats; nothing posted`);
  }
  const sc = (functionName, a = []) => pub.readContract({ address: S, abi: SCORES_ABI, functionName, args: a });
  const latest = await sc('latestEpoch');
  if (latest > 0n) {
    const e = await sc('getEpoch', [latest]);
    if (e.root === A.root && Number(e.leafCount) === A.leafCount && !e.revoked) return log(`scores: root unchanged since epoch ${latest}`);
  }
  await send('postRoot', [settled, BigInt(A.snapshotBlock), A.root, A.leafCount], { address: S, abi: SCORES_ABI });
  const epoch = await sc('latestEpoch');
  const file = { ...A, scores: S, epoch: String(epoch) };
  mkdirSync('web/public/data/scores', { recursive: true });
  for (const f of [`${epoch}.json`, 'latest.json']) writeFileSync(`web/public/data/scores/${f}`, JSON.stringify(file, null, 2));
  const rc = await recompute({ network, scores: S, fromBlock, epoch, rpc: rpcB });
  if (!rc.ok) await alert(`scores epoch ${epoch}: recompute on the second provider failed ${JSON.stringify(rc.checks)}`);
  log(`scores: epoch ${epoch} posted for round ${settled}, ${A.leafCount} leaves, recompute ${rc.ok ? 'ok' : 'FAILED'}`);
}

/** Every 15 minutes: seal and reveal the baseline, finalize, score, over the recent rounds. */
async function tick({ stopAt = Infinity } = {}) {
  const count = await read('roundCount');
  const now = BigInt(Math.floor(Date.now() / 1000));
  // unsettled set: only rounds not yet settled plus rounds created since the last tick are read, so long rounds
  // (up to 120 days) never force a rescan of every settled round after them. The old {from} cursor is read once.
  // Without V32 it scans the newest 15 rounds, as the v3.1 keeper does. stopAt: the loop stops the tick 25 minutes
  // before an unsealed deadline so a long tick never eats the baseline window; unread rounds stay in the set.
  const cursorFile = `keeper/state/cursor_${NET.chain.id}.json`;
  const saved = existsSync(cursorFile) ? JSON.parse(readFileSync(cursorFile, 'utf8')) : {};
  const ids = V32 ? tickIds(saved, count) : tickIds({ next: count > 14n ? count - 14n : 1n }, count);
  const open = [];
  let stopped = false;
  for (const [k, r] of ids.entries()) {
    if (Date.now() > stopAt) { stopped = true; open.push(...ids.slice(k)); log(`tick: stopped before the deadline, ${ids.length - k} rounds left for the next pass`); break; }
    const round = await read('getRound', [r]);
    if (now < round.commitDeadline) { open.push(r); continue; }
    if (!round.isSealed) await seal(r);
    await finalize(r);
    await score(r);
    if (!V32) continue;
    // settled: reveal over, every question resolved, nobody left to score or forfeit
    const after = await read('getRound', [r]);
    const all = (1n << BigInt(after.questionCount)) - 1n;
    let left = 0;
    if (now > after.revealDeadline && BigInt(after.resolvedMask) === all) for (const x of await committers(r)) if (((await read('flags', [r, x])) & 6) === 0) left++;
    const settled = now > after.revealDeadline && BigInt(after.resolvedMask) === all && left === 0;
    if (!settled) open.push(r);
  }
  if (V32) {
    mkdirSync('keeper/state', { recursive: true });
    writeFileSync(cursorFile, JSON.stringify({ next: String(count + 1n), open: open.map(String) }));
  }
  await adminWatch().catch((e) => log(`admin watch failed: ${(e.shortMessage || e.message).split(String.fromCharCode(10))[0]}`));
  if (stopped) return; // scores waits for a pass after the deadline
  // a scores failure alerts but never blocks sealing, finalizing or scoring
  await scores().catch(async (e) => { await alert(`scores failed: ${(e.shortMessage || e.message).split('\n')[0]}`); process.exitCode = 1; });
}

/** Alert on every role, pause or admin seat event on the ledger and ForewitScores since the last check (read only).
 *  These change who can run rounds or post roots, so the owner must hear about each one, planned or not. */
async function adminWatch() {
  const file = `keeper/state/adminwatch_${NET.chain.id}.json`;
  const head = await logsPub.getBlockNumber();
  const from = existsSync(file) ? BigInt(JSON.parse(readFileSync(file, 'utf8')).lastBlock) + 1n : head - 20000n; // first run: about 2.5 hours back
  const names = ['RoleGranted', 'RoleRevoked', 'Paused', 'Unpaused', 'DefaultAdminTransferScheduled', 'DefaultAdminTransferCanceled', 'DefaultAdminDelayChangeScheduled', 'DefaultAdminDelayChangeCanceled', 'RootRevoked'];
  const addrs = [await ledger(), isMainnet && process.env.SCORES_MAINNET].filter(Boolean);
  // AccessControl events share one signature on both contracts; RootRevoked exists only on ForewitScores
  const evs = [...ABI.filter((x) => x.type === 'event' && names.includes(x.name)), parseAbiItem('event RootRevoked(uint256 indexed epoch, string reason)')];
  for (let a = from; a <= head; a += 5000n) {
    const b = a + 4999n > head ? head : a + 4999n;
    for (const l of await logsPub.getLogs({ address: addrs, events: evs, fromBlock: a, toBlock: b })) {
      await alert(`ADMIN EVENT ${l.eventName} on ${l.address} block ${l.blockNumber} tx ${l.transactionHash} ${JSON.stringify(l.args, big)}`);
    }
  }
  mkdirSync('keeper/state', { recursive: true });
  writeFileSync(file, JSON.stringify({ lastBlock: String(head) }));
}

/** One job for the deadline (GitHub Actions starts late or drops runs, so the job starts early and waits):
 *  baseline about 5 minutes before the commit deadline, then seal 20 s after it. A second start finds both done. */
async function night(rIn) {
  const r = rIn ?? (await roundArg());
  const round = await read('getRound', [r]);
  const dl = Number(round.commitDeadline) * 1000;
  if (dl - Date.now() > 5.75 * 3600 * 1000) throw new Error(`round ${r} deadline more than 5.75 hours away; night starts too early`);
  const until = (t) => new Promise((res) => setTimeout(res, Math.max(0, t - Date.now())));
  // V32: every unsealed round sharing this deadline, oldest first (the Featured round opens first), baselines from
  // 10 minutes before so many rounds fit inside the 15 minute window; v3.1: this round only, 5 minutes before
  const due = V32 ? await dueAt(dl) : [r];
  const errors = [];
  const post = async (x, limit) => { try { if (!(await read('getRound', [x])).baselineSet) await baseline(x, { until: limit }); } catch (e) { errors.push(e); } };
  if (Date.now() < dl) {
    // the Featured round keeps its 5 minute target (THREAT_MODEL item 2); topic rounds go first, from 10 minutes
    // before, each stopping its retries by 5.5 minutes before, so a stuck one can never block the Featured baseline
    // Featured: flagged in its round file; without any flag, the oldest due round (the daily round opens first)
    const flagged = due.filter(featuredOf);
    const isFeat = (x) => !V32 || (flagged.length ? flagged.includes(x) : x === due[0]);
    const others = due.filter((x) => !isFeat(x) && boardOf(x) !== 'open'); // Open board rounds take no baseline
    if (others.length) {
      await until(dl - 10 * 60 * 1000);
      for (const x of others) if (Date.now() < dl - 5.5 * 60 * 1000) await post(x, dl - 5.5 * 60 * 1000); else errors.push(new Error(`round ${x}: no time left for its baseline`));
    }
    await until(dl - 5 * 60 * 1000);
    for (const x of due.filter(isFeat)) await post(x, V32 ? dl - 30 * 1000 : Infinity); // v3.1: retries as before
  }
  await until(dl + 20 * 1000);
  for (const x of due) {
    try { if (!(await read('getRound', [x])).isSealed) await seal(x); } catch (e) { errors.push(e); }
  }
  if (errors.length) throw errors[0];
  log(`rounds ${due.join(', ')}: night duties done`);
}

/** Featured flag of a round from its public round file (the daily round); unknown means not featured. */
function featuredOf(r) {
  const f = `keeper/archive/${args.network || 'testnet'}/rounds/${r}.json`;
  return existsSync(f) && JSON.parse(readFileSync(f, 'utf8')).featured === true;
}

/** Unsealed rounds whose commit deadline is dl, oldest first. Scans back from the newest round to one day before dl. */
async function dueAt(dl) {
  const due = [];
  for (let x = await read('roundCount'); x >= 1n; x--) {
    const y = await read('getRound', [x]);
    const d = Number(y.commitDeadline) * 1000;
    if (d < dl - 86400000) break;
    if (d === dl && !y.isSealed) due.push(x);
  }
  return due.reverse();
}

/** Keeper loop for a host without a working scheduler (GitHub Actions bridge, 24 Nov 2026: schedules stopped firing).
 *  Runs LOOP_HOURS (default 5.5); the workflow then starts a fresh loop. Each pass, in order:
 *  open today's daily round (03:00 to 20:00 UTC, once per UTC day); within 20 minutes of an unsealed deadline run
 *  night (baseline, then seal); otherwise tick (seal, finalize, score, scores). Passes every 15 minutes, and wakes
 *  19 minutes before an open deadline. A failing duty alerts and the loop goes on. */
async function loop() {
  const end = Date.now() + Number(process.env.LOOP_HOURS || 5.5) * 3600 * 1000;
  const ping = async (k) => { if (process.env[k]) await fetch(process.env[k]).catch(() => {}); };
  const guard = async (name, fn) => { try { await fn(); } catch (e) { await alert(`loop ${name} failed: ${(e.shortMessage || e.message).split('\n')[0]}`); } };
  while (Date.now() < end) {
    let wakeForDeadline = Infinity;
    try {
    const now = new Date();
    const count = await read('roundCount');
    const latest = count > 0n ? await read('getRound', [count]) : null;
    const dl = latest ? Number(latest.commitDeadline) * 1000 : 0;
    committersIndex = null; // refresh the log index each pass
    const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (now.getUTCHours() >= 3 && now.getUTCHours() < 20 && (!latest || Number(latest.createdAt) * 1000 < startOfDay)) {
      await guard('daily', async () => { await daily(); await ping('HC_PING_DAILY'); });
    } else if (V32 && now.getUTCHours() >= 3 && now.getUTCHours() < 20 && dl - Date.now() > 3 * 3600 * 1000 && !existsSync(`keeper/state/topics_${NET.chain.id}_${now.toISOString().slice(0, 10)}.done`)) {
      // done after success, or after a second failure the same day (alerted), so a deterministic failure never starves tick
      const doneFile = `keeper/state/topics_${NET.chain.id}_${now.toISOString().slice(0, 10)}.done`;
      const tryFile = doneFile.replace(/\.done$/, '.tries');
      const tries = existsSync(tryFile) ? Number(readFileSync(tryFile, 'utf8')) : 0;
      mkdirSync('keeper/state', { recursive: true });
      writeFileSync(tryFile, String(tries + 1));
      await guard('topics', async () => {
        try { await topics(); } catch (e) { if (tries + 1 >= 2) writeFileSync(doneFile, `gave up ${new Date().toISOString()}`); throw e; }
        writeFileSync(doneFile, new Date().toISOString());
      });
    } else if (latest && !latest.isSealed && dl - Date.now() <= 20 * 60 * 1000) {
      // night pings only when every baseline and seal succeeded
      await guard('night', async () => { await night(count); await ping('HC_PING_NIGHT'); });
    } else {
      const stopAt = V32 && latest && !latest.isSealed ? dl - 25 * 60 * 1000 : Infinity;
      await guard('tick', async () => { await tick({ stopAt }); await ping('HC_PING_TICK'); });
    }
    if (latest && !latest.isSealed && dl - 19 * 60 * 1000 > Date.now()) wakeForDeadline = dl - 19 * 60 * 1000;
    } catch (e) { await alert(`loop pass failed: ${(e.shortMessage || e.message).split(String.fromCharCode(10))[0]}`); } // RPC down: next pass in 15 minutes
    const next = Math.min(Date.now() + 15 * 60 * 1000, wakeForDeadline, end);
    if (next > Date.now()) await new Promise((res) => setTimeout(res, next - Date.now()));
  }
  log('loop: time budget used; the workflow starts a fresh loop');
}

/** Rule v3.2 topic rounds (docs/QUESTION_SELECTION.md): every market once, grouped by board, topic and horizon,
 *  16 questions at most per round, same commit deadline as the Featured round. Off unless TOPIC_ROUNDS=on.
 *  Open board cap per day: TOPIC_OPEN_CAP (default 10 rounds). Markets already asked are kept in keeper/state/asked_<chain>.json. */
async function topics() {
  if (process.env.TOPIC_ROUNDS !== 'on') return log('topics: TOPIC_ROUNDS is not on; nothing opened');
  const { planTopicRounds } = await import('./lib/topics.mjs');
  const d = new Date();
  d.setUTCHours(23, 0, 0, 0);
  if (d.getTime() - Date.now() < 3 * 3600 * 1000) throw new Error('less than 3 hours to 23:00 UTC; topic rounds open tomorrow');
  const raw = [];
  for (let cur = '', i = 0; i < 300; i++) {
    const j = await apiGet('/v1/markets?status=OPEN&first=100&includeStats=true' + (cur ? '&after=' + cur : ''));
    raw.push(...j.data);
    if (!(cur = j.cursor)) break;
  }
  const cats = {};
  let calls = 0;
  for (const slug of new Set(raw.filter((m) => sel.isBinary(m) && !sel.isCryptoUpDown(m) && !sel.isSports(m)).map((m) => m.categorySlug))) {
    cats[slug] = (await apiGet('/v1/categories/' + slug).catch(() => ({ data: null }))).data;
    if (++calls % 200 === 0) await new Promise((r) => setTimeout(r, 60_000)); // API limit 250 a minute
  }
  const askedFile = `keeper/state/asked_${NET.chain.id}.json`;
  const asked = askedSet();
  const day = new Date().toISOString().slice(0, 10);
  const featFile = `keeper/archive/${args.network || 'testnet'}/${day}_daily/selection.json`;
  const featured = new Set(existsSync(featFile) ? JSON.parse(readFileSync(featFile, 'utf8')).chosen.map((c) => String(c.marketId)) : []);
  // scored rounds are capped too: each needs its own baseline inside the 15 minute window
  // caps count per day: rounds already opened today (an earlier attempt) are taken off
  const countFile = `keeper/state/topics_${NET.chain.id}_${day}.opened.json`;
  const done = existsSync(countFile) ? JSON.parse(readFileSync(countFile, 'utf8')) : { scored: 0, open: 0, optional: 0 };
  const left = (k, d) => Math.max(0, num(process.env[`TOPIC_${k.toUpperCase()}_CAP`], d) - done[k]);
  const plan = planTopicRounds(raw, cats, d.getTime(), { asked, featured, caps: { scored: left('scored', 6), open: left('open', 10), optional: left('optional', 5) } });
  log(`topics: ${plan.rounds.length} rounds planned (${plan.dropped} over the caps)`);
  let opened = 0;
  const saved = { selection: args.selection, days: args['resolution-days'] };
  try {
  for (const [i, r] of plan.rounds.entries()) {
    const chosen = [];
    for (const q of r.questions) {
      const ctf = ctfFor(q);
      const [slots, den] = await Promise.all(CTF_ABI.map((fn) => pub.readContract({ address: ctf, abi: [fn], functionName: fn.name, args: [q.conditionId] })));
      if (slots === 2n && den === 0n) chosen.push({ ...q, ctf });
    }
    if (!chosen.length) continue;
    const dir = `keeper/archive/${args.network || 'testnet'}/${day}_topics`;
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/${String(i).padStart(3, '0')}_${r.board}_${r.topic}_${r.horizon}.json`;
    writeFileSync(file, JSON.stringify({ rule: 'QUESTION_SELECTION v3.2', kind: 'topic', board: r.board, topic: r.topic, horizon: r.horizon, optional: r.optional, featured: false, commitDeadline: d.toISOString(), resolutionDays: r.resolutionDays, chosen }, null, 2));
    Object.assign(args, { selection: file, 'resolution-days': String(r.resolutionDays) });
    await open();
    opened++;
    done[r.optional ? 'optional' : r.board]++;
    mkdirSync('keeper/state', { recursive: true });
    writeFileSync(countFile, JSON.stringify(done));
    for (const q of chosen) asked.add(String(q.marketId));
    mkdirSync('keeper/state', { recursive: true });
    writeFileSync(askedFile, JSON.stringify([...asked]));
  }
  } finally {
    for (const [k, v] of [['selection', saved.selection], ['resolution-days', saved.days]]) if (v === undefined) delete args[k]; else args[k] = v;
  }
  log(`topics: ${opened} rounds opened`);
}

/** Daily at 03:00 UTC: select and open a daily round whose commit deadline is 23:00 UTC today. */
async function daily() {
  const d = new Date();
  d.setUTCHours(23, 0, 0, 0);
  if (d.getTime() - Date.now() < 3 * 3600 * 1000) throw new Error('less than 3 hours to 23:00 UTC; open tomorrow instead');
  Object.assign(args, { 'commit-deadline': d.toISOString(), kind: 'daily' });
  await select();
  args.selection = `keeper/archive/${args.network || 'testnet'}/${new Date().toISOString().slice(0, 10)}_daily/selection.json`;
  const chosen = JSON.parse(readFileSync(args.selection, 'utf8')).chosen.length;
  if (chosen < 3) throw new Error(`only ${chosen} questions; round not opened`);
  await open();
}

/** Read only, every 30 minutes (GitHub Actions and the host): alert on any missed duty. Exit 1 when something is missed. */
async function watchdog() {
  const { missedDuties, dailyOpenMissed } = await import('./lib/watchdog.mjs');
  const now = Math.floor(Date.now() / 1000);
  const count = await read('roundCount');
  const missed = [];
  if (count === 0n) missed.push('open: no round yet');
  // V32: the tick's unsealed and unsettled set plus the newest 15, so the Featured round stays covered at any round count
  const last15 = count > 0n ? tickIds({ next: count > 14n ? count - 14n : 1n }, count) : [];
  const cursorFile = `keeper/state/cursor_${NET.chain.id}.json`;
  const ids = V32 && existsSync(cursorFile) ? [...new Set([...tickIds(JSON.parse(readFileSync(cursorFile, 'utf8')), count), ...last15].map(String))].map(BigInt).sort((a, b) => (a < b ? -1 : 1)) : last15;
  for (const r of ids) {
    const round = await read('getRound', [r]);
    const qs = await read('getQuestions', [r]);
    let onchain = 0;
    for (let i = 0; i < qs.length; i++) {
      const den = await pub.readContract({ address: qs[i].ctf, abi: [CTF_ABI[1]], functionName: 'payoutDenominator', args: [qs[i].conditionId] });
      if (den > 0n) onchain |= 1 << i;
    }
    let unprocessed = 0;
    if (BigInt(now) > round.revealDeadline) for (const a of await committers(r)) if (((await read('flags', [r, a])) & 6) === 0) unprocessed++;
    for (const m of missedDuties({ round, resolvedOnchainMask: onchain, unprocessed, now, needsBaseline: boardOf(r) !== 'open' })) missed.push(`round ${r} ${m}`);
    if (r === count) missed.push(...dailyOpenMissed(round.createdAt, now));
  }
  if (!missed.length) return log('watchdog: all duties on schedule');
  for (const m of missed) await alert(`MISSED ${m}`);
  process.exitCode = 1;
}

// V32 and no --round: every unsealed round at the newest deadline (the Featured round first), like night
const baselineCmd = async () => {
  if ((args.round !== undefined && args.round !== 'latest') || !V32) return baseline();
  const errors = [];
  for (const r of await dueAt(Number((await read('getRound', [await read('roundCount')])).commitDeadline) * 1000)) await baseline(r).catch((e) => errors.push(e));
  if (errors.length) throw errors[0];
};
const cmds = { adminwatch: adminWatch, select, open, topics, baseline: baselineCmd, seal, night, loop, scores, committers: async () => log(JSON.stringify(await committers(await roundArg()))), deadline: async () => console.log(String((await read('getRound', [await roundArg()])).commitDeadline)), finalize, score, tick, daily, watchdog, status: async () => log(JSON.stringify(await read('getRound', [BigInt(args.round)]), big)) };
if (!cmds[cmd]) {
  console.log('usage: select | open | baseline | seal | night | scores | finalize | score | tick | daily | watchdog | status  (--network testnet|mainnet)');
  process.exit(1);
}
const hc = process.env[`HC_PING_${cmd.toUpperCase()}`];
try {
  await cmds[cmd]();
  // publish real data to the site after every state changing job (needs the ledger's deploy block; PUBLISH=0 disables)
  const fromBlock = process.env[`INDEXER_FROM_BLOCK_${isMainnet ? 'MAINNET' : 'TESTNET'}`];
  if (['open', 'baseline', 'seal', 'night', 'loop', 'scores', 'finalize', 'score', 'tick', 'daily'].includes(cmd) && process.env.PUBLISH !== '0' && fromBlock) {
    const { publish } = await import('../indexer/publish.mjs');
    const p = await publish({ network: args.network || 'testnet', ledger: await ledger(), fromBlock, rpc: process.env.LOGS_RPC_URL }).catch(async (e) => { await alert(`publish failed: ${e.message.split('\n')[0]}`); return null; });
    if (p) log(`published ${p.rounds} rounds, ${p.files} round files to web/public/data`);
  }
  if (hc) await fetch(process.exitCode ? `${hc}/fail` : hc).catch(() => log('healthcheck ping failed'));
} catch (e) {
  if (hc) await fetch(`${hc}/fail`).catch(() => {});
  await alert(`${cmd} failed: ${(e.shortMessage || e.message).split('\n')[0]}`);
  throw e;
}
