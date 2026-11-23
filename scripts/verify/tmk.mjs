import { createPublicClient, http, parseAbi } from 'viem';
import { bscTestnet } from 'viem/chains';
import { readFileSync } from 'fs';
const c = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') });
const d = JSON.parse(readFileSync('mk.json')).data;
const CTFS = { std: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743', yb: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f', ybnr: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5' };
const abi = parseAbi(['function getOutcomeSlotCount(bytes32) view returns (uint256)', 'function payoutDenominator(bytes32) view returns (uint256)', 'function payoutNumerators(bytes32,uint256) view returns (uint256)']);
const rd = (a, f, args) => c.readContract({ address: a, abi, functionName: f, args }).catch(e => 'ERR');
for (const m of d.filter(m => m.status === 'RESOLVED').concat(d.filter(m => m.status !== 'RESOLVED').slice(0, 3))) {
  const row = { id: m.id, negRisk: m.isNegRisk, yb: m.isYieldBearing, status: m.status, won: m.resolution?.name + ':' + m.resolution?.indexSet, outcomes: m.outcomes.map(o => o.name).join('/') };
  for (const [k, a] of Object.entries(CTFS)) {
    const n = await rd(a, 'getOutcomeSlotCount', [m.conditionId]);
    if (n !== 0n && n !== 'ERR') { row.ctf = k; row.slots = n; row.den = await rd(a, 'payoutDenominator', [m.conditionId]); row.nums = [await rd(a, 'payoutNumerators', [m.conditionId, 0n]), await rd(a, 'payoutNumerators', [m.conditionId, 1n])]; }
  }
  console.log(JSON.stringify(row, (_, v) => typeof v === 'bigint' ? v.toString() : v));
}
