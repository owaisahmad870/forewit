// PRESCIENT keeper (milestone 2). One command per duty in docs/KEEPER.md.
// Run from the repo root: node --env-file=.env keeper/keeper.mjs <command> --network testnet|mainnet [options]
//   select    --commit-deadline <iso> [--max 8]     apply docs/QUESTION_SELECTION.md v2, archive raw API data and output
//   open      --selection <file> [--resolution-days 7] [--reveal-hours 24]   createRound only (no baseline yet)
//   baseline  --round <id>                           snapshot books and commitBaseline; only in the last 5 minutes before the commit deadline
//   seal      --round <id>                           sealRound and revealBaseline, with retries and alerting
//   finalize  --round <id>                           finalize every question resolved onchain; voidStale when allowed
//   score     --round <id>                           scoreBatch and forfeitBatch over every committer (from logs)
//   status    --round <id>
// Mainnet writes refuse to run unless LEDGER_MAINNET is set and KEEPER_CONFIRM_MAINNET=yes (Owais's per action yes).
// Keys never print. Baseline salts are stored with agent/lib/secure_file.mjs before any commit transaction.
import { createPublicClient, createWalletClient, http, keccak256, toHex, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { takeBaseline, snapshotTimeOk } from './lib/baseline.mjs';

const args = Object.fromEntries(process.argv.slice(3).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? 'true' : arr[i + 1]]] : a), []));
const cmd = process.argv[2];
const NET = {
  testnet: { chain: bscTestnet, rpc: process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com', ledger: process.env.LEDGER_TESTNET, api: 'https://api-testnet.predict.fun', ctfs: { std: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743', yb: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f', ybnr: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5' } },
  mainnet: { chain: bsc, rpc: process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com', ledger: process.env.LEDGER_MAINNET, api: 'https://api.predict.fun', ctfs: { std: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', yb: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', ybnr: '0xF64b0b318AAf83BD9071110af24D24445719A07F' } },
}[args.network || 'testnet'];
if (!NET) throw new Error('--network must be testnet or mainnet');
const isMainnet = NET.chain.id === 56;
const pub = createPublicClient({ chain: NET.chain, transport: http(NET.rpc) });
const ABI = JSON.parse(readFileSync('contracts/out/ForecastLedger.sol/ForecastLedger.json', 'utf8')).abi;
const CTF_ABI = [parseAbiItem('function getOutcomeSlotCount(bytes32) view returns (uint256)'), parseAbiItem('function payoutDenominator(bytes32) view returns (uint256)')];
const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function alert(msg) {
  log('ALERT', msg);
  if (process.env.ALERT_WEBHOOK_URL) await fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `PRESCIENT keeper: ${msg}` }) }).catch(() => log('alert webhook failed'));
}

function keeperAccount() {
  if (isMainnet && process.env.KEEPER_CONFIRM_MAINNET !== 'yes') throw new Error('mainnet write refused: set KEEPER_CONFIRM_MAINNET=yes only after Owais says yes');
  const k = isMainnet ? process.env.MAINNET_KEEPER_PRIVATE_KEY : process.env.KEEPER_PRIVATE_KEY;
  if (!k) throw new Error('keeper key missing');
  return privateKeyToAccount(k);
}

async function ledger() {
  if (!NET.ledger) throw new Error(`ledger address missing: set LEDGER_${isMainnet ? 'MAINNET' : 'TESTNET'}`);
  if ((await pub.getChainId()) !== NET.chain.id) throw new Error('RPC chain id mismatch; refusing');
  return NET.ledger;
}
const read = async (fn, a = []) => pub.readContract({ address: await ledger(), abi: ABI, functionName: fn, args: a });

/** Simulate, send, wait; retry up to `tries` with backoff; never resend after a mined revert. */
async function send(fn, a, { tries = 4 } = {}) {
  const account = keeperAccount();
  const w = createWalletClient({ account, chain: NET.chain, transport: http(NET.rpc) });
  for (let i = 1; ; i++) {
    try {
      const { request } = await pub.simulateContract({ account, address: await ledger(), abi: ABI, functionName: fn, args: a });
      const hash = await w.writeContract(request);
      const rc = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (rc.status !== 'success') throw Object.assign(new Error(`${fn} reverted ${hash}`), { mined: true });
      log(fn, hash, 'gas', rc.gasUsed);
      return rc;
    } catch (e) {
      const msg = (e.shortMessage || e.message).split('\n')[0];
      if (e.mined || i >= tries || /revert/i.test(msg)) { await alert(`${fn} failed (attempt ${i}): ${msg}`); throw e; }
      log(`${fn} attempt ${i} failed: ${msg}; retrying`);
      await new Promise((r) => setTimeout(r, 5000 * 2 ** i));
    }
  }
}

// Selection rule v2 (docs/QUESTION_SELECTION.md): 6 to 72 h after the deadline, at most 3 crypto Up/Down questions
const CAP = Date.parse('2026-12-08T00:00:00Z');
function ctfFor(m) {
  if (!m.isYieldBearing) return NET.ctfs.std;
  return m.isNegRisk ? NET.ctfs.ybnr : NET.ctfs.yb;
}
async function apiGet(p) {
  const r = await fetch(NET.api + p, { headers: isMainnet ? { 'x-api-key': process.env.PREDICT_API_KEY } : {} });
  if (!r.ok) throw new Error(`API ${p.split('?')[0]} HTTP ${r.status}`);
  return r.json();
}

async function select() {
  const cd = Date.parse(args['commit-deadline']);
  if (!cd) throw new Error('--commit-deadline <iso> required');
  const max = Number(args.max || 8), minVol = Number(args['min-volume'] || 100), maxCrypto = 3;
  const raw = [];
  let cur = '';
  for (let i = 0; i < 200; i++) {
    const j = await apiGet('/v1/markets?status=OPEN&first=100&includeStats=true' + (cur ? '&after=' + cur : ''));
    raw.push(...j.data);
    cur = j.cursor;
    if (!cur) break;
  }
  const cats = {};
  // fetch categories (the only end time source) only for markets that can pass the cheap filters: 250 requests per minute
  const cheap = (m) => { const [x, y] = m.outcomes; if (!(m.outcomes.length === 2 && x.indexSet === 1 && y.indexSet === 2 && /^(Yes|Up)$/.test(x.name) && /^(No|Down)$/.test(y.name))) return false; if (m.marketVariant === 'CRYPTO_UP_DOWN' || m.marketVariant === 'UP_DOWN') return true; return x.bestBid && x.bestAsk && x.bestAsk.price - x.bestBid.price <= 0.1 && (m.stats?.volume24hUsd ?? 0) >= minVol; };
  for (const s of new Set(raw.filter(cheap).map((m) => m.categorySlug))) cats[s] = (await apiGet('/v1/categories/' + s)).data;
  const picks = [];
  for (const m of raw) {
    const end = Date.parse(cats[m.categorySlug]?.endsAt ?? '');
    const h = (end - cd) / 3.6e6;
    if (!(h >= 6 && h <= 72 && end <= CAP)) continue;
    const [a, b] = m.outcomes;
    if (!(m.outcomes.length === 2 && a.indexSet === 1 && b.indexSet === 2 && /^(Yes|Up)$/.test(a.name) && /^(No|Down)$/.test(b.name))) continue;
    const crypto = m.marketVariant === 'CRYPTO_UP_DOWN' || m.marketVariant === 'UP_DOWN';
    // crypto Up/Down markets are exempt from the book and volume filters: their measured window often starts after selection
    if (!crypto) {
      if (!(a.bestBid && a.bestAsk) || a.bestAsk.price - a.bestBid.price > 0.1) continue;
      if ((m.stats?.volume24hUsd ?? 0) < minVol) continue;
    }
    picks.push({ marketId: m.id, conditionId: m.conditionId, ctf: ctfFor(m), category: m.categorySlug, endsAt: cats[m.categorySlug].endsAt, title: m.title, crypto, daily: crypto && /Up or Down on /.test(m.title), vol24h: m.stats?.volume24hUsd ?? 0 });
  }
  // one market per event; daily crypto first (at most 3 crypto), then the most traded; then chain checks
  picks.sort((x, y) => (y.daily - x.daily) || (y.vol24h - x.vol24h));
  const chosen = [], seen = new Set();
  for (const p of picks) {
    if (chosen.length >= max || seen.has(p.category)) continue;
    if (p.crypto && chosen.filter((c) => c.crypto).length >= maxCrypto) continue;
    const [slots, den] = await Promise.all(CTF_ABI.map((f) => pub.readContract({ address: p.ctf, abi: [f], functionName: f.name, args: [p.conditionId] })));
    if (slots !== 2n || den !== 0n) continue;
    seen.add(p.category);
    chosen.push(p);
  }
  const dir = `keeper/archive/${args.network || 'testnet'}/${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/markets_raw.json`, JSON.stringify({ fetchedAt: new Date().toISOString(), markets: raw, categories: cats }));
  const out = { rule: 'QUESTION_SELECTION v2', commitDeadline: new Date(cd).toISOString(), eligible: picks.length, chosen };
  writeFileSync(`${dir}/selection.json`, JSON.stringify(out, null, 2));
  log(`selection: ${picks.length} eligible, ${chosen.length} chosen; archived in ${dir}`);
  if (chosen.length < 5) await alert(`only ${chosen.length} questions pass rule v2 (need 5)`);
  return out;
}

async function open() {
  const sel = JSON.parse(readFileSync(args.selection, 'utf8'));
  const cd = BigInt(Math.floor(Date.parse(sel.commitDeadline) / 1000));
  const rd = cd + BigInt(Math.round(Number(args['reveal-hours'] || 24) * 3600));
  const wait = BigInt(Math.round(Number(args['resolution-days'] || 7) * 86400));
  const qs = sel.chosen.map((c) => ({ conditionId: c.conditionId, ctf: c.ctf, yesSlot: 0, marketId: BigInt(c.marketId) }));
  const before = await read('roundCount');
  await send('createRound', [qs, cd, rd, wait]);
  const roundId = before + 1n;
  mkdirSync('keeper/state', { recursive: true });
  writeFileSync(`keeper/state/round_${NET.chain.id}_${roundId}.json`, JSON.stringify({ roundId, commitDeadline: sel.commitDeadline, marketIds: sel.chosen.map((c) => c.marketId) }, big, 2));
  log(`round ${roundId} open; run "baseline --round ${roundId}" in the 5 minutes before ${sel.commitDeadline}`);
}

async function baseline() {
  const r = BigInt(args.round);
  const round = await read('getRound', [r]);
  const deadlineMs = Number(round.commitDeadline) * 1000;
  const meta = JSON.parse(readFileSync(`keeper/state/round_${NET.chain.id}_${r}.json`, 'utf8'));
  const snap = await takeBaseline({ deadlineMs, marketIds: meta.marketIds, fetchBook: async (id) => (await apiGet(`/v1/markets/${id}/orderbook`)).data });
  for (const bk of snap.books) if (bk.source !== 'mid') await alert(`round ${r} market ${bk.marketId}: baseline from ${bk.source}, not a two sided mid`);
  const salt = '0x' + randomBytes(32).toString('hex');
  const { writeSecretFile } = await import('../agent/lib/secure_file.mjs');
  writeSecretFile(`keeper/state/baseline_${NET.chain.id}_${r}.json`, JSON.stringify({ roundId: r, packed: snap.packed, salt, takenAtStart: snap.takenAtStart, takenAtEnd: snap.takenAtEnd, deadlineMs }, big));
  const dir = `keeper/archive/${args.network || 'testnet'}/round_${r}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/baseline_books.json`, JSON.stringify(snap.books, big, 2)); // public archive; the salt stays private
  const base = await read('BASELINE');
  await send('commitBaseline', [r, await read('computeCommitHash', [r, base, snap.packed, salt])]);
  log(`round ${r} baseline committed ${Math.round((deadlineMs - snap.takenAtEnd) / 1000)} s before the deadline`);
}

async function seal() {
  const r = BigInt(args.round);
  const round = await read('getRound', [r]);
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < round.commitDeadline) throw new Error('commit window still open');
  if (!round.isSealed) await send('sealRound', [r]);
  if (!round.baselineRevealed) {
    const f = `keeper/state/baseline_${NET.chain.id}_${r}.json`;
    if (!existsSync(f)) return alert(`round ${r}: baseline salt file missing, cannot reveal baseline`);
    const s = JSON.parse(readFileSync(f, 'utf8'));
    if (!snapshotTimeOk(s.takenAtEnd, Number(round.commitDeadline) * 1000)) await alert(`round ${r}: stored baseline was not taken in the last 5 minutes before the deadline`);
    if (now > round.revealDeadline - 12n * 3600n) await alert(`round ${r}: baseline still unrevealed within 12 h of the reveal deadline`);
    await send('revealBaseline', [r, BigInt(s.packed), s.salt], { tries: 6 });
  }
  log(`round ${r} sealed and baseline revealed`);
}

async function finalize() {
  const r = BigInt(args.round);
  const round = await read('getRound', [r]);
  const qs = await read('getQuestions', [r]);
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let i = 0; i < qs.length; i++) {
    if ((round.resolvedMask >> i) & 1) continue;
    const den = await pub.readContract({ address: qs[i].ctf, abi: [CTF_ABI[1]], functionName: 'payoutDenominator', args: [qs[i].conditionId] });
    if (den > 0n) await send('finalizeQuestion', [r, BigInt(i)]);
    else if (now > round.revealDeadline + (await read('MAX_RESOLUTION_WAIT'))) await send('voidStale', [r, BigInt(i)]);
  }
}

async function committers(r) {
  const ev = ABI.find((x) => x.type === 'event' && x.name === 'Committed');
  const head = await pub.getBlockNumber();
  const created = (await read('getRound', [r])).createdAt;
  const out = new Set();
  // walk back in 5000 block windows until before the round was created (0.45 s blocks)
  for (let to = head; to > 0n; to -= 5000n) {
    const from = to > 4999n ? to - 4999n : 0n;
    const logs = await pub.getLogs({ address: await ledger(), event: ev, args: { roundId: r }, fromBlock: from, toBlock: to });
    for (const l of logs) out.add(l.args.forecaster);
    const blk = await pub.getBlock({ blockNumber: from });
    if (blk.timestamp < created) break;
  }
  return [...out];
}

async function score() {
  const r = BigInt(args.round);
  const all = await committers(r);
  log(`round ${r}: ${all.length} committers`);
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    await send('scoreBatch', [r, chunk]);
    await send('forfeitBatch', [r, chunk]);
  }
}

const cmds = { select, open, baseline, seal, finalize, score, status: async () => log(JSON.stringify(await read('getRound', [BigInt(args.round)]), big)) };
if (!cmds[cmd]) {
  console.log('usage: select | open | baseline | seal | finalize | score | status  (--network testnet|mainnet)');
  process.exit(1);
}
await cmds[cmd]();
