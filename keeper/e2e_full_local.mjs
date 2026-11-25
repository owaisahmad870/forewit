// LOCAL ONLY, zero cost: the whole Forewit lifecycle in about 15 minutes on anvil (chain id 97, public anvil test keys).
// Real code paths: the CLI commitPlan (with auto reveal), the keeper commands open, night (baseline from real BSC
// testnet Predict.fun order books, then seal), autoreveal and tick (finalize, score), the indexer snapshot and the
// results card. Mock parts: the Agent ID (MockAgentID) and the outcomes (MockConditionalTokens, resolved here).
// Plumbing proof, not submission evidence. Runs in a temp copy so no keeper/state or keeper/archive file is touched.
// Run: node keeper/e2e_full_local.mjs   (needs anvil from Foundry and contracts/out from forge build)
import { createPublicClient, createWalletClient, http, keccak256, toHex, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');
const PORT = 8547;
const RPC = `http://127.0.0.1:${PORT}`;
const KEYS = ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3ba4f2b6b31ae82b'];
const [deployer, keeper, user] = KEYS.map((k) => privateKeyToAccount(k));
const chain = defineChain({ id: 97, name: 'anvil97', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const art = (n) => JSON.parse(readFileSync(join(REPO, `contracts/out/${n}.sol/${n}.json`), 'utf8'));
const t0 = Date.now();
const say = (...a) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s]`, ...a);

// temp workspace: the same code, its own keeper/state, keeper/archive and indexer/out
const W = mkdtempSync(join(tmpdir(), 'forewit_e2e_'));
for (const d of ['keeper', 'agent', 'indexer', 'scripts', 'web/src/lib']) cpSync(join(REPO, d), join(W, d), { recursive: true, filter: (s) => !/[\\/](state|archive|out)([\\/]|$)/.test(s.slice(REPO.length)) });
cpSync(join(REPO, 'package.json'), join(W, 'package.json'));
execFileSync(process.platform === 'win32' ? 'cmd' : 'ln', process.platform === 'win32' ? ['/c', 'mklink', '/J', join(W, 'node_modules'), join(REPO, 'node_modules')] : ['-s', join(REPO, 'node_modules'), join(W, 'node_modules')], { stdio: 'ignore' });

const anvil = spawn(join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'anvil.exe' : 'anvil'), ['--chain-id', '97', '--port', String(PORT), '--block-time', '1', '--silent'], { stdio: 'ignore' });
process.on('exit', () => anvil.kill());
const pub = createPublicClient({ chain, transport: http(RPC) });
for (let i = 0; ; i++) { try { await pub.getChainId(); break; } catch { if (i > 50) throw new Error('anvil did not start'); await new Promise((r) => setTimeout(r, 200)); } }
for (const a of [deployer, keeper, user]) await pub.request({ method: 'anvil_setBalance', params: [a.address, '0x56bc75e2d63100000'] });
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(RPC) });
const deploy = async (a, n, args = []) => (await pub.waitForTransactionReceipt({ hash: await wallet(a).deployContract({ abi: art(n).abi, bytecode: art(n).bytecode.object, args }) })).contractAddress;
const write = async (a, address, n, functionName, args) => pub.waitForTransactionReceipt({ hash: await wallet(a).writeContract({ address, abi: art(n).abi, functionName, args }) });
const read = (functionName, args = []) => pub.readContract({ address: ledger, abi: art('ForecastLedger').abi, functionName, args });

const aid = await deploy(deployer, 'MockAgentID');
const ctf = await deploy(deployer, 'MockConditionalTokens');
const ledger = await deploy(deployer, 'ForecastLedger', [aid, [ctf], deployer.address, keeper.address, 60n, 60n]);
await write(user, aid, 'MockAgentID', 'mint', ['e2eplayer']);
say(`ledger ${ledger} (local anvil, chain id 97)`);

// two real testnet markets with two sided books supply the baseline prices; the conditions are mock ones we resolve
const markets = (await (await fetch('https://api-testnet.predict.fun/v1/markets?status=OPEN&first=100')).json()).data
  .filter((m) => m.outcomes?.[0]?.bestBid && m.outcomes?.[0]?.bestAsk).slice(0, 2);
if (markets.length < 2) throw new Error('fewer than 2 two sided testnet books right now');
const conds = [0, 1].map((i) => keccak256(toHex(`forewit e2e q${i} ${Date.now()}`)));
for (const c of conds) await write(deployer, ctf, 'MockConditionalTokens', 'prepare', [c, 2n]);

const env = { ...process.env, BSC_TESTNET_RPC_URL: RPC, LOGS_RPC_URL: RPC, LEDGER_TESTNET: ledger, KEEPER_PRIVATE_KEY: KEYS[1], PUBLISH: '0', TOPIC_ROUNDS: '', INDEXER_FROM_BLOCK_TESTNET: '0' };
const keeperRun = (...a) => execFileSync(process.execPath, ['keeper/keeper.mjs', ...a, '--network', 'testnet'], { cwd: W, env, encoding: 'utf8' }).trim().split('\n').map((l) => '    keeper ' + l.replace(/^\S+Z /, '')).join('\n');

const dl = Math.floor(Date.now() / 1000) + 6 * 60 + 30; // baseline at 5 minutes before, so about 90 s from now
mkdirSync(join(W, 'keeper/state'), { recursive: true });
const sel = join(W, 'keeper/state/e2e_selection.json');
writeFileSync(sel, JSON.stringify({ rule: 'local e2e', kind: 'daily', board: 'scored', featured: true, commitDeadline: new Date(dl * 1000).toISOString(), chosen: markets.map((m, i) => ({ marketId: m.id, conditionId: conds[i], ctf, eventQuestion: `Local e2e question ${i + 1} (mock outcome, real testnet book ${m.id})`, label: 'Yes', marketQuestion: null, endsAt: null, tags: ['Mock'] })) }));
console.log(keeperRun('open', '--selection', sel, '--reveal-hours', '0.1', '--resolution-days', '1'));
const r = await read('roundCount');
say(`round ${r} open, commit deadline ${new Date(dl * 1000).toISOString()}, reveal window 6 minutes`);

// the player: the CLI's own commit path with auto reveal, fixed forecasts 80% and 30%
const { commitPlan, loadRound } = await import(`file://${join(W, 'agent/forewit.mjs').replace(/\\/g, '/')}`);
const net = { name: 'testnet', chainId: 97, ledger, rpc: RPC, explorer: '' };
const plan = await commitPlan({ net, from: user.address, bps: [8000, 3000], home: mkdtempSync(join(tmpdir(), 'forewit_home_')), loaded: await loadRound(net, String(r)), autoReveal: true });
await pub.waitForTransactionReceipt({ hash: await wallet(user).sendTransaction({ to: ledger, data: plan.data }) });
say(`player committed 80% and 30% with auto reveal (${(plan.data.length - 138) / 2} byte time locked tail); one transaction`);

say('keeper night: waits for the baseline window, posts real testnet book prices, seals after the deadline');
console.log(keeperRun('night', '--round', String(r)));
const after = await read('getRound', [r]);
const base = [0, 1].map((i) => Number((BigInt(after.baselinePacked) >> BigInt(16 * i)) & 0xffffn));
say(`baseline ${base.map((b) => b / 100 + '%').join(' and ')}, sealed ${after.isSealed}`);

await new Promise((res) => setTimeout(res, (dl + 125) * 1000 - Date.now()));
await pub.request({ method: 'evm_mine', params: [] });
console.log(keeperRun('autoreveal', '--round', String(r)));
const [, status] = await read('getReveal', [r, user.address]);
say(`auto reveal: status ${status} (1 = revealed by the keeper; the player did nothing)`);

// outcomes: question 1 Yes, question 2 No (mock oracle); then wait out the reveal window and let tick finalize and score
await write(deployer, ctf, 'MockConditionalTokens', 'resolve', [conds[0], [1n, 0n]]);
await write(deployer, ctf, 'MockConditionalTokens', 'resolve', [conds[1], [0n, 1n]]);
await new Promise((res) => setTimeout(res, (Number(after.revealDeadline) + 5) * 1000 - Date.now()));
await pub.request({ method: 'evm_mine', params: [] });
console.log(keeperRun('tick'));
const stats = await read('getStats', [user.address]);
say(`scored: questions ${stats.questionsScored}, sumBrier ${stats.sumBrier}, sumSkill ${stats.sumSkill}`);

// indexer snapshot and the results card, exactly as the site and forewit results compute them
execFileSync(process.execPath, ['indexer/build.mjs', '--network', 'testnet', '--ledger', ledger, '--from-block', '0', '--rpc', RPC], { cwd: W, env, stdio: 'ignore' });
const snap = JSON.parse(readFileSync(join(W, `indexer/out/testnet/${ledger}/snapshot.json`), 'utf8'));
const { resultsCard } = await import(`file://${join(REPO, 'mcp/src/remote.mjs').replace(/\\/g, '/')}`);
const card = resultsCard(snap, user.address.toLowerCase());
console.log('\n  RESULTS CARD\n  ' + card.summary + '\n  ' + card.rounds.map((x) => `Round ${x.round_id}: ${x.says}`).join('\n  '));

// hand computed: Brier per question in percent points, skill = market miss minus player miss
const y = [10000, 0], p = [8000, 3000];
const miss = (v) => v.reduce((s, b, i) => s + (b - y[i]) ** 2, 0) / 2 / 1e8 * 100;
const expected = Math.round((miss(base) - miss(p)) * 10) / 10;
const got = card.rounds[0].points;
const pass = status & 1 && Number(stats.questionsScored) === 2 && Math.abs(got - expected) < 0.051;
console.log(`\n  expected points ${expected}, card says ${got}`);
console.log(pass ? `E2E PASS in ${Math.round((Date.now() - t0) / 60000)} minutes, zero cost` : 'E2E FAILED');
process.exit(pass ? 0 : 1);
