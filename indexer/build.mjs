// Forewit indexer v1: rebuilds rounds, revealed forecasts, scores, public profiles, the Agent ID Crowd (docs/CROWD.md)
// and daily metrics from ForecastLedger events only. Anyone can rerun it from chain data:
//   node indexer/build.mjs --network testnet|mainnet --ledger <address> --from-block <n> [--abi <file>] [--rpc <url>]
// Writes indexer/out/<network>/<ledger>/snapshot.json. Logs are cached per ledger so reruns only fetch new blocks.
import { parseAbi, keccak256, toHex } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { crowdV1, METHOD } from './lib/crowd.mjs';
import { roundFlags, roleHolders, operators, commitTiming } from './lib/flags.mjs';
import { logsClient } from './lib/logs.mjs';

const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const unpack = (packed, n) => Array.from({ length: n }, (_, i) => Number((BigInt(packed) >> BigInt(16 * i)) & 0xffffn));

// /proof: each forecaster's first Committed log (logs in chain order), lowercased address to {tx, roundId, block}
export function firstCommits(logs) {
  const out = {};
  for (const l of logs) if (l.eventName === 'Committed') out[l.args.forecaster.toLowerCase()] ??= { tx: l.transactionHash ?? null, roundId: String(l.args.roundId), block: String(l.blockNumber) };
  return out;
}

// /proof admin log: every role, pause and admin seat change, in chain order, so anyone can see what the team did
const ADMIN_EVENTS = new Set(['RoleGranted', 'RoleRevoked', 'RoleAdminChanged', 'Paused', 'Unpaused', 'DefaultAdminTransferScheduled', 'DefaultAdminTransferCanceled', 'DefaultAdminDelayChangeScheduled', 'DefaultAdminDelayChangeCanceled']);
const ROLE_NAMES = Object.fromEntries([['DEFAULT_ADMIN', `0x${'0'.repeat(64)}`], ...['ROUND_MANAGER_ROLE', 'PAUSER_ROLE'].map((r) => [r.replace(/_ROLE$/, ''), keccak256(toHex(r))])].map(([n, h]) => [h, n]));
export function adminLog(logs) {
  return logs.filter((l) => ADMIN_EVENTS.has(l.eventName)).map((l) => {
    const a = l.args ?? {};
    return {
      event: l.eventName, block: String(l.blockNumber), tx: l.transactionHash ?? null,
      ...(a.role !== undefined && { role: ROLE_NAMES[a.role] ?? a.role }),
      ...(a.account && { account: a.account.toLowerCase() }),
      ...(a.sender && { by: a.sender.toLowerCase() }),
      ...(a.newAdmin && { newAdmin: a.newAdmin.toLowerCase() }),
      ...(a.acceptSchedule !== undefined && { acceptAt: String(a.acceptSchedule) }),
    };
  });
}

export async function buildSnapshot({ network = 'testnet', ledger, fromBlock, abiPath, rpc }) {
  const chain = network === 'mainnet' ? bsc : bscTestnet;
  // eth_getLogs ranges need a capable RPC (the bnbchain dataseed endpoints refuse them)
  // rpc: one URL or a list of keyed URLs; logs are merged across them and publicnode, never read from one provider alone
  const pub = logsClient(chain, [rpc].flat(), [chain.id === 56 ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com']);
  if (!ledger || fromBlock === undefined) throw new Error('ledger and fromBlock are required');
  // older testnet instances need their own ABI: keeper/abi/ForecastLedger_v1.json or _v1_1.json
  const ABI = JSON.parse(readFileSync(abiPath || 'keeper/abi/ForecastLedger_v1_2.json', 'utf8'));
  const events = ABI.filter((x) => x.type === 'event');
  const dir = `indexer/out/${network}/${ledger}`;
  mkdirSync(dir, { recursive: true });

  // incremental log cache: {lastBlock, logs:[{eventName, blockNumber, args}], blockTimes:{block: ts}}
  const cacheFile = `${dir}/logs_cache.json`;
  let cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null;
  // caches written before transactionHash was kept are refetched once from fromBlock so /proof gets every commit tx
  // v2: caches built from a single provider may miss logs (publicnode returned empty lists), so the range is rescanned
  // once and merged with what the cache already holds: a rescan can add logs, never drop them
  if (!cache || cache.v !== 2 || cache.logs.some((l) => l.eventName === 'Committed' && !l.transactionHash)) {
    const keep = (cache?.logs ?? []).filter((l) => l.transactionHash);
    cache = { v: 2, lastBlock: String(BigInt(fromBlock) - 1n), logs: keep, blockTimes: cache?.blockTimes ?? {} };
  }
  const seenLog = new Set(cache.logs.map((l) => `${l.transactionHash}:${l.logIndex}`));
  const head = await pub.getBlockNumber();
  let span = 5000n;
  for (let from = BigInt(cache.lastBlock) + 1n; from <= head; ) {
    const to = from + span - 1n > head ? head : from + span - 1n;
    let got;
    try {
      got = await pub.getLogs({ address: ledger, events, fromBlock: from, toBlock: to });
    } catch (e) {
      if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
      throw e;
    }
    for (const l of got) if (!seenLog.has(`${l.transactionHash}:${l.logIndex}`)) seenLog.add(`${l.transactionHash}:${l.logIndex}`), cache.logs.push(JSON.parse(JSON.stringify({ eventName: l.eventName, blockNumber: l.blockNumber, logIndex: l.logIndex, transactionHash: l.transactionHash, args: l.args }, big)));
    cache.lastBlock = String(to);
    from = to + 1n;
  }
  cache.logs.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || a.logIndex - b.logIndex); // merged logs replay in chain order
  const needTime = cache.logs.filter((l) => ['Committed', 'Revealed', 'Scored', 'Forfeited', 'BaselineSet'].includes(l.eventName));
  for (const l of needTime) cache.blockTimes[l.blockNumber] ??= String((await pub.getBlock({ blockNumber: BigInt(l.blockNumber) })).timestamp);
  writeFileSync(cacheFile, JSON.stringify(cache));
  const ts = (l) => Number(cache.blockTimes[l.blockNumber]);

  const rounds = {};
  const R = (id) => (rounds[id] ??= { roundId: String(id), questions: [], committers: new Set(), revealed: new Set(), forecasts: {}, scored: {}, forfeited: {}, outcomes: {}, baseline: null });
  const days = {};
  const profileEv = {};
  const outcomeNames = ['Unresolved', 'Yes', 'No', 'Void'];
  for (const l of cache.logs) {
    const a = l.args;
    if (l.eventName === 'RoundCreated') Object.assign(R(a.roundId), { commitDeadline: a.commitDeadline, revealDeadline: a.revealDeadline, resolutionWait: a.resolutionWait ?? null, questions: a.questions, createdBlock: l.blockNumber });
    if (l.eventName === 'Committed') { R(a.roundId).committers.add(a.forecaster.toLowerCase()); (R(a.roundId).commitLog ??= []).push({ forecaster: a.forecaster, at: ts(l) }); }
    if (l.eventName === 'BaselineSet') R(a.roundId).baselineAt = ts(l);
    if (l.eventName === 'Revealed') { R(a.roundId).revealed.add(a.forecaster.toLowerCase()); R(a.roundId).forecasts[a.forecaster.toLowerCase()] = a.packed; }
    if (l.eventName === 'BaselineSet' || l.eventName === 'BaselineRevealed') R(a.roundId).baseline = a.packed; // v1.2 posts in clear; v1.1 revealed
    if (l.eventName === 'QuestionFinalized') R(a.roundId).outcomes[a.index] = outcomeNames[Number(a.outcome)];
    if (l.eventName === 'Scored' || l.eventName === 'Forfeited') {
      const rec = { questions: a.questions, brier: a.brierSum, baseline: a.baselineBrierSum, skill: a.skillSum, baselineUsed: a.baselineUsed, at: ts(l) };
      R(a.roundId)[l.eventName === 'Scored' ? 'scored' : 'forfeited'][a.forecaster.toLowerCase()] = rec;
    }
    if (l.eventName === 'ProfileUpdated') profileEv[a.forecaster.toLowerCase()] = { isPublic: a.isPublic, labelId: a.labelId };
    if (l.eventName === 'Committed' || l.eventName === 'Revealed') {
      const d = new Date(ts(l) * 1000).toISOString().slice(0, 10);
      (days[d] ??= { commits: 0, reveals: 0 })[l.eventName === 'Committed' ? 'commits' : 'reveals']++;
    }
  }

  const agentIdAddr = await pub.readContract({ address: ledger, abi: ABI, functionName: 'AGENT_ID' }).catch(() => null);
  // Agent ID Crowd v1: prior records only from scores recorded before each round's commit deadline (no look ahead)
  const scoreEvents = Object.values(rounds).flatMap((r) => [...Object.entries(r.scored), ...Object.entries(r.forfeited)].map(([f, s]) => ({ f, round: r.roundId, ...s })));
  for (const r of Object.values(rounds)) {
    const n = r.questions.length;
    const who = Object.keys(r.forecasts);
    if (!n || !who.length) { r.crowd = null; continue; }
    const records = who.map((f) => {
      const prior = scoreEvents.filter((e) => e.f === f && e.at < Number(r.commitDeadline));
      const used = prior.filter((e) => e.baselineUsed);
      return { rounds: new Set(prior.map((e) => e.round)).size, sumSkill: used.reduce((s, e) => s + Number(e.skill), 0), baselineQuestions: used.reduce((s, e) => s + Number(e.questions), 0) };
    });
    const c = crowdV1(who.map((f) => unpack(r.forecasts[f], n)), records, n);
    r.crowd = { method: METHOD, bps: c.bps, simpleBps: c.simpleBps };
  }

  // public profiles: the contract stores only labelId = keccak256(label); show a name only while ownerOf still matches
  const profiles = {};
  const AID = parseAbi(['function ownerOf(uint256) view returns (address)', 'function tokenURI(uint256) view returns (string)']);
  for (const [f, p] of Object.entries(profileEv)) {
    if (!p.isPublic) continue; // opted out: never shown (red line 9)
    const prof = { isPublic: true };
    if (agentIdAddr && BigInt(p.labelId) !== 0n) {
      const owner = await pub.readContract({ address: agentIdAddr, abi: AID, functionName: 'ownerOf', args: [BigInt(p.labelId)] }).catch(() => null);
      const uri = owner && owner.toLowerCase() === f ? await pub.readContract({ address: agentIdAddr, abi: AID, functionName: 'tokenURI', args: [BigInt(p.labelId)] }).catch(() => null) : null;
      const label = uri ? decodeURIComponent(uri.split('/').pop().replace(/\.json$/, '')) : null;
      if (label && /^[\p{L}\p{N}_]{1,64}$/u.test(label)) prof.name = `${label}.ai`;
    }
    profiles[f] = prof;
  }

  // review mitigations: flags per round, operators off the leaderboard (L1), Agent ID moves after committing (L2, L3)
  const headTime = Number((await pub.getBlock({ blockNumber: head })).timestamp);
  for (const r of Object.values(rounds)) {
    r.flags = roundFlags(r, headTime);
    r.commitTiming = commitTiming(r.commitLog ?? [], r.baselineAt ?? null); // before or after the baseline post, gap in seconds
    delete r.commitLog;
  }
  const ops = operators(roleHolders(cache.logs.filter((l) => l.eventName === 'RoleGranted' || l.eventName === 'RoleRevoked').map((l) => ({ eventName: l.eventName, role: l.args.role, account: l.args.account }))));
  const allCommitters = new Set(Object.values(rounds).flatMap((r) => [...r.committers]));
  const identityChanged = {};
  if (agentIdAddr && allCommitters.size) {
    const transfer = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'])[0];
    const from = [...allCommitters];
    for (let a = BigInt(fromBlock); a <= head; a += 5000n) {
      const b = a + 4999n > head ? head : a + 4999n;
      const moved = await pub.getLogs({ address: agentIdAddr, event: transfer, args: { from }, fromBlock: a, toBlock: b }).catch(() => []);
      for (const t of moved) identityChanged[t.args.from.toLowerCase()] = { tokenId: String(t.args.tokenId), to: t.args.to.toLowerCase(), block: String(t.blockNumber) };
    }
  }
  const out = {
    network: chain.id, ledger, builtAt: new Date().toISOString(), headBlock: head,
    metrics: { distinctCommitters: allCommitters.size, rounds: Object.keys(rounds).length, perDay: days },
    rounds: Object.values(rounds).map((r) => ({
      ...r,
      committers: [...r.committers],
      revealed: [...r.revealed],
      commitCount: r.committers.size,
      revealRate: r.committers.size ? r.revealed.size / r.committers.size : null,
    })),
    profiles,
    operators: ops, // round manager, admin and pauser wallets: never ranked
    identityChanged, // committers whose Agent ID left their wallet after the ledger went live
    agentId: agentIdAddr, // the Agent ID contract the ledger gates on (null if unreadable)
    firstCommits: firstCommits(cache.logs), // /proof: first commit tx per distinct committer
    adminLog: adminLog(cache.logs), // /proof: role, pause and admin seat changes
  };
  writeFileSync(`${dir}/snapshot.json`, JSON.stringify(out, big, 2));
  return { out, dir };
}

if (import.meta.filename === process.argv[1]) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
  const { out, dir } = await buildSnapshot({ network: args.network, ledger: args.ledger, fromBlock: args['from-block'], abiPath: args.abi, rpc: args.rpc });
  console.log(`${out.rounds.length} rounds, ${out.metrics.distinctCommitters} distinct committers, ${Object.keys(out.profiles).length} public profiles -> ${dir}/snapshot.json`);
  for (const r of out.rounds) console.log(`round ${r.roundId}: ${r.commitCount} commits, reveal rate ${r.revealRate}, outcomes ${JSON.stringify(r.outcomes)}, scored ${Object.keys(r.scored).length}, forfeited ${Object.keys(r.forfeited).length}, crowd ${JSON.stringify(r.crowd?.bps ?? null)}`);
}
