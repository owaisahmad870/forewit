// Mainnet Yes slot check. Run: node --env-file=.env scripts/verify/mainnet_yes_slot.mjs
// Never prints PREDICT_API_KEY. Needs viem installed next to it or globally.
import { createPublicClient, http, parseAbi } from 'viem';
import { bsc } from 'viem/chains';

const KEY = process.env.PREDICT_API_KEY;
if (!KEY) throw new Error('PREDICT_API_KEY missing');
const c = createPublicClient({ chain: bsc, transport: http(process.env.BSC_RPC_URL || 'https://bsc-rpc.publicnode.com') });
const CTFS = { std: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', yb: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', ybnr: '0xF64b0b318AAf83BD9071110af24D24445719A07F' };
const abi = parseAbi(['function getOutcomeSlotCount(bytes32) view returns (uint256)', 'function payoutDenominator(bytes32) view returns (uint256)', 'function payoutNumerators(bytes32,uint256) view returns (uint256)']);

async function page(after, status) {
  const q = new URLSearchParams({ first: '100' });
  if (after) q.set('after', after);
  if (status) q.set('status', status);
  const r = await fetch('https://api.predict.fun/v1/markets?' + q, { headers: { 'x-api-key': KEY } });
  if (!r.ok) throw new Error('HTTP ' + r.status); // body may echo nothing sensitive, but skip it anyway
  return r.json();
}

let cur = '', resolved = [], total = 0, open = [];
for (let p = 0; p < 30 && resolved.length < 40; p++) {
  const r = await page(cur);
  total += r.data.length;
  resolved.push(...r.data.filter((m) => m.status === 'RESOLVED' && m.resolution));
  open.push(...r.data.filter((m) => m.status !== 'RESOLVED'));
  cur = r.cursor;
  if (!cur || !r.data.length) break;
}
console.log('scanned', total, 'resolved with resolution', resolved.length, 'open', open.length);

const tally = {};
let agree = 0, disagree = 0, checked = 0;
for (const m of resolved.slice(0, 40)) {
  const names = m.outcomes.map((o) => o.name + ':' + o.indexSet).join('/');
  let ctf = null, den, n0, n1;
  for (const [k, a] of Object.entries(CTFS)) {
    const n = await c.readContract({ address: a, abi, functionName: 'getOutcomeSlotCount', args: [m.conditionId] });
    if (n > 0n) { ctf = k; den = await c.readContract({ address: a, abi, functionName: 'payoutDenominator', args: [m.conditionId] }); if (n === 2n) { n0 = await c.readContract({ address: a, abi, functionName: 'payoutNumerators', args: [m.conditionId, 0n] }); n1 = await c.readContract({ address: a, abi, functionName: 'payoutNumerators', args: [m.conditionId, 1n] }); } }
  }
  const key = `negRisk=${m.isNegRisk} yb=${m.isYieldBearing} ctf=${ctf} names=${names}`;
  tally[key] = (tally[key] || 0) + 1;
  if (den > 0n && n0 !== undefined) {
    checked++;
    const chainWinnerSlot = n0 === den ? 0 : n1 === den ? 1 : 'split';
    const apiWinnerSlot = m.resolution.indexSet - 1; // indexSet 1 => slot 0, indexSet 2 => slot 1
    if (chainWinnerSlot === apiWinnerSlot) agree++; else { disagree++; console.log('MISMATCH id', m.id, 'api', m.resolution.name, 'chain', chainWinnerSlot, `${n0}/${n1}/${den}`); }
  }
}
for (const [k, v] of Object.entries(tally)) console.log(v, k);
console.log('chain checked', checked, 'indexSet to slot agrees', agree, 'disagrees', disagree);
const ot = {};
for (const m of open) { const k = `negRisk=${m.isNegRisk} yb=${m.isYieldBearing} names=${m.outcomes.map((o) => o.name + ':' + o.indexSet).join('/')}`; ot[k] = (ot[k] || 0) + 1; }
console.log('open market shapes:'); for (const [k, v] of Object.entries(ot)) console.log(v, k);
