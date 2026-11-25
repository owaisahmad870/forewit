// Forewit v2 keeper for OpenForecasts (docs/OPEN_FORECASTS.md). Own wallet, own job: it can never starve the v1
// deadline duties. Each pass (every OPEN_PASS_SECONDS, default 10):
//   A. new commits first: within 120 s of each, post the market price (rule v2.1: Predict.fun's 1 minute chance
//      history, a bucket that ended before the commit and at most 3 minutes old, only if the live book read now agrees
//      within 3 points) or void on positive evidence (no such market, wrong condition, wrong Conditional Tokens or
//      outcome layout, market ended, book closed when read promptly). An API outage never voids: it is retried while
//      the window lasts. The decision and its evidence are archived;
//   B. once per market: finalize when the Conditional Tokens payout is reported;
//   C. reveal sealed copies once open (hash checked first; a bad copy alerts once), score revealed forecasts and,
//      after the reveal window, unrevealed ones as forfeits.
// Env: OPEN_LEDGER, OPEN_FROM_BLOCK (required), OPEN_NETWORK (mainnet|testnet), OPEN_KEEPER_PRIVATE_KEY (mainnet) or
// KEEPER_PRIVATE_KEY (testnet), OPEN_CONFIRM_MAINNET=yes, RPC_MAINNET_PRIMARY / RPC_MAINNET_FALLBACK / BSC_TESTNET_RPC_URL,
// PREDICT_API_KEY (mainnet), OPEN_API_URL (tests), OPEN_LOOP_MINUTES (330), OPEN_ONCE=1, OPEN_WALLET_DAILY_CAP (50).
import { createPublicClient, createWalletClient, http, parseAbiItem, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { logsClient } from '../indexer/lib/logs.mjs';
import { ciphertextOf, openSealed } from '../agent/lib/autoreveal.mjs';
import { ctfFor } from '../agent/lib/open.mjs';
import { redactPublic } from './lib/redact.mjs';

const NETWORK = process.env.OPEN_NETWORK || 'testnet';
const isMainnet = NETWORK === 'mainnet';
const LEDGER = process.env.OPEN_LEDGER;
const ACTIVE = /^0x[0-9a-fA-F]{40}$/.test(LEDGER ?? '') && /^\d+$/.test(process.env.OPEN_FROM_BLOCK ?? '');
const CHAIN_ID = Number(process.env.OPEN_CHAIN_ID || (isMainnet ? 56 : 97));
const RPC = isMainnet ? process.env.RPC_MAINNET_PRIMARY || 'https://bsc-rpc.publicnode.com' : process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const chain = CHAIN_ID === 56 ? bsc : CHAIN_ID === 97 && !process.env.BSC_TESTNET_RPC_URL?.includes('127.0.0.1') ? bscTestnet
  : defineChain({ id: CHAIN_ID, name: 'local', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const API = process.env.OPEN_API_URL || (isMainnet ? 'https://api.predict.fun' : 'https://api-testnet.predict.fun');
const ABI = JSON.parse(readFileSync(new URL('./abi/OpenForecasts_v1.json', import.meta.url), 'utf8'));
const CTF_ABI = [parseAbiItem('function payoutDenominator(bytes32) view returns (uint256)')];
const log = (...a) => console.log(new Date().toISOString(), ...a);
const DIR = process.env.OPEN_STATE_DIR || 'keeper/state';
const STATE = `${DIR}/open_${CHAIN_ID}_${String(LEDGER).toLowerCase()}.json`;
const ARCHIVE = `${process.env.OPEN_STATE_DIR ? DIR + '/archive' : 'keeper/archive'}/open_${CHAIN_ID}`;
const BASELINE_WINDOW = 120, VOID_WINDOW = 120, REVEAL_WINDOW = 3 * 86400, MAX_SPREAD_BPS = 1000, CONFIRMATIONS = 15n;
const MIN_VOLUME_USD = Number(process.env.OPEN_MIN_VOLUME_USD || 100); // the same liquidity floor as v1 selection
const UNPAID_PER_PASS = Number(process.env.OPEN_UNPAID_PER_PASS || 5); // over cap forecasts get only spare API budget
const PAYOUT_CHECK_S = 60; // an unresolved market's payout is read at most once a minute
const MIN_DEPTH_USD = Number(process.env.OPEN_MIN_DEPTH_USD || 50);
const PROMPT_READ_S = 15; // a closed book counts as void evidence only when read this soon after the commit
const WALLET_DAILY_CAP = Number(process.env.OPEN_WALLET_DAILY_CAP || 50);
const MAX_JUMP_BPS = 300; // rule v2.1: the live book must agree with the history point within 3 points
const BC_BUDGET_MS = 20_000;
const MIN_LEAD_S = 60, MIN_LEAD_SHARE = 0.2; // rule v2.1: no price for a commit in the last 20% of a market's life
// rule v2.2 (owner, 25 Nov 2026): for commits from 20:00 UTC that day only the last 60 seconds get no price
const V22_FROM_S = 1795636800; // 2026-11-25T20:00:00Z

/** Off chain review M5: a commit too close to the market end gets no price (the outcome may be nearly known). */
export function tooLate({ committedAt, startsAtS, endsAtS }) {
  if (!Number.isFinite(endsAtS)) return false;
  const life = Number.isFinite(startsAtS) && endsAtS > startsAtS ? endsAtS - startsAtS : 0;
  const share = committedAt >= V22_FROM_S ? 0 : MIN_LEAD_SHARE;
  return endsAtS - committedAt < Math.max(MIN_LEAD_S, share * life);
}

/** Live Yes middle of a two sided book in basis points, or null. Used only to refuse a price, never to set one. */
export function liveMidBps(book) {
  const bid = Math.round(Number(book?.bids?.[0]?.[0]) * 10000), ask = Math.round(Number(book?.asks?.[0]?.[0]) * 10000);
  return bid > 0 && ask > 0 && ask >= bid ? Math.round((bid + ask) / 2) : null;
}

/**
 * The market price from BEFORE the commit (final review, H1 residual): Predict.fun's own 1 minute chance history, the
 * last point strictly before the commit's block time and at most 5 minutes old. Nothing posted after the commit can
 * change it. Also needs the v1 liquidity floor (100 USD traded in 24 hours).
 */
export function priceFromHistory(series, committedAt, slot, volume24hUsd = Infinity, liveYesBps = null) {
  if (!(volume24hUsd >= MIN_VOLUME_USD)) return { ok: false, why: `less than ${MIN_VOLUME_USD} USD traded in 24 hours` };
  // rule v2.1 (final review M2): the whole 1 minute bucket ended before the commit (so no trade after it can be in it),
  // and it is at most 3 minutes old
  const before = (series ?? []).filter((p) => Number(p.x) + 60 <= committedAt && committedAt - Number(p.x) <= 180 && Number.isFinite(Number(p.y)));
  if (!before.length) return { ok: false, why: 'no price bucket that ended in the 3 minutes before the commit' };
  const last = before.reduce((a, b) => (Number(b.x) > Number(a.x) ? b : a));
  const yes = Math.round(Number(last.y) * 100); // chance in percent to basis points
  if (yes <= 0 || yes >= 10000) return { ok: false, why: 'price at 0 or 100 percent' };
  // a commit timed right after a price jump would score against the stale point: no price unless the live book agrees
  if (liveYesBps === null || !Number.isFinite(liveYesBps)) return { ok: false, why: 'no live price to check against' };
  if (Math.abs(liveYesBps - yes) > MAX_JUMP_BPS) return { ok: false, why: `price moved ${Math.abs(liveYesBps - yes) / 100} points since the last bucket` };
  return { ok: true, bps: slot === 0 ? yes : 10000 - yes, at: Number(last.x) };
}

/** The void reason from what the API returned, or 0. Pure, so the rule is testable (docs/OPEN_FORECASTS.md). */
export function voidReason({ f, market, endsAtS, readAtS, chainId }) {
  if (!market) return 3; // no such market
  if (String(market.conditionId).toLowerCase() !== String(f.conditionId).toLowerCase()) return 3;
  if (String(ctfFor(chainId, market)).toLowerCase() !== String(f.ctf).toLowerCase()) return 3; // wrong Conditional Tokens
  if (market.outcomes?.[0]?.indexSet !== 1 || market.outcomes?.[1]?.indexSet !== 2) return 3; // review M7: layout
  if (Number.isFinite(endsAtS) && f.committedAt >= endsAtS) return 1; // committed at or after the market's end
  // re-review N1: a reveal start must sit at the market end plus a few minutes, never later (no hiding a loss)
  if (Number(f.revealNotBefore) > 0 && (!Number.isFinite(endsAtS) || Number(f.revealNotBefore) > endsAtS + 300)) return 4;
  if (market.tradingStatus && market.tradingStatus !== 'OPEN' && readAtS - f.committedAt <= PROMPT_READ_S) return 2; // closed when read promptly
  return 0;
}

class Outage extends Error {}
async function api(path) {
  let r;
  try { r = await fetch(API + path, { headers: isMainnet ? { 'x-api-key': process.env.PREDICT_API_KEY } : {}, signal: AbortSignal.timeout(8_000) }); } catch (e) { throw new Outage(e.message); }
  if (r.status === 404) return null; // positive evidence: no such market or category
  if (!r.ok) throw new Outage(`HTTP ${r.status}`);
  const j = await r.json().catch(() => null);
  if (!j) throw new Outage('unreadable reply');
  return j.data ?? null;
}

let pub, logsPub, wallet;
const read = (functionName, args = []) => pub.readContract({ address: LEDGER, abi: ABI, functionName, args });
function account() {
  if (isMainnet && process.env.OPEN_CONFIRM_MAINNET !== 'yes') throw new Error('mainnet write refused: set OPEN_CONFIRM_MAINNET=yes only after Owais says yes');
  const k = isMainnet ? process.env.OPEN_KEEPER_PRIVATE_KEY : process.env.KEEPER_PRIVATE_KEY;
  if (!k) throw new Error('open keeper key missing');
  return privateKeyToAccount(k);
}
async function send(functionName, args) {
  wallet ??= createWalletClient({ account: account(), chain, transport: http(RPC) });
  const { request } = await pub.simulateContract({ account: wallet.account, address: LEDGER, abi: ABI, functionName, args });
  const hash = await wallet.writeContract(request);
  const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (rc.status !== 'success') throw new Error(`${functionName} reverted ${hash}`);
  log(functionName, hash, 'gas', rc.gasUsed);
  return rc;
}
async function alert(msg) {
  log('ALERT', msg);
  const { ALERT_ISSUE_NUMBER: issue, GITHUB_TOKEN: gh, GITHUB_REPOSITORY: repo } = process.env;
  if (issue && gh && repo) await fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments`, { method: 'POST', headers: { authorization: `Bearer ${gh}`, 'content-type': 'application/json' }, body: JSON.stringify({ body: `Open keeper: ${redactPublic(msg)}` }) }).catch(() => {});
}

const load = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { lastBlock: String(BigInt(process.env.OPEN_FROM_BLOCK) - 1n), forecasts: {}, perDay: {} });
const save = (st) => { mkdirSync(DIR, { recursive: true }); writeFileSync(STATE, JSON.stringify(st)); };
const archive = (name, obj) => { mkdirSync(ARCHIVE, { recursive: true }); writeFileSync(`${ARCHIVE}/${name}.json`, JSON.stringify(obj, null, 1)); };

async function newCommits(st) {
  const ev = ABI.find((x) => x.type === 'event' && x.name === 'Committed');
  const head = (await pub.getBlockNumber()) - CONFIRMATIONS; // review L5: a lagging provider cannot skip a commit
  let span = 2000n;
  for (let from = BigInt(st.lastBlock) + 1n; from <= head;) {
    const to = from + span - 1n > head ? head : from + span - 1n;
    let logs;
    try { logs = await logsPub.getLogs({ address: LEDGER, event: ev, fromBlock: from, toBlock: to }); } catch (e) {
      if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
      throw e;
    }
    for (const l of logs) {
      const id = `${l.args.key}:${l.args.forecaster.toLowerCase()}`;
      if (st.forecasts[id]) continue;
      const b = await pub.getBlock({ blockNumber: l.blockNumber });
      const day = new Date(Number(b.timestamp) * 1000).toISOString().slice(0, 10);
      const k = `${day}:${l.args.forecaster.toLowerCase()}`;
      st.perDay[k] = (st.perDay[k] ?? 0) + 1;
      st.forecasts[id] = { key: l.args.key, forecaster: l.args.forecaster, ctf: l.args.ctf, conditionId: l.args.conditionId, slot: Number(l.args.slot), marketId: String(l.args.marketId),
        committedAt: Number(b.timestamp), sealed: l.args.sealedCopy, revealNotBefore: Number(l.args.revealNotBefore ?? 0), stage: 'new', tries: 0, paid: st.perDay[k] <= WALLET_DAILY_CAP };
      log(`commit ${l.args.forecaster} market ${l.args.marketId}`);
    }
    st.lastBlock = String(to);
    from = to + 1n;
  }
}

/** Phase A for one new forecast. */
async function priceOrVoid(f, now) {
  if (now > f.committedAt + Math.max(BASELINE_WINDOW, VOID_WINDOW)) {
    if (f.tries === 0) await alert(`market ${f.marketId} ${f.forecaster}: not checked within 120 s (keeper late); scored on accuracy only`);
    f.stage = 'priced';
    return;
  }
  f.tries += 1;
  let m, cat = null, book = null, live = null;
  try {
    m = await api(`/v1/markets/${f.marketId}?includeStats=true`);
    if (m?.categorySlug) cat = await api(`/v1/categories/${m.categorySlug}`);
    if (m) book = await api(`/v1/markets/${f.marketId}/timeseries?metric=chance&resolution=1m&from=${f.committedAt - 600}&limit=20`);
    if (m) live = await api(`/v1/markets/${f.marketId}/orderbook`);
  } catch (e) {
    if (e instanceof Outage) return log(`market ${f.marketId}: Predict.fun not reachable (${e.message}); retrying, never voided for this`);
    throw e;
  }
  const endsAtS = Date.parse(cat?.tradingSession?.closesAt ?? cat?.endsAt ?? '') / 1000;
  // re-review L2: the read time is taken after the API calls, not at the start of the pass
  const reason = voidReason({ f, market: m, endsAtS, readAtS: Math.floor(Date.now() / 1000), chainId: CHAIN_ID });
  const startsAtS = Date.parse(cat?.tradingSession?.opensAt ?? cat?.startsAt ?? '') / 1000;
  const p = reason ? null : tooLate({ committedAt: f.committedAt, startsAtS, endsAtS }) ? { ok: false, why: 'committed too close to the end of the market\'s life' }
    : priceFromHistory(book?.series, f.committedAt, f.slot, Number(m?.stats?.volume24hUsd), liveMidBps(live));
  if (!reason && m && !m.stats) await alert(`market ${f.marketId}: Predict.fun returned no stats, so no price can count; check the API`);
  const evidence = { forecast: { ...f, sealed: undefined }, checkedAt: now, tries: f.tries, reason, price: p,
    market: m && { id: m.id, conditionId: m.conditionId, tradingStatus: m.tradingStatus, status: m.status, outcomes: m.outcomes?.map((o) => ({ indexSet: o.indexSet })) },
    category: cat && { slug: cat.slug, endsAt: cat.endsAt, tradingSession: cat.tradingSession }, history: book?.series?.slice(-10) ?? null, liveMidBps: liveMidBps(live), volume24hUsd: m?.stats?.volume24hUsd ?? null };
  if (reason) {
    await send('voidForecast', [f.key, f.forecaster, reason]);
    f.stage = 'void';
  } else if (p.ok && f.paid) {
    await send('setBaseline', [f.key, f.forecaster, p.bps]);
    f.stage = 'priced';
  } else {
    log(`market ${f.marketId}: no market price counted (${f.paid ? p.why : 'daily keeper cap for this wallet'}); accuracy only`);
    f.stage = 'priced';
  }
  archive(`${f.key.slice(2, 14)}_${f.forecaster.toLowerCase()}`, evidence); // review L4: the decision that was acted on
}

async function pass() {
  const st = load();
  await newCommits(st);
  let now = Math.floor(Date.now() / 1000);
  const all = Object.values(st.forecasts);
  // A: new commits first (review M5), wallets under their daily cap before anyone else, so a flood of commits from
  // one wallet cannot push other forecasts past their 120 s windows (re-review M5)
  const fresh = all.filter((x) => x.stage === 'new');
  const unpaid = fresh.filter((x) => !x.paid);
  for (const f of [...fresh.filter((x) => x.paid), ...unpaid.slice(0, UNPAID_PER_PASS)]) {
    try { await priceOrVoid(f, now); } catch (e) { await alert(`market ${f.marketId} ${f.forecaster}: ${(e.shortMessage || e.message).split('\n')[0]}`); }
  }
  for (const f of unpaid.slice(UNPAID_PER_PASS)) if (now > f.committedAt + VOID_WINDOW) f.stage = 'priced'; // no price, so no weight
  save(st);
  now = Math.floor(Date.now() / 1000);
  // B: once per market. Off chain review M4: the keeper pays finalize, reveal and score only for forecasts within the
  // daily cap (anyone may call them for the rest), and B plus C stop after BC_BUDGET_MS so phase A runs every pass
  const passStart = Date.now();
  const open = all.filter((x) => x.stage === 'priced' && x.paid);
  const resolved = new Map();
  st.payoutCheckedAt ??= {};
  for (const key of new Set(open.map((x) => x.key))) {
    if (Date.now() - passStart > BC_BUDGET_MS) break;
    const f = open.find((x) => x.key === key);
    try {
      if (now - (st.payoutCheckedAt[key] ?? 0) < PAYOUT_CHECK_S && !st.resolved?.[key]) continue;
      st.payoutCheckedAt[key] = now;
      let at = st.resolved?.[key] ?? Number((await read('markets', [key]))[0]);
      if (!at) {
        const den = await pub.readContract({ address: f.ctf, abi: CTF_ABI, functionName: 'payoutDenominator', args: [f.conditionId] });
        if (den === 0n) continue;
        await send('finalize', [f.ctf, f.conditionId]);
        at = Number((await read('markets', [key]))[0]);
      }
      resolved.set(key, at);
      (st.resolved ??= {})[key] = at;
    } catch (e) { await alert(`finalize market ${f.marketId}: ${(e.shortMessage || e.message).split('\n')[0]}`); }
  }
  // C: reveal and score
  for (const f of open.filter((x) => resolved.has(x.key))) {
    if (Date.now() - passStart > BC_BUDGET_MS) break;
    try {
      const resolvedAt = resolved.get(f.key);
      const [hash, , , flags, , , revealNotBefore] = await read('forecasts', [f.key, f.forecaster]);
      if (flags & 2 || flags & 8) { f.stage = 'done'; continue; }
      const deadline = Math.max(resolvedAt, Number(revealNotBefore)) + REVEAL_WINDOW;
      // re-review N2: no drand call before the copy is due to open
      if (!(flags & 1) && f.paid && !f.sealedBad && f.sealed && f.sealed !== '0x' && now <= deadline && now >= Number(revealNotBefore)) {
        const ct = ciphertextOf(f.sealed);
        if (!ct) { f.sealedBad = true; await alert(`market ${f.marketId} ${f.forecaster}: sealed copy unreadable; the owner must reveal from the receipt`); }
        else {
          try {
            const { packed, salt } = await openSealed(ct);
            if (packed < 100n || packed > 9900n || (await read('computeCommitHash', [f.ctf, f.conditionId, f.slot, f.forecaster, Number(packed), salt])) !== hash) {
              f.sealedBad = true; // review M6: alert once, never retry a copy that does not match
              await alert(`market ${f.marketId} ${f.forecaster}: sealed copy does not match the commit; the owner must reveal from the receipt`);
            } else await send('revealFor', [f.key, f.forecaster, Number(packed), salt, f.ctf, f.conditionId]);
          } catch (e) {
            // off chain review M3: a drand, RPC or gas error is retried on the next pass (alerted once); only an
            // unreadable or mismatching copy is given up
            if (!/too early/i.test(e.message) && !f.revealErrAlerted) { f.revealErrAlerted = true; await alert(`market ${f.marketId} ${f.forecaster}: reveal failed, retrying: ${(e.shortMessage || e.message).split('\n')[0]}`); }
          }
        }
      }
      const flags2 = Number((await read('forecasts', [f.key, f.forecaster]))[3]);
      if ((flags2 & 1 && now > f.committedAt + VOID_WINDOW) || now > deadline) { await send('score', [f.key, f.forecaster]); f.stage = 'done'; }
    } catch (e) {
      await alert(`market ${f.marketId} ${f.forecaster}: ${(e.shortMessage || e.message).split('\n')[0]}`);
    }
  }
  save(st);
}

if (import.meta.filename === process.argv[1]) {
  if (!ACTIVE) { console.log('open keeper: OPEN_LEDGER or OPEN_FROM_BLOCK not set; nothing to do'); process.exit(0); }
  pub = createPublicClient({ chain, transport: http(RPC) });
  logsPub = logsClient(chain, [process.env.LOGS_RPC_URL, isMainnet && process.env.RPC_MAINNET_PRIMARY, isMainnet && process.env.RPC_MAINNET_FALLBACK, !isMainnet && process.env.BSC_TESTNET_RPC_URL].filter(Boolean), [isMainnet ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com']);
  const end = Date.now() + Number(process.env.OPEN_LOOP_MINUTES || 330) * 60_000;
  do {
    try { await pass(); } catch (e) { await alert(`pass failed: ${(e.shortMessage || e.message).split('\n')[0]}`); }
    if (process.env.OPEN_ONCE === '1') break;
    await new Promise((r) => setTimeout(r, Number(process.env.OPEN_PASS_SECONDS || 10) * 1000));
  } while (Date.now() < end);
}
