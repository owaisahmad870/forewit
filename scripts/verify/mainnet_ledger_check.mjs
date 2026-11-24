// Read only check of the mainnet ForecastLedger: constants, allowlist, roles, pause, deployer holds nothing.
// Run: node --env-file=.env scripts/verify/mainnet_ledger_check.mjs
import { createPublicClient, http, fallback } from 'viem';
import { bsc } from 'viem/chains';
import { readFileSync } from 'node:fs';
const L = '0xd11e67ff70ACD42E01d79130f280162b00Bb09B6';
const D = '0x6732027E7f908E274bF4360Ce19cC182F82d008C', A = '0xF3b4728B30F0F380d77dE9d025E33680F66591bD', K = '0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18';
const abi = JSON.parse(readFileSync('keeper/abi/ForecastLedger_v1_2.json', 'utf8'));
const c = createPublicClient({ chain: bsc, transport: fallback([process.env.RPC_MAINNET_PRIMARY, process.env.RPC_MAINNET_FALLBACK, 'https://bsc-rpc.publicnode.com'].filter(Boolean).map((u) => http(u))) });
const r = (fn, args = []) => c.readContract({ address: L, abi, functionName: fn, args });
const [admin, mgr, pauser] = [await r('DEFAULT_ADMIN_ROLE'), await r('ROUND_MANAGER_ROLE'), await r('PAUSER_ROLE')];
const out = {
  chain: await c.getChainId(), agentId: await r('AGENT_ID'), minCommit: await r('MIN_COMMIT_WINDOW'), minReveal: await r('MIN_REVEAL_WINDOW'),
  ctfs: await Promise.all(['0x22DA1810B194ca018378464a58f6Ac2B10C9d244', '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', '0xF64b0b318AAf83BD9071110af24D24445719A07F'].map((x) => r('isAllowedCtf', [x]))),
  defaultAdmin: await r('defaultAdmin'), adminIsPauser: await r('hasRole', [pauser, A]), keeperIsManager: await r('hasRole', [mgr, K]),
  keeperHasAdmin: await r('hasRole', [admin, K]), deployerRoles: [admin, mgr, pauser].map(() => null), paused: await r('paused'), rounds: await r('roundCount'),
};
out.deployerRoles = await Promise.all([admin, mgr, pauser].map((x) => r('hasRole', [x, D])));
console.log(JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 1));
