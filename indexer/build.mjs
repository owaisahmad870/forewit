// PRESCIENT indexer v1: rebuilds rounds, revealed forecasts, scores, public profiles, the Agent ID Crowd (docs/CROWD.md)
// and daily metrics from ForecastLedger events only. Anyone can rerun it from chain data:
//   node indexer/build.mjs --network testnet|mainnet --ledger <address> --from-block <n> [--abi <file>] [--rpc <url>]
// Writes indexer/out/<network>/<ledger>/snapshot.json. Logs are cached per ledger so reruns only fetch new blocks.
import { createPublicClient, http, parseAbi } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { crowdV1, METHOD } from './lib/crowd.mjs';

const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const unpack = (packed, n) => Array.from({ length: n }, (_, i) => Number((BigInt(packed) >> BigInt(16 * i)) & 0xffffn));

export async function buildSnapshot({ network = 'testnet', ledger, fromBlock, abiPath, rpc }) {
  const chain = network === 'mainnet' ? bsc : bscTestnet;
  // eth_getLogs ranges need a capable RPC (the bnbchain dataseed endpoints refuse them)
  const pub = createPublicClient({ chain, transport: http(rpc || (chain.id === 56 ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com')) });
  if (!ledger || fromBlock === undefined) throw new Error('ledger and fromBlock are required');
  // v1 testnet instances need keeper/abi/ForecastLedger_v1.json (RoundCreated gained resolutionWait in v1.1)
  const ABI = JSON.parse(readFileSync(abiPath || 'keeper/abi/ForecastLedger_v1_1.json', 'utf8'));
  const events = ABI.filter((x) => x.type === 'event');
  const dir = `indexer/out/${network}/${ledger}`;
  mkdirSync(dir, { recursive: true });

  // incremental log cache: {lastBlock, logs:[{eventName, blockNumber, args}], blockTimes:{block: ts}}
  const cacheFile = `${dir}/logs_cache.json`;
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : { lastBlock: String(BigInt(fromBlock) - 1n), logs: [], blockTimes: {} };
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
    for (const l of got) cache.logs.push(JSON.parse(JSON.stringify({ eventName: l.eventName, blockNumber: l.blockNumber, logIndex: l.logIndex, args: l.args }, big)));
    cache.lastBlock = String(to);
    from = to + 1n;
  }
  const needTime = cache.logs.filter((l) => ['Committed', 'Revealed', 'Scored', 'Forfeited'].includes(l.eventName));
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
    if (l.eventName === 'Committed') R(a.roundId).committers.add(a.forecaster.toLowerCase());
    if (l.eventName === 'Revealed') { R(a.roundId).revealed.add(a.forecaster.toLowerCase()); R(a.roundId).forecasts[a.forecaster.toLowerCase()] = a.packed; }
    if (l.eventName === 'BaselineRevealed') R(a.roundId).baseline = a.packed;
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
  const agentIdAddr = await pub.readContract({ address: ledger, abi: ABI, functionName: 'AGENT_ID' }).catch(() => null);
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

  const allCommitters = new Set(Object.values(rounds).flatMap((r) => [...r.committers]));
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
