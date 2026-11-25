// Forewit v2 keeper for OpenForecasts (docs/OPEN_FORECASTS.md). Own wallet, own job: it can never starve the v1
// deadline duties. Each pass (every OPEN_PASS_SECONDS, default 10) it:
//   1. reads new Committed events and, within 120 s of each commit, posts the market price (two sided book, spread at
//      most 10 points) or voids the forecast (market ended, closed, or a market id that does not match the condition);
//      the evidence (book and category) is archived so anyone can recompute it;
//   2. finalizes markets whose Conditional Tokens payout is reported;
//   3. reveals sealed copies once the drand round has passed and the market is finalized (hash checked first);
//   4. scores revealed forecasts, and unrevealed ones as forfeits after the 3 day reveal window.
// Env: OPEN_LEDGER, OPEN_FROM_BLOCK, OPEN_NETWORK (mainnet|testnet), OPEN_KEEPER_PRIVATE_KEY (mainnet) or
// KEEPER_PRIVATE_KEY (testnet), OPEN_CONFIRM_MAINNET=yes, RPC_MAINNET_PRIMARY / RPC_MAINNET_FALLBACK / BSC_TESTNET_RPC_URL,
// PREDICT_API_KEY (mainnet), OPEN_API_URL (tests), OPEN_LOOP_MINUTES (default 330), OPEN_ONCE=1 (one pass).
import { createPublicClient, createWalletClient, http, parseAbiItem, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { logsClient } from '../indexer/lib/logs.mjs';
import { ciphertextOf, openSealed } from '../agent/lib/autoreveal.mjs';
import { redactPublic } from './lib/redact.mjs';

const NETWORK = process.env.OPEN_NETWORK || 'testnet';
const isMainnet = NETWORK === 'mainnet';
const LEDGER = process.env.OPEN_LEDGER;
if (!/^0x[0-9a-fA-F]{40}$/.test(LEDGER ?? '')) { console.log('open keeper: OPEN_LEDGER not set; nothing to do'); process.exit(0); }
const CHAIN_ID = Number(process.env.OPEN_CHAIN_ID || (isMainnet ? 56 : 97));
const RPC = isMainnet ? process.env.RPC_MAINNET_PRIMARY || 'https://bsc-rpc.publicnode.com' : process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const chain = CHAIN_ID === 56 ? bsc : CHAIN_ID === 97 && !process.env.BSC_TESTNET_RPC_URL?.includes('127.0.0.1') ? bscTestnet
  : defineChain({ id: CHAIN_ID, name: 'local', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const API = process.env.OPEN_API_URL || (isMainnet ? 'https://api.predict.fun' : 'https://api-testnet.predict.fun');
const ABI = JSON.parse(readFileSync('keeper/abi/OpenForecasts_v1.json', 'utf8'));
const CTF_ABI = [parseAbiItem('function payoutDenominator(bytes32) view returns (uint256)')];
const pub = createPublicClient({ chain, transport: http(RPC) });
const logsPub = logsClient(chain, [process.env.LOGS_RPC_URL, isMainnet && process.env.RPC_MAINNET_PRIMARY, isMainnet && process.env.RPC_MAINNET_FALLBACK, !isMainnet && process.env.BSC_TESTNET_RPC_URL].filter(Boolean), [isMainnet ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com']);
const log = (...a) => console.log(new Date().toISOString(), ...a);
const STATE = `${process.env.OPEN_STATE_DIR || 'keeper/state'}/open_${CHAIN_ID}_${LEDGER.toLowerCase()}.json`;
const ARCHIVE = `${process.env.OPEN_STATE_DIR ? process.env.OPEN_STATE_DIR + '/archive' : 'keeper/archive'}/open_${CHAIN_ID}`;
const BASELINE_WINDOW = 120, VOID_WINDOW = 600, REVEAL_WINDOW = 3 * 86400, MAX_SPREAD = 0.1;

function account() {
  if (isMainnet && process.env.OPEN_CONFIRM_MAINNET !== 'yes') throw new Error('mainnet write refused: set OPEN_CONFIRM_MAINNET=yes only after Owais says yes');
  const k = isMainnet ? process.env.OPEN_KEEPER_PRIVATE_KEY : process.env.KEEPER_PRIVATE_KEY;
  if (!k) throw new Error('open keeper key missing');
  return privateKeyToAccount(k);
}
let wallet;
const read = (functionName, args = []) => pub.readContract({ address: LEDGER, abi: ABI, functionName, args });
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
async function api(path) {
  const r = await fetch(API + path, { headers: isMainnet ? { 'x-api-key': process.env.PREDICT_API_KEY } : {}, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Predict.fun ${path.split('?')[0]}: HTTP ${r.status}`);
  return (await r.json()).data;
}

const load = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { lastBlock: String(BigInt(process.env.OPEN_FROM_BLOCK || 0) - 1n), forecasts: {} });
const save = (st) => { mkdirSync(process.env.OPEN_STATE_DIR || 'keeper/state', { recursive: true }); writeFileSync(STATE, JSON.stringify(st)); };
const archive = (name, obj) => { mkdirSync(ARCHIVE, { recursive: true }); writeFileSync(`${ARCHIVE}/${name}.json`, JSON.stringify(obj, null, 1)); };

/** Market price for `slot` from the Yes book, or the reason it cannot count (docs/OPEN_FORECASTS.md). */
export function priceFromBook(book, slot) {
  const bid = Number(book?.bids?.[0]?.[0]), ask = Number(book?.asks?.[0]?.[0]);
  if (!(bid > 0) || !(ask > 0) || ask < bid) return { ok: false, why: 'book not two sided' };
  if (ask - bid > MAX_SPREAD) return { ok: false, why: `spread ${Math.round((ask - bid) * 100)} points` };
  const yes = (bid + ask) / 2;
  return { ok: true, bps: Math.round((slot === 0 ? yes : 1 - yes) * 10000) };
}

async function newCommits(st) {
  const ev = ABI.find((x) => x.type === 'event' && x.name === 'Committed');
  const head = await pub.getBlockNumber();
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
      st.forecasts[id] = { key: l.args.key, forecaster: l.args.forecaster, ctf: l.args.ctf, conditionId: l.args.conditionId, slot: Number(l.args.slot), marketId: String(l.args.marketId), committedAt: Number(b.timestamp), sealed: l.args.sealedCopy, stage: 'new' };
      log(`commit ${l.args.forecaster} market ${l.args.marketId}`);
    }
    st.lastBlock = String(to);
    from = to + 1n;
  }
}

/** Price or void, within the windows. Void only on positive evidence; an API outage never voids (retried next pass). */
async function priceOrVoid(f) {
  const now = Math.floor(Date.now() / 1000);
  let m, cat = null, book = null;
  try {
    m = await api(`/v1/markets/${f.marketId}`);
    cat = m?.categorySlug ? await api(`/v1/categories/${m.categorySlug}`).catch(() => null) : null;
    book = await api(`/v1/markets/${f.marketId}/orderbook`).catch(() => null);
  } catch (e) {
    log(`market ${f.marketId}: Predict.fun not reachable (${e.message}); retrying next pass, never voided for this`);
    return;
  }
  const ends = Date.parse(cat?.tradingSession?.closesAt ?? cat?.endsAt ?? '') / 1000;
  const reason = !m || String(m.conditionId).toLowerCase() !== String(f.conditionId).toLowerCase() ? 3 // the market id does not match the condition
    : Number.isFinite(ends) && f.committedAt >= ends ? 1 // committed at or after the market's end
      : m.tradingStatus && m.tradingStatus !== 'OPEN' ? 2 : 0; // book closed
  archive(`${f.key.slice(2, 14)}_${f.forecaster.toLowerCase()}`, { forecast: { ...f, sealed: undefined }, checkedAt: now, market: m && { id: m.id, conditionId: m.conditionId, tradingStatus: m.tradingStatus, status: m.status }, category: cat && { slug: cat.slug, endsAt: cat.endsAt, tradingSession: cat.tradingSession }, book: book && { bids: book.bids?.slice(0, 3), asks: book.asks?.slice(0, 3), updateTimestampMs: book.updateTimestampMs }, reason });
  if (reason) {
    if (now <= f.committedAt + VOID_WINDOW) { await send('voidForecast', [f.key, f.forecaster, reason]); f.stage = 'void'; } else f.stage = 'priced';
    return;
  }
  const p = priceFromBook(book, f.slot);
  if (p.ok && now <= f.committedAt + BASELINE_WINDOW) await send('setBaseline', [f.key, f.forecaster, p.bps]);
  else log(`market ${f.marketId}: no market price counted (${p.ok ? 'over 120 s' : p.why}); accuracy only`);
  f.stage = 'priced';
}

async function pass() {
  const st = load();
  await newCommits(st);
  const now = Math.floor(Date.now() / 1000);
  const finalized = new Map();
  for (const f of Object.values(st.forecasts)) {
    try {
      if (f.stage === 'new') {
        if (now > f.committedAt + VOID_WINDOW) f.stage = 'priced';
        else await priceOrVoid(f);
      }
      if (f.stage === 'void' || f.stage === 'done') continue;
      let resolvedAt = finalized.get(f.key) ?? Number((await read('markets', [f.key]))[0]);
      if (!resolvedAt) {
        const den = await pub.readContract({ address: f.ctf, abi: CTF_ABI, functionName: 'payoutDenominator', args: [f.conditionId] });
        if (den === 0n) continue; // market still open: nothing more yet
        await send('finalize', [f.ctf, f.conditionId]);
        resolvedAt = Number((await read('markets', [f.key]))[0]);
      }
      finalized.set(f.key, resolvedAt);
      const [hash, , , flags] = await read('forecasts', [f.key, f.forecaster]);
      if (flags & 2 || flags & 8) { f.stage = 'done'; continue; }
      if (!(flags & 1) && f.sealed && f.sealed !== '0x' && now <= resolvedAt + REVEAL_WINDOW) {
        const ct = ciphertextOf(f.sealed);
        if (ct) {
          try {
            const { packed, salt } = await openSealed(ct);
            if ((await read('computeCommitHash', [f.ctf, f.conditionId, f.slot, f.forecaster, Number(packed), salt])) === hash) {
              await send('revealFor', [f.key, f.forecaster, Number(packed), salt, f.ctf, f.conditionId]);
            } else log(`market ${f.marketId} ${f.forecaster}: sealed copy does not match the commit; not revealed`);
          } catch (e) { if (!/too early/i.test(e.message)) await alert(`reveal ${f.marketId} ${f.forecaster}: ${e.message}`); }
        }
      }
      const flags2 = Number((await read('forecasts', [f.key, f.forecaster]))[3]);
      if (flags2 & 1 || now > resolvedAt + REVEAL_WINDOW) { await send('score', [f.key, f.forecaster]); f.stage = 'done'; }
    } catch (e) {
      await alert(`market ${f.marketId} ${f.forecaster}: ${(e.shortMessage || e.message).split(String.fromCharCode(10))[0]}`);
    }
  }
  save(st);
}

if (import.meta.filename === process.argv[1]) {
  const end = Date.now() + Number(process.env.OPEN_LOOP_MINUTES || 330) * 60_000;
  do {
    try { await pass(); } catch (e) { await alert(`pass failed: ${(e.shortMessage || e.message).split(String.fromCharCode(10))[0]}`); }
    if (process.env.OPEN_ONCE === '1') break;
    await new Promise((r) => setTimeout(r, Number(process.env.OPEN_PASS_SECONDS || 10) * 1000));
  } while (Date.now() < end);
}
