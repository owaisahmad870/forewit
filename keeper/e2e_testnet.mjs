// BSC TESTNET ONLY. End to end check of keeper.mjs on a fast v1.1 instance (120 s commit, 300 s reveal windows).
// Questions are mock conditions we resolve ourselves, priced by real two sided testnet order books, because no
// testnet market falls in the selection v2 window. Every keeper duty runs through the real keeper.mjs commands.
// Run: LEDGER_TESTNET=<v1.1 ledger> node --env-file=.env keeper/e2e_testnet.mjs
import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { pack, scoreRound } from '../scripts/golden_vectors.mjs';

const LEDGER = process.env.LEDGER_TESTNET;
const RPC = process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const pub = createPublicClient({ chain: bscTestnet, transport: http(RPC) });
if ((await pub.getChainId()) !== 97) throw new Error('not BSC testnet; refusing');
const deployer = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const keeper = privateKeyToAccount(process.env.KEEPER_PRIVATE_KEY);
const abi = (n) => JSON.parse(readFileSync(`contracts/out/${n}.sol/${n}.json`, 'utf8')).abi;
const run = JSON.parse(readFileSync('contracts/broadcast/DeployTestnet.s.sol/97/run-latest.json', 'utf8'));
const addr = (n) => run.transactions.find((t) => t.contractName === n && t.transactionType === 'CREATE').contractAddress;
if (addr('ForecastLedger').toLowerCase() !== LEDGER.toLowerCase()) throw new Error('LEDGER_TESTNET is not the latest testnet deploy');
const AID = addr('MockAgentID'), CTF = addr('MockConditionalTokens');
const read = (address, n, fn, args = []) => pub.readContract({ address, abi: abi(n), functionName: fn, args });
async function send(account, address, n, fn, args) {
  const { request } = await pub.simulateContract({ account, address, abi: abi(n), functionName: fn, args });
  const rc = await pub.waitForTransactionReceipt({ hash: await createWalletClient({ account, chain: bscTestnet, transport: http(RPC) }).writeContract(request) });
  if (rc.status !== 'success') throw new Error(`${fn} reverted`);
  console.log(`  harness ${fn.padEnd(14)} ${rc.transactionHash}`);
}
const keeperCmd = (...a) => console.log(execFileSync(process.execPath, ['--env-file=.env', 'keeper/keeper.mjs', ...a, '--network', 'testnet'], { encoding: 'utf8', env: { ...process.env, LEDGER_TESTNET: LEDGER } }).trim().split('\n').map((l) => '  keeper ' + l).join('\n'));
const sleepUntil = async (unixSec) => { const ms = unixSec * 1000 - Date.now(); if (ms > 0) await new Promise((r) => setTimeout(r, ms)); };

// 1. three real testnet markets with two sided books (price source for the baseline)
const markets = (await (await fetch('https://api-testnet.predict.fun/v1/markets?status=OPEN&first=100')).json()).data
  .filter((m) => m.outcomes[0]?.bestBid && m.outcomes[0]?.bestAsk).slice(0, 3);
if (markets.length < 3) throw new Error('fewer than 3 two sided testnet books');
// 2. mock conditions and forecaster Agent IDs
const conds = [];
for (let i = 0; i < 3; i++) {
  const c = keccak256(toHex(`prescient e2e v1.1 q${i} ${Date.now()}`));
  await send(keeper, CTF, 'MockConditionalTokens', 'prepare', [c, 2n]);
  conds.push(c);
}
for (const [a, label] of [[deployer, 'e2edeployer'], [keeper, 'e2ekeeper']]) if ((await read(AID, 'MockAgentID', 'balanceOf', [a.address])) === 0n) await send(a, AID, 'MockAgentID', 'mint', [label]);
// 3. keeper open: commit deadline 200 s out (inside the 5 minute baseline window from the start), reveal 360 s, wait 1 day
const commitDeadline = Math.floor(Date.now() / 1000) + 200;
mkdirSync('keeper/state', { recursive: true });
const selFile = 'keeper/state/e2e_selection.json';
writeFileSync(selFile, JSON.stringify({ rule: 'e2e harness', commitDeadline: new Date(commitDeadline * 1000).toISOString(), chosen: markets.map((m, i) => ({ marketId: m.id, conditionId: conds[i], ctf: CTF, title: m.title })) }, null, 2));
keeperCmd('open', '--selection', selFile, '--reveal-hours', '0.1', '--resolution-days', '1');
const roundId = await read(LEDGER, 'ForecastLedger', 'roundCount');
// 4. forecasters commit
const f = { deployer: { packed: pack([8000, 3000, 9000]), salt: '0x' + randomBytes(32).toString('hex') }, keeper: { packed: pack([2000, 7000, 1000]), salt: '0x' + randomBytes(32).toString('hex') } };
for (const [name, a] of [['deployer', deployer], ['keeper', keeper]]) {
  const h = await read(LEDGER, 'ForecastLedger', 'computeCommitHash', [roundId, a.address, f[name].packed, f[name].salt]);
  await send(a, LEDGER, 'ForecastLedger', 'commit', [roundId, h]);
}
// 5. keeper baseline (we are inside the last 5 minutes), then seal after the deadline
keeperCmd('baseline', '--round', String(roundId));
await sleepUntil(commitDeadline + 3);
await send(keeper, LEDGER, 'ForecastLedger', 'revealFor', [roundId, deployer.address, f.deployer.packed, f.deployer.salt]); // keeper never reveals: forfeit
keeperCmd('seal', '--round', String(roundId));
// 6. resolve Yes, No, split, then keeper finalize
for (const [i, p] of [[0, [1n, 0n]], [1, [0n, 1n]], [2, [1n, 1n]]]) await send(keeper, CTF, 'MockConditionalTokens', 'resolve', [conds[i], p]);
keeperCmd('finalize', '--round', String(roundId));
// 7. after the reveal deadline: keeper score, then compare with the JavaScript reference
const round = await read(LEDGER, 'ForecastLedger', 'getRound', [roundId]);
await sleepUntil(Number(round.revealDeadline) + 3);
keeperCmd('score', '--round', String(roundId));
const base = BigInt(JSON.parse(readFileSync(`keeper/state/baseline_97_${roundId}.json`, 'utf8')).packed);
let ok = true;
for (const [name, a, forfeit] of [['deployer', deployer, false], ['keeper', keeper, true]]) {
  const st = await read(LEDGER, 'ForecastLedger', 'getStats', [a.address]);
  const e = scoreRound(f[name].packed, base, ['Y', 'N', 'V'], { forfeit });
  // stats accumulate across rounds on this instance, so compare this round's Scored/Forfeited event sums instead when reused
  const m = BigInt(st.questionsScored) === e.questions && st.sumBrier === e.brier && st.sumBaselineBrier === e.base && BigInt(st.sumSkill) === e.skill;
  ok &&= m;
  console.log(name, m ? 'MATCH' : 'MISMATCH', JSON.stringify({ brier: st.sumBrier, base: st.sumBaselineBrier, skill: st.sumSkill }, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
console.log(ok ? 'END TO END OK (keeper.mjs, ledger v1.1)' : 'END TO END FAILED');
process.exit(ok ? 0 : 1);
