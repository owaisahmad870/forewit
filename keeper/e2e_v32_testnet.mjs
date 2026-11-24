// BSC TESTNET ONLY. Rule v3.2 night check: one Featured, two Scored topic and one Open topic round share one commit
// deadline; `night` (TOPIC_ROUNDS=on) must post the topic baselines from 10 minutes before, the Featured baseline
// about 5 minutes before, no baseline for the Open round, then seal all four. Mock conditions, real testnet books.
// Run (testnet keys only): TOPIC_ROUNDS=on PUBLISH=0 LEDGER_TESTNET=<instance E> KEEPER_PRIVATE_KEY=... node keeper/e2e_v32_testnet.mjs
import { createPublicClient, createWalletClient, http, keccak256, toHex, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LEDGER = process.env.LEDGER_TESTNET;
const CTF = process.env.MOCK_CTF_TESTNET;
const pub = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') });
if ((await pub.getChainId()) !== 97) throw new Error('not BSC testnet; refusing');
if (process.env.TOPIC_ROUNDS !== 'on') throw new Error('set TOPIC_ROUNDS=on');
const keeper = privateKeyToAccount(process.env.KEEPER_PRIVATE_KEY);
const LABI = JSON.parse(readFileSync('keeper/abi/ForecastLedger_v1_2.json', 'utf8'));
const w = createWalletClient({ account: keeper, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') });
const keeperCmd = (...a) => console.log(execFileSync(process.execPath, ['keeper/keeper.mjs', ...a, '--network', 'testnet'], { encoding: 'utf8', env: process.env }).trim().split('\n').map((l) => '  keeper ' + l).join('\n'));

// four testnet markets with two sided books (baseline price source); the Open round's market needs no book
const markets = (await (await fetch('https://api-testnet.predict.fun/v1/markets?status=OPEN&first=100')).json()).data
  .filter((m) => m.outcomes[0]?.bestBid && m.outcomes[0]?.bestAsk).slice(0, 4);
if (markets.length < 4) throw new Error('fewer than 4 two sided testnet books');
const prep = parseAbi(['function prepare(bytes32 conditionId, uint256 slots)']);
const conds = [];
for (let i = 0; i < 4; i++) {
  const c = keccak256(toHex(`forewit v32 night q${i} ${Date.now()}`));
  await pub.waitForTransactionReceipt({ hash: await w.writeContract({ address: CTF, abi: prep, functionName: 'prepare', args: [c, 2n] }) });
  conds.push(c);
}
const dl = Math.floor(Date.now() / 1000) + 12 * 60; // 12 minutes out: topic baselines start at 10, Featured at 5
const kinds = [
  { name: 'featured', extra: { kind: 'daily', board: 'scored', featured: true } },
  { name: 'scored A', extra: { kind: 'topic', board: 'scored', featured: false, topic: 'tech', horizon: '3d' } },
  { name: 'scored B', extra: { kind: 'topic', board: 'scored', featured: false, topic: 'macro', horizon: '3d' } },
  { name: 'open', extra: { kind: 'topic', board: 'open', featured: false, topic: 'other', horizon: '3d' } },
];
mkdirSync('keeper/state', { recursive: true });
const ids = [];
for (const [i, k] of kinds.entries()) {
  const file = `keeper/state/e2e_v32_${i}.json`;
  writeFileSync(file, JSON.stringify({ rule: 'e2e v3.2 night harness', ...k.extra, commitDeadline: new Date(dl * 1000).toISOString(), chosen: [{ marketId: markets[i].id, conditionId: conds[i], ctf: CTF, eventQuestion: `Testnet mock question ${i + 1} (${k.name}, resolved by the harness, not a real market)`, label: `Mock outcome ${i + 1}`, marketQuestion: null, endsAt: null, tags: ['Testnet', 'Mock'] }] }, null, 2));
  keeperCmd('open', '--selection', file, '--reveal-hours', '0.1', '--resolution-days', '1');
  ids.push(await pub.readContract({ address: LEDGER, abi: LABI, functionName: 'roundCount' }));
}
console.log('rounds', ids.join(', '), 'deadline', new Date(dl * 1000).toISOString());
keeperCmd('night'); // no --round: the newest round, then every unsealed round at its deadline

// verify onchain: baseline set (and when) for the three scored rounds, none for the Open round, all sealed
const logs = await pub.getContractEvents({ address: LEDGER, abi: LABI, eventName: 'BaselineSet', fromBlock: (await pub.getBlockNumber()) - 3000n });
let ok = true;
for (const [i, r] of ids.entries()) {
  const g = await pub.readContract({ address: LEDGER, abi: LABI, functionName: 'getRound', args: [r] });
  const ev = logs.find((l) => l.args.roundId === r);
  const at = ev ? Number((await pub.getBlock({ blockNumber: ev.blockNumber })).timestamp) : null;
  const wantBaseline = kinds[i].extra.board !== 'open';
  const good = g.isSealed && g.baselineSet === wantBaseline;
  ok &&= good;
  console.log(`${kinds[i].name.padEnd(9)} round ${r}: baseline ${g.baselineSet ? `${dl - at} s before the deadline` : 'none'}, sealed ${g.isSealed} -> ${good ? 'OK' : 'WRONG'}`);
}
console.log(ok ? 'V32 NIGHT OK' : 'V32 NIGHT FAILED');
process.exit(ok ? 0 : 1);
