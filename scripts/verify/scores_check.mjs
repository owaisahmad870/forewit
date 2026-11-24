// Read only check of the mainnet ForewitScores: wiring, roles, deployer holds none, no epochs yet.
// Run: node --env-file=.env scripts/verify/scores_check.mjs
import { createPublicClient, http, fallback, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
const S = '0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc';
const D = '0x6732027E7f908E274bF4360Ce19cC182F82d008C', A = '0xF3b4728B30F0F380d77dE9d025E33680F66591bD', K = '0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18';
const abi = parseAbi(['function LEDGER() view returns (address)', 'function AGENT_ID() view returns (address)', 'function defaultAdmin() view returns (address)', 'function hasRole(bytes32,address) view returns (bool)', 'function ROUND_MANAGER_ROLE() view returns (bytes32)', 'function DEFAULT_ADMIN_ROLE() view returns (bytes32)', 'function latestEpoch() view returns (uint256)']);
const c = createPublicClient({ chain: bsc, transport: fallback([process.env.RPC_MAINNET_PRIMARY, process.env.RPC_MAINNET_FALLBACK, 'https://bsc-rpc.publicnode.com'].filter(Boolean).map((u) => http(u))) });
const r = (f, a = []) => c.readContract({ address: S, abi, functionName: f, args: a });
const [mgr, adm] = [await r('ROUND_MANAGER_ROLE'), await r('DEFAULT_ADMIN_ROLE')];
console.log(JSON.stringify({ ledger: await r('LEDGER'), agentId: await r('AGENT_ID'), defaultAdmin: await r('defaultAdmin'), keeperIsManager: await r('hasRole', [mgr, K]), keeperIsAdmin: await r('hasRole', [adm, K]), adminIsManager: await r('hasRole', [mgr, A]), deployerRoles: [await r('hasRole', [adm, D]), await r('hasRole', [mgr, D])], latestEpoch: String(await r('latestEpoch')) }, null, 1));
