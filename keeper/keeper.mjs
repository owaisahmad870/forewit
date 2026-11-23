// Forewit keeper (milestone 2). One command per duty in docs/KEEPER.md.
// Run from the repo root: node --env-file=.env keeper/keeper.mjs <command> --network testnet|mainnet [options]
//   select    --commit-deadline <iso> [--kind daily|long]   apply docs/QUESTION_SELECTION.md v3, archive raw API data and output
//   open      --selection <file> [--resolution-days 7] [--reveal-hours 24]   createRound only (no baseline yet)
//   baseline  [--round <id>]                         snapshot books and setBaseline in clear; only in the last 15 minutes before the deadline
//   seal      [--round <id>]                         sealRound right after the deadline (alerts if no baseline was set)
//   finalize  --round <id>                           finalize every question resolved onchain; voidStale when allowed
//   score     --round <id>                           scoreBatch and forfeitBatch over every committer (from logs)
//   status    --round <id>
// Mainnet writes refuse to run unless LEDGER_MAINNET is set and KEEPER_CONFIRM_MAINNET=yes (Owais's per action yes).
// Keys never print. Baseline salts are stored with agent/lib/secure_file.mjs before any commit transaction.
import { createPublicClient, createWalletClient, http, fallback, keccak256, toHex, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { takeBaseline } from './lib/baseline.mjs';
import * as sel from './lib/selection.mjs';

const args = Object.fromEntries(process.argv.slice(3).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? 'true' : arr[i + 1]]] : a), []));
const cmd = process.argv[2];
const NET = {
  testnet: { chain: bscTestnet, rpc: process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com', ledger: process.env.LEDGER_TESTNET, api: 'https://api-testnet.predict.fun', ctfs: { std: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743', yb: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f', ybnr: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5' } },
  mainnet: { chain: bsc, rpc: process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com', ledger: process.env.LEDGER_MAINNET, api: 'https://api.predict.fun', ctfs: { std: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', yb: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', ybnr: '0xF64b0b318AAf83BD9071110af24D24445719A07F' } },
}[args.network || 'testnet'];
if (!NET) throw new Error('--network must be testnet or mainnet');
const isMainnet = NET.chain.id === 56;
// two RPC endpoints: the configured one first, publicnode as fallback (the baseline has a 15 minute window)
const SECOND_RPC = isMainnet ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com';
const transport = () => (NET.rpc === SECOND_RPC ? http(NET.rpc) : fallback([http(NET.rpc), http(SECOND_RPC)]));
const pub = createPublicClient({ chain: NET.chain, transport: transport() });
// event logs need an RPC that serves eth_getLogs ranges (the bnbchain dataseed endpoints refuse them); override with LOGS_RPC_URL
const logsPub = createPublicClient({ chain: NET.chain, transport: http(process.env.LOGS_RPC_URL || (isMainnet ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com')) });
// committed ABI so the keeper host needs no Foundry; CI fails if it drifts from contracts/out
const ABI = JSON.parse(readFileSync(process.env.KEEPER_ABI || 'keeper/abi/ForecastLedger_v1_2.json', 'utf8'));
const CTF_ABI = [parseAbiItem('function getOutcomeSlotCount(bytes32) view returns (uint256)'), parseAbiItem('function payoutDenominator(bytes32) view returns (uint256)')];
const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function alert(msg) {
  log('ALERT', msg);
  const { TELEGRAM_BOT_TOKEN: tg, TELEGRAM_CHAT_ID: chat } = process.env;
  if (tg && chat) await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: `Forewit keeper (${args.network || 'testnet'}): ${msg}` }) }).catch(() => log('telegram alert failed'));
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
async function send(fn, a, { tries = 4 } = {}) {
  const account = keeperAccount();
  const w = createWalletClient({ account, chain: NET.chain, transport: transport() });
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
  const picks = raw
    .filter((m) => sel.eligible(m, cats[m.categorySlug], cd, kind))
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
  const out = { rule: sel.RULE, kind, commitDeadline: new Date(cd).toISOString(), resolutionDays: kind === 'long' ? 120 : 7, eligible: picks.length, chosen };
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
  const before = await read('roundCount');
  await send('createRound', [qs, cd, rd, wait]);
  const roundId = before + 1n;
  mkdirSync('keeper/state', { recursive: true });
  writeFileSync(`keeper/state/round_${NET.chain.id}_${roundId}.json`, JSON.stringify({ roundId, commitDeadline: sel.commitDeadline, marketIds: sel.chosen.map((c) => c.marketId) }, big, 2));
  // public round file (data contract for the CLI and site): every question carries its parent event question and label
  const { presentQuestion } = await import('../agent/lib/question.mjs');
  const pubDir = `keeper/archive/${args.network || 'testnet'}/rounds`;
  mkdirSync(pubDir, { recursive: true });
  const questions = sel.chosen.map((c, i) => ({ index: i, marketId: String(c.marketId), conditionId: c.conditionId, ctf: c.ctf, eventQuestion: c.eventQuestion, label: c.label, marketQuestion: c.marketQuestion ?? null, endsAt: c.endsAt ?? null, tags: c.tags ?? [] }));
  questions.forEach((q) => presentQuestion(q)); // refuse to publish a question without its event question
  writeFileSync(`${pubDir}/${roundId}.json`, JSON.stringify({ network: NET.chain.id, ledger: NET.ledger, roundId, kind: sel.kind ?? 'daily', rule: sel.rule, commitDeadline: sel.commitDeadline, revealDeadline: new Date(Number(rd) * 1000).toISOString(), resolutionWaitSeconds: wait, questions }, big, 2));
  log(`round ${roundId} open; run "baseline --round ${roundId}" in the last 15 minutes before ${sel.commitDeadline} (target 5)`);
}

async function baseline(rIn) {
  const r = rIn ?? (await roundArg());
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
  await send('setBaseline', [r, snap.packed], { tries: 5 });
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
  if (!round.baselineSet) await alert(`round ${r}: no baseline was set before the deadline; the round scores with skill 0`);
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
      await send('voidStale', [r, BigInt(i)]);
    }
  }
}

async function roundArg() {
  return args.round === undefined || args.round === 'latest' ? await read('roundCount') : BigInt(args.round);
}

async function committers(r) {
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

/** Every 15 minutes: seal and reveal the baseline, finalize, score, over the recent rounds. */
async function tick() {
  const count = await read('roundCount');
  const now = BigInt(Math.floor(Date.now() / 1000));
  for (let r = count > 14n ? count - 14n : 1n; r <= count; r++) {
    const round = await read('getRound', [r]);
    if (now < round.commitDeadline) continue;
    if (!round.isSealed) await seal(r);
    await finalize(r);
    await score(r);
  }
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
  for (let r = count > 14n ? count - 14n : 1n; r <= count && count > 0n; r++) {
    const round = await read('getRound', [r]);
    const qs = await read('getQuestions', [r]);
    let onchain = 0;
    for (let i = 0; i < qs.length; i++) {
      const den = await pub.readContract({ address: qs[i].ctf, abi: [CTF_ABI[1]], functionName: 'payoutDenominator', args: [qs[i].conditionId] });
      if (den > 0n) onchain |= 1 << i;
    }
    let unprocessed = 0;
    if (BigInt(now) > round.revealDeadline) for (const a of await committers(r)) if (((await read('flags', [r, a])) & 6) === 0) unprocessed++;
    for (const m of missedDuties({ round, resolvedOnchainMask: onchain, unprocessed, now })) missed.push(`round ${r} ${m}`);
    if (r === count) missed.push(...dailyOpenMissed(round.createdAt, now));
  }
  if (!missed.length) return log('watchdog: all duties on schedule');
  for (const m of missed) await alert(`MISSED ${m}`);
  process.exitCode = 1;
}

const cmds = { select, open, baseline, seal, finalize, score, tick, daily, watchdog, status: async () => log(JSON.stringify(await read('getRound', [BigInt(args.round)]), big)) };
if (!cmds[cmd]) {
  console.log('usage: select | open | baseline | seal | finalize | score | tick | daily | watchdog | status  (--network testnet|mainnet)');
  process.exit(1);
}
const hc = process.env[`HC_PING_${cmd.toUpperCase()}`];
try {
  await cmds[cmd]();
  // publish real data to the site after every state changing job (needs the ledger's deploy block; PUBLISH=0 disables)
  const fromBlock = process.env[`INDEXER_FROM_BLOCK_${isMainnet ? 'MAINNET' : 'TESTNET'}`];
  if (['open', 'baseline', 'seal', 'finalize', 'score', 'tick', 'daily'].includes(cmd) && process.env.PUBLISH !== '0' && fromBlock) {
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
