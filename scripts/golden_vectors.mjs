// Reference scoring in plain JavaScript (BigInt), independent of the Solidity code.
// Asserts the golden vectors that contracts/test/ForecastLedgerFuzz.t.sol also asserts (test_golden*).
// Run from the repo root: npm ci, then npm run golden.
import { keccak256, toHex, encodeAbiParameters } from 'viem';

const BPS = 10_000n;
const MAX_BRIER = BPS * BPS;
export const pack = (ps) => ps.reduce((acc, p, i) => acc | (BigInt(p) << BigInt(16 * i)), 0n);
export const unpack = (packed, i) => (packed >> BigInt(16 * i)) & 0xffffn;
const sq = (p, o) => (p > o ? p - o : o - p) ** 2n;

/** outcomes: array of 'Y' | 'N' | 'V'. Returns the sums the contract adds to Stats for one round. */
export function scoreRound(packed, baseline, outcomes, { forfeit = false } = {}) {
  let questions = 0n, brier = 0n, base = 0n;
  outcomes.forEach((o, i) => {
    if (o === 'V') return;
    const y = o === 'Y' ? BPS : 0n;
    brier += forfeit ? MAX_BRIER : sq(unpack(packed, i), y);
    if (baseline !== null) base += sq(unpack(baseline, i), y);
    questions += 1n;
  });
  const skill = baseline !== null ? base - brier : 0n;
  return { questions, brier, base: baseline !== null ? base : 0n, skill };
}

export function commitHash(chainId, ledger, roundId, forecaster, packed, salt) {
  const typehash = keccak256(toHex('PrescientCommit(uint256 chainId,address ledger,uint256 roundId,address forecaster,uint256 packed,bytes32 salt)'));
  return keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }],
    [typehash, BigInt(chainId), ledger, BigInt(roundId), forecaster, packed, salt],
  ));
}

// Runs only when executed directly, so the CLI can import pack, scoreRound and commitHash.
if (import.meta.filename === process.argv[1]) {
// Golden constants asserted here and in contracts/test/ForecastLedgerFuzz.t.sol (test_golden*). Exit 1 on mismatch.
const outcomes = ['Y', 'N', 'V', 'Y'];
const p = pack([8000, 3000, 9000, 6500]);
const b = pack([6000, 5000, 5000, 7000]);
const checks = [
  ['packed', p, 1829626003521544000n],
  ['baseline', b, 1970346312138758000n],
  ...Object.entries({ questions: 3n, brier: 25250000n, base: 50000000n, skill: 24750000n }).map(([k, v]) => ['reveal with baseline ' + k, scoreRound(p, b, outcomes)[k], v]),
  ...Object.entries({ questions: 3n, brier: 25250000n, base: 0n, skill: 0n }).map(([k, v]) => ['reveal no baseline ' + k, scoreRound(p, null, outcomes)[k], v]),
  ...Object.entries({ questions: 3n, brier: 300000000n, base: 50000000n, skill: -250000000n }).map(([k, v]) => ['forfeit ' + k, scoreRound(p, b, outcomes, { forfeit: true })[k], v]),
  ['commit hash', commitHash(56, '0x1111111111111111111111111111111111111111', 7, '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5', pack([9000, 2000, 10000]), keccak256(toHex('golden'))), '0xb0783bf99db452b430677be72e1ab49fbf4157465fa4d29e0b671e41d3fca1f7'],
];
let bad = 0;
for (const [name, got, want] of checks) if (got !== want) { bad++; console.error('MISMATCH', name, String(got), '!=', String(want)); }
console.log(bad ? `golden vectors: ${bad} mismatches` : `golden vectors: all ${checks.length} match`);
process.exit(bad ? 1 : 0);
}
