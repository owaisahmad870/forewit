import { createPublicClient, http, parseAbi } from 'viem';
import { bscTestnet } from 'viem/chains';
import { readFileSync } from 'fs';
const c = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') });
const abi = parseAbi(['function getOutcomeSlotCount(bytes32) view returns (uint256)', 'function payoutDenominator(bytes32) view returns (uint256)', 'function payoutNumerators(bytes32,uint256) view returns (uint256)']);
const CTFS = { std: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743', yb: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f', ybnr: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5' };
for (const m of JSON.parse(readFileSync('yb.json')).slice(0, 4)) {
  const row = { id: m.id, negRisk: m.isNegRisk };
  for (const [k, a] of Object.entries(CTFS)) { const n = await c.readContract({ address: a, abi, functionName: 'getOutcomeSlotCount', args: [m.conditionId] }); if (n > 0n) { row.ctf = k; row.den = await c.readContract({ address: a, abi, functionName: 'payoutDenominator', args: [m.conditionId] }); row.n0 = await c.readContract({ address: a, abi, functionName: 'payoutNumerators', args: [m.conditionId, 0n] }); row.api = m.resolution?.name; } }
  console.log(JSON.stringify(row, (_, v) => typeof v === 'bigint' ? v.toString() : v));
}
