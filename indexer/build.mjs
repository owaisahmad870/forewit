// PRESCIENT indexer v0: rebuilds rounds, forecasts, scores and daily metrics from ForecastLedger events only.
// Anyone can rerun it: node indexer/build.mjs --network testnet --ledger <address> --from-block <n>
// Writes indexer/out/<network>/<ledger>/snapshot.json. Counts distinct committers (the 30 holder gate metric).
import { createPublicClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const chain = args.network === 'mainnet' ? bsc : bscTestnet;
const rpc = args.rpc || (chain.id === 56 ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com');
const pub = createPublicClient({ chain, transport: http(rpc) });
const ledger = args.ledger;
if (!ledger || !args['from-block']) throw new Error('--ledger and --from-block are required');
// --abi keeper/abi/ForecastLedger_v1.json for the v1 testnet instances (RoundCreated gained resolutionWait in v1.1)
const ABI = args.abi ? JSON.parse(readFileSync(args.abi, 'utf8')) : JSON.parse(readFileSync('contracts/out/ForecastLedger.sol/ForecastLedger.json', 'utf8')).abi;
const events = ABI.filter((x) => x.type === 'event');
const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);

const head = await pub.getBlockNumber();
const logs = [];
for (let from = BigInt(args['from-block']); from <= head; from += 5000n) {
  const to = from + 4999n > head ? head : from + 4999n;
  logs.push(...(await pub.getLogs({ address: ledger, events, fromBlock: from, toBlock: to })));
}

const rounds = {};
const R = (id) => (rounds[id] ??= { roundId: id, questions: [], committers: new Set(), revealed: new Set(), scored: {}, forfeited: {}, outcomes: {}, baseline: null });
const days = {};
for (const l of logs) {
  const a = l.args;
  if (l.eventName === 'RoundCreated') Object.assign(R(a.roundId), { commitDeadline: a.commitDeadline, revealDeadline: a.revealDeadline, resolutionWait: a.resolutionWait ?? null, questions: a.questions, createdBlock: l.blockNumber });
  if (l.eventName === 'Committed') R(a.roundId).committers.add(a.forecaster);
  if (l.eventName === 'Revealed') R(a.roundId).revealed.add(a.forecaster);
  if (l.eventName === 'BaselineRevealed') R(a.roundId).baseline = a.packed;
  if (l.eventName === 'QuestionFinalized') R(a.roundId).outcomes[a.index] = ['Unresolved', 'Yes', 'No', 'Void'][a.outcome];
  if (l.eventName === 'Scored') R(a.roundId).scored[a.forecaster] = { questions: a.questions, brier: a.brierSum, skill: a.skillSum };
  if (l.eventName === 'Forfeited') R(a.roundId).forfeited[a.forecaster] = { questions: a.questions, brier: a.brierSum, skill: a.skillSum };
}
// transactions per UTC day from forecaster actions
const blockTime = {};
for (const l of logs.filter((x) => x.eventName === 'Committed' || x.eventName === 'Revealed')) {
  blockTime[l.blockNumber] ??= (await pub.getBlock({ blockNumber: l.blockNumber })).timestamp;
  const d = new Date(Number(blockTime[l.blockNumber]) * 1000).toISOString().slice(0, 10);
  (days[d] ??= { commits: 0, reveals: 0 })[l.eventName === 'Committed' ? 'commits' : 'reveals']++;
}

const allCommitters = new Set(Object.values(rounds).flatMap((r) => [...r.committers]));
const out = {
  network: chain.id, ledger, builtAt: new Date().toISOString(), headBlock: head,
  metrics: {
    distinctCommitters: allCommitters.size, // on mainnet every committer held an Agent ID at commit (contract gate)
    rounds: Object.keys(rounds).length,
    perDay: days,
  },
  rounds: Object.values(rounds).map((r) => ({
    ...r,
    committers: [...r.committers],
    revealed: [...r.revealed],
    commitCount: r.committers.size,
    revealRate: r.committers.size ? r.revealed.size / r.committers.size : null,
  })),
};
const dir = `indexer/out/${args.network || 'testnet'}/${ledger}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/snapshot.json`, JSON.stringify(out, big, 2));
console.log(`indexed ${logs.length} events, ${out.metrics.rounds} rounds, ${out.metrics.distinctCommitters} distinct committers -> ${dir}/snapshot.json`);
for (const r of out.rounds) console.log(`round ${r.roundId}: ${r.commitCount} commits, reveal rate ${r.revealRate}, outcomes ${JSON.stringify(r.outcomes)}, scored ${Object.keys(r.scored).length}, forfeited ${Object.keys(r.forfeited).length}`);
