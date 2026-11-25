// LOCAL ONLY (anvil, chain id 97, public anvil test keys): auto reveal end to end on a fresh ledger.
// The real CLI commitPlan builds the commit with its time locked tail, a test wallet sends it, and after the deadline
// the real keeper command `autoreveal` decrypts it through drand quicknet and calls revealFor. About 2.5 minutes.
// Run: node keeper/e2e_autoreveal_local.mjs   (needs anvil from Foundry and contracts/out from forge build)
import { createPublicClient, createWalletClient, http, keccak256, toHex, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { commitPlan, loadRound } from '../agent/forewit.mjs';

const PORT = 8546;
const RPC = `http://127.0.0.1:${PORT}`;
// anvil's well known test keys (public; never funded anywhere real)
const KEYS = ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3ba4f2b6b31ae82b'];
const [deployer, keeper, user] = KEYS.map((k) => privateKeyToAccount(k));
const chain = defineChain({ id: 97, name: 'anvil97', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const art = (n) => JSON.parse(readFileSync(`contracts/out/${n}.sol/${n}.json`, 'utf8'));

const anvilBin = join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'anvil.exe' : 'anvil');
const anvil = spawn(anvilBin, ['--chain-id', '97', '--port', String(PORT), '--silent'], { stdio: 'ignore' });
const stop = () => anvil.kill();
process.on('exit', stop);
const pub = createPublicClient({ chain, transport: http(RPC) });
for (let i = 0; ; i++) { try { await pub.getChainId(); break; } catch { if (i > 50) throw new Error('anvil did not start'); await new Promise((r) => setTimeout(r, 200)); } }
for (const a of [deployer, keeper, user]) await pub.request({ method: 'anvil_setBalance', params: [a.address, '0x56bc75e2d63100000'] });
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(RPC) });
const deploy = async (a, n, args = []) => (await pub.waitForTransactionReceipt({ hash: await wallet(a).deployContract({ abi: art(n).abi, bytecode: art(n).bytecode.object, args }) })).contractAddress;
const write = async (a, address, n, functionName, args) => pub.waitForTransactionReceipt({ hash: await wallet(a).writeContract({ address, abi: art(n).abi, functionName, args }) });

const aid = await deploy(deployer, 'MockAgentID');
const ctf = await deploy(deployer, 'MockConditionalTokens');
const ledger = await deploy(deployer, 'ForecastLedger', [aid, [ctf], deployer.address, keeper.address, 30n, 300n]);
await write(user, aid, 'MockAgentID', 'mint', ['autorevealtester']);
const conds = [0, 1].map((i) => keccak256(toHex(`autoreveal q${i} ${Date.now()}`)));
for (const c of conds) await write(deployer, ctf, 'MockConditionalTokens', 'prepare', [c, 2n]);
const now = Number((await pub.getBlock()).timestamp);
const deadline = BigInt(now + 45);
await write(keeper, ledger, 'ForecastLedger', 'createRound', [conds.map((c, i) => ({ conditionId: c, ctf, yesSlot: 0, marketId: BigInt(i + 1) })), deadline, deadline + 600n, 86400n]);
console.log(`ledger ${ledger}, round 1, commit deadline in 45 s`);

// the CLI's own commit path, pointed at the local ledger
const net = { name: 'testnet', chainId: 97, ledger, rpc: RPC, explorer: '' };
const home = mkdtempSync(join(tmpdir(), 'forewit_ar_'));
const plan = await commitPlan({ net, from: user.address, bps: [7300, 2100], home, loaded: await loadRound(net, '1'), autoReveal: true });
if (!plan.autoReveal || !plan.data.includes('46574152')) throw new Error('commit has no auto reveal tail');
await pub.waitForTransactionReceipt({ hash: await wallet(user).sendTransaction({ to: ledger, data: plan.data }) });
const onchain = await pub.readContract({ address: ledger, abi: art('ForecastLedger').abi, functionName: 'getCommit', args: [1n, user.address] });
if (onchain !== plan.receipt.commitHash) throw new Error('onchain commit differs from the receipt');
console.log(`committed with a ${(plan.data.length - 138) / 2} byte time locked tail; waiting for the deadline plus the drand margin`);

const run = () => execFileSync(process.execPath, ['keeper/keeper.mjs', 'autoreveal', '--round', '1', '--network', 'testnet'], {
  encoding: 'utf8', env: { ...process.env, BSC_TESTNET_RPC_URL: RPC, LOGS_RPC_URL: RPC, LEDGER_TESTNET: ledger, KEEPER_PRIVATE_KEY: KEYS[1], PUBLISH: '0', TOPIC_ROUNDS: '' },
}).trim();
console.log('keeper before the deadline:', run() || '(nothing, as expected)');
await new Promise((r) => setTimeout(r, (Number(deadline) + 130 - Math.floor(Date.now() / 1000)) * 1000));
await pub.request({ method: 'evm_mine', params: [] }); // a fresh block so chain time is past the deadline
console.log('keeper after:', run());
const [packed, status] = await pub.readContract({ address: ledger, abi: art('ForecastLedger').abi, functionName: 'getReveal', args: [1n, user.address] });
if (!(status & 1) || packed !== BigInt(plan.receipt.packed)) throw new Error(`not revealed (status ${status})`);
console.log(`PASS: revealed for the user by the keeper, packed ${packed} matches the receipt; the user sent one transaction`);
stop();
process.exit(0);
