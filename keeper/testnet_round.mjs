// DEPRECATED: drives only the old instances A and B (old labels). Kept until round 2 on A settles (24 Nov 2026 04:14 UTC), then removed.
// BSC TESTNET ONLY. End to end round driver for the deployed ForecastLedger (mocks plus real testnet CTFs).
// Run from the repo root: node --env-file=.env keeper/testnet_round.mjs <command>   (ROUND_STATE=<name> selects the state file)
// Commands: balances | fund <tBNB> | open | reveal | settle | status
// Keys come from DEPLOYER_PRIVATE_KEY and KEEPER_PRIVATE_KEY and never leave this process; only addresses and tx hashes print.
// Salts are written to keeper/state/ (gitignored, mode 0600) and are secret until the reveal.
import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { pack, scoreRound } from '../scripts/golden_vectors.mjs';
import { writeSecretFile } from '../agent/lib/secure_file.mjs';

const RPC = process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const pub = createPublicClient({ chain: bscTestnet, transport: http(RPC) });
const deployer = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const keeper = privateKeyToAccount(process.env.KEEPER_PRIVATE_KEY);
const wallet = (account) => createWalletClient({ account, chain: bscTestnet, transport: http(RPC) });
// Testnet instances A and B were deployed from ForecastLedger v1: use the frozen v1 ABI, not the current build.
const abi = (name) => JSON.parse(readFileSync(`keeper/abi/${name}_v1.json`, 'utf8'));
const STATE_DIR = 'keeper/state';
const STATE = `${STATE_DIR}/${process.env.ROUND_STATE || 'testnet_round'}.json`; // one state file per instance

function deployed() {
  const run = JSON.parse(readFileSync('contracts/broadcast/DeployTestnet.s.sol/97/run-latest.json', 'utf8'));
  const by = (n) => run.transactions.find((t) => t.contractName === n && t.transactionType === 'CREATE').contractAddress;
  return { ledger: by('ForecastLedger'), aid: by('MockAgentID'), ctf: by('MockConditionalTokens') };
}
const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
// salts are secret until the reveal: current user only (icacls on Windows, 0600 on POSIX)
const save = (s) => { mkdirSync(STATE_DIR, { recursive: true }); writeSecretFile(STATE, JSON.stringify(s, big, 2)); };
const load = () => JSON.parse(readFileSync(STATE, 'utf8'));

async function send(account, address, abiName, functionName, args = []) {
  const { request } = await pub.simulateContract({ account, address, abi: abi(abiName), functionName, args });
  const hash = await wallet(account).writeContract(request);
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error(`${functionName} failed ${hash}`);
  console.log(`  ${functionName.padEnd(16)} ${hash} gas ${rc.gasUsed}`);
  return rc;
}
const read = (address, abiName, functionName, args = []) => pub.readContract({ address, abi: abi(abiName), functionName, args });

if ((await pub.getChainId()) !== 97) throw new Error('RPC is not BSC testnet (chain 97); refusing');
const cmd = process.argv[2];
if (cmd === 'balances') {
  for (const [n, a] of [['deployer', deployer.address], ['keeper', keeper.address]]) console.log(n.padEnd(9), a, formatEther(await pub.getBalance({ address: a })), 'tBNB');
} else if (cmd === 'fund') {
  const amount = parseEther(process.argv[3] ?? '0.05');
  const hash = await wallet(deployer).sendTransaction({ to: keeper.address, value: amount });
  const rc = await pub.waitForTransactionReceipt({ hash });
  console.log('fund', formatEther(amount), 'tBNB deployer -> keeper', hash, rc.status);
} else if (cmd === 'open') {
  if (existsSync(STATE)) throw new Error('state exists: a round is already open; delete keeper/state/testnet_round.json only if it is finished');
  const d = deployed();
  // Agent IDs (mock) for the two forecasters
  for (const [acct, label] of [[deployer, 'forewitdeployer'], [keeper, 'forewitkeeper']]) {
    if ((await read(d.aid, 'MockAgentID', 'balanceOf', [acct.address])) === 0n) await send(acct, d.aid, 'MockAgentID', 'mint', [label]);
  }
  // 3 mock questions; outcomes are set at reveal time: Yes, No, split (Void)
  const now = BigInt(Math.floor(Date.now() / 1000));
  const conds = [];
  for (let i = 0; i < 3; i++) {
    const c = keccak256(toHex(`forewit testnet round 1 q${i} ${now}`));
    await send(keeper, d.ctf, 'MockConditionalTokens', 'prepare', [c, 2n]);
    conds.push(c);
  }
  // the contract's own minimum windows (immutable per instance) plus a 60 s margin
  const commitDeadline = now + (await read(d.ledger, 'ForecastLedger', 'MIN_COMMIT_WINDOW')) + 60n;
  const revealDeadline = commitDeadline + (await read(d.ledger, 'ForecastLedger', 'MIN_REVEAL_WINDOW')) + 60n;
  const qs = conds.map((c, i) => ({ conditionId: c, ctf: d.ctf, yesSlot: 0, marketId: BigInt(900000 + i) }));
  const before = await read(d.ledger, 'ForecastLedger', 'roundCount');
  await send(keeper, d.ledger, 'ForecastLedger', 'createRound', [qs, commitDeadline, revealDeadline]);
  const roundId = before + 1n;
  const salt = () => '0x' + randomBytes(32).toString('hex');
  const f = {
    baseline: { packed: pack([6000, 5000, 5000]), salt: salt() },
    deployer: { packed: pack([8000, 3000, 9000]), salt: salt() }, // will reveal (via revealFor by the keeper)
    keeper: { packed: pack([2000, 7000, 1000]), salt: salt() }, // will NOT reveal: forfeit path
  };
  save({ roundId, conds, commitDeadline, revealDeadline, f, ...d }); // salts on disk before any commit tx
  const BASE = await read(d.ledger, 'ForecastLedger', 'BASELINE');
  const h = (who, x) => read(d.ledger, 'ForecastLedger', 'computeCommitHash', [roundId, who, x.packed, x.salt]);
  await send(keeper, d.ledger, 'ForecastLedger', 'commitBaseline', [roundId, await h(BASE, f.baseline)]);
  await send(deployer, d.ledger, 'ForecastLedger', 'commit', [roundId, await h(deployer.address, f.deployer)]);
  await send(keeper, d.ledger, 'ForecastLedger', 'commit', [roundId, await h(keeper.address, f.keeper)]);
  console.log(`round ${roundId} open; commit deadline ${new Date(Number(commitDeadline) * 1000).toISOString()}, reveal deadline ${new Date(Number(revealDeadline) * 1000).toISOString()}`);
} else if (cmd === 'reveal') {
  const s = load();
  const r = BigInt(s.roundId);
  if (Date.now() / 1000 < Number(s.commitDeadline)) throw new Error('commit window still open');
  await send(keeper, s.ledger, 'ForecastLedger', 'revealBaseline', [r, BigInt(s.f.baseline.packed), s.f.baseline.salt]); // also seals
  await send(keeper, s.ledger, 'ForecastLedger', 'revealFor', [r, deployer.address, BigInt(s.f.deployer.packed), s.f.deployer.salt]); // relayer path
  const payouts = [[1n, 0n], [0n, 1n], [1n, 1n]]; // Yes, No, split
  for (let i = 0; i < 3; i++) await send(keeper, s.ctf, 'MockConditionalTokens', 'resolve', [s.conds[i], payouts[i]]);
  for (let i = 0; i < 3; i++) await send(keeper, s.ledger, 'ForecastLedger', 'finalizeQuestion', [r, BigInt(i)]);
} else if (cmd === 'settle') {
  const s = load();
  const r = BigInt(s.roundId);
  if (Date.now() / 1000 <= Number(s.revealDeadline)) throw new Error('reveal window still open');
  await send(keeper, s.ledger, 'ForecastLedger', 'scoreBatch', [r, [deployer.address, keeper.address]]);
  await send(keeper, s.ledger, 'ForecastLedger', 'forfeitBatch', [r, [deployer.address, keeper.address]]);
  // End to end check: onchain stats must equal the JavaScript reference
  const outcomes = ['Y', 'N', 'V'];
  const exp = {
    deployer: scoreRound(BigInt(s.f.deployer.packed), BigInt(s.f.baseline.packed), outcomes),
    keeper: scoreRound(BigInt(s.f.keeper.packed), BigInt(s.f.baseline.packed), outcomes, { forfeit: true }),
  };
  let ok = true;
  for (const [n, a] of [['deployer', deployer.address], ['keeper', keeper.address]]) {
    const st = await read(s.ledger, 'ForecastLedger', 'getStats', [a]);
    const e = exp[n];
    const match = BigInt(st.questionsScored) === e.questions && st.sumBrier === e.brier && st.sumBaselineBrier === e.base && BigInt(st.sumSkill) === e.skill;
    ok &&= match;
    console.log(n, match ? 'MATCH' : 'MISMATCH', JSON.stringify({ onchain: { q: st.questionsScored, brier: st.sumBrier, base: st.sumBaselineBrier, skill: st.sumSkill }, expected: e }, big));
  }
  console.log(ok ? 'END TO END OK' : 'END TO END FAILED');
  process.exit(ok ? 0 : 1);
} else if (cmd === 'status') {
  const s = load();
  const r = BigInt(s.roundId);
  const round = await read(s.ledger, 'ForecastLedger', 'getRound', [r]);
  console.log(JSON.stringify({ roundId: s.roundId, ledger: s.ledger, now: new Date().toISOString(), round }, big, 2));
} else {
  console.log('usage: balances | fund <tBNB> | open | reveal | settle | status');
}
