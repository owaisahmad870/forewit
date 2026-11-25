// LOCAL ONLY, zero cost: Forewit v2 open forecasts end to end in about 3 minutes on anvil (public anvil test keys).
// A short "Bitcoin Up or Down, 2 minute" style market (mock Conditional Tokens), a fake Predict.fun API for its book,
// category and status, real drand. Real code: the CLI openPlan (any market, auto reveal), the v2 keeper (price within
// 120 s, finalize, reveal from the sealed copy, score). Checks the score against a hand computation.
// Run: node keeper/e2e_open_local.mjs   (needs anvil and contracts/out from forge build)
import { createPublicClient, createWalletClient, http, keccak256, toHex, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');
const PORT = 8548, RPC = `http://127.0.0.1:${PORT}`;
const KEYS = ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3ba4f2b6b31ae82b'];
const [deployer, keeper, user] = KEYS.map((k) => privateKeyToAccount(k));
const chain = defineChain({ id: 97, name: 'anvil97', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const art = (n) => JSON.parse(readFileSync(join(REPO, `contracts/out/${n}.sol/${n}.json`), 'utf8'));
const t0 = Date.now();
const say = (...a) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s]`, ...a);

const anvil = spawn(join(homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'anvil.exe' : 'anvil'), ['--chain-id', '97', '--port', String(PORT), '--block-time', '1', '--silent'], { stdio: 'ignore' });
process.on('exit', () => anvil.kill());
const pub = createPublicClient({ chain, transport: http(RPC) });
for (let i = 0; ; i++) { try { await pub.getChainId(); break; } catch { if (i > 50) throw new Error('anvil did not start'); await new Promise((r) => setTimeout(r, 200)); } }
for (const a of [deployer, keeper, user]) await pub.request({ method: 'anvil_setBalance', params: [a.address, '0x56bc75e2d63100000'] });
const wallet = (a) => createWalletClient({ account: a, chain, transport: http(RPC) });
const deploy = async (a, n, args = []) => (await pub.waitForTransactionReceipt({ hash: await wallet(a).deployContract({ abi: art(n).abi, bytecode: art(n).bytecode.object, args }) })).contractAddress;
const write = async (a, address, n, functionName, args) => pub.waitForTransactionReceipt({ hash: await wallet(a).writeContract({ address, abi: art(n).abi, functionName, args }) });

const aid = await deploy(deployer, 'MockAgentID');
const ctf = await deploy(deployer, 'MockConditionalTokens');
const ledger = await deploy(deployer, 'OpenForecasts', [aid, [ctf], deployer.address, keeper.address]);
await write(user, aid, 'MockAgentID', 'mint', ['openplayer']);
const cid = keccak256(toHex(`btc 2m ${Date.now()}`));
await write(deployer, ctf, 'MockConditionalTokens', 'prepare', [cid, 2n]);
say(`OpenForecasts ${ledger} (local)`);

// fake Predict.fun API: one market ending in 2 minutes, a two sided Yes book at 0.55 / 0.59 (middle 57%)
const endsAt = new Date(Date.now() + 120_000).toISOString();
const market = { id: 777, title: 'Bitcoin Up or Down, next 2 minutes', question: 'Bitcoin Up or Down, next 2 minutes', conditionId: cid, isYieldBearing: false, isNegRisk: false, categorySlug: 'btc-2m', tradingStatus: 'OPEN', status: 'REGISTERED', stats: { volume24hUsd: 5000 }, outcomes: [{ name: 'Up', indexSet: 1 }, { name: 'Down', indexSet: 2 }] };
let spike = false;
const server = createServer((req, res) => {
  // price history: 57% for the last 10 minutes, then a spike to 90% that only appears after the commit (must be ignored)
  const t = Math.floor(Date.now() / 60000) * 60;
  const body = req.url.startsWith('/v1/markets/777/timeseries') ? { resolution: '1m', series: [...Array(10)].map((_, i) => ({ x: t - 540 + i * 60, y: 57 })).concat(spike ? [{ x: Math.floor(Date.now() / 1000) + 1, y: 90 }] : []) }
    : req.url.startsWith('/v1/markets/777') ? market : req.url.startsWith('/v1/categories/btc-2m') ? { slug: 'btc-2m', title: 'Bitcoin 2 minute', endsAt, tradingSession: { closesAt: endsAt } } : null;
  res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ success: !!body, data: body }));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${server.address().port}`;
process.env.FOREWIT_PREDICT_API = API;
process.env.FOREWIT_OPEN_LEDGER = ledger;

// the player: the CLI's own open forecast path, 70% Up with auto reveal; the mock CTF stands in for Predict's
const { openPlan } = await import(`file://${join(REPO, 'agent/forewit.mjs').replace(/\\/g, '/')}`);
const home = mkdtempSync(join(tmpdir(), 'forewit_open_'));
const net = { name: 'testnet', chainId: 97, ledger: '0x' + '00'.repeat(20), open: ledger, rpc: RPC, explorer: '' };
process.env.FOREWIT_TEST_CTF = ctf; // the mock Conditional Tokens stand in for the Predict ones on this local chain
const plan = await openPlan({ net, from: user.address, marketId: 777, outcome: 1, percent: 70, autoReveal: true, home });
await pub.waitForTransactionReceipt({ hash: await wallet(user).sendTransaction({ to: ledger, data: plan.data }) });
say(`player forecast 70% Up on market 777 with auto reveal; one transaction`);
spike = true; // someone pushes the price to 90% right after the commit: the keeper must still record 57%

const env = { ...process.env, FOREWIT_TEST_CTF: ctf, OPEN_LEDGER: ledger, OPEN_FROM_BLOCK: '0', OPEN_NETWORK: 'testnet', OPEN_CHAIN_ID: '97', BSC_TESTNET_RPC_URL: RPC, LOGS_RPC_URL: RPC, KEEPER_PRIVATE_KEY: KEYS[1], OPEN_API_URL: API, OPEN_ONCE: '1' };
const W = mkdtempSync(join(tmpdir(), 'forewit_openk_'));
// async child: the fake API lives in this process, so a blocking exec would starve it
const keeperPass = () => new Promise((ok) => {
  let out = '';
  const c = spawn(process.execPath, [join(REPO, 'keeper/open.mjs')], { cwd: REPO, env: { ...env, OPEN_STATE_DIR: W } });
  c.stdout.on('data', (d) => (out += d));
  c.stderr.on('data', (d) => (out += d));
  c.on('close', () => ok(out.trim().split('\n').filter((l) => l && !/beacon received/.test(l)).map((l) => '    keeper ' + l.replace(/^\S+Z /, '')).join('\n')));
});
await new Promise((r) => setTimeout(r, 18000)); // the keeper reads 15 blocks behind the tip (about 7 s on BSC, 15 s here)
console.log(await keeperPass());
const key = plan.receipt.key;
const f1 = await pub.readContract({ address: ledger, abi: art('OpenForecasts').abi, functionName: 'forecasts', args: [key, user.address] });
say(`market price recorded within seconds: ${Number(f1[5]) / 100}% (flags ${f1[3]})`);

// the market ends and resolves Up (slot 0 gets the full payout); the drand round opens just after the end
await new Promise((r) => setTimeout(r, Date.parse(endsAt) + 75_000 - Date.now()));
await write(deployer, ctf, 'MockConditionalTokens', 'resolve', [cid, [1n, 0n]]);
await new Promise((r) => setTimeout(r, 18000)); // the keeper reads 15 blocks behind the tip (about 7 s on BSC, 15 s here)
console.log(await keeperPass());
const s = await pub.readContract({ address: ledger, abi: art('OpenForecasts').abi, functionName: 'getStats', args: [user.address] });
const brier = 3000 ** 2, base = 4300 ** 2; // you 70% Up, market 57% Up, outcome Up
const points = Math.round(((base - brier) / 1e8) * 1000) / 10;
const pass = Number(s.scored) === 1 && Number(s.sumBrier) === brier && Number(s.sumSkill) === base - brier;
console.log(`\n  scored ${s.scored}, your miss ${brier / 1e6}, market miss ${base / 1e6}: you beat the market by ${points} points`);
console.log(pass ? `E2E OPEN PASS in ${Math.round((Date.now() - t0) / 1000)} s, zero cost` : 'E2E OPEN FAILED');
server.close();
rmSync(home, { recursive: true, force: true });
process.exit(pass ? 0 : 1);
