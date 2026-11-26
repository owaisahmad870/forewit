import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFromLogs } from '../build_start.mjs';

test('starts: one per wallet, oldest first, duplicate logs never double count', () => {
  const log = (p, n, at, tx) => ({ transactionHash: tx, args: { player: p, number: String(n), at: String(at) } });
  const A = '0x' + 'A'.repeat(40), B = '0x' + 'b'.repeat(40);
  const s = startFromLogs('0xc', [log(A, 1, 100, '0x1'), log(B, 2, 200, '0x2'), log(A, 1, 100, '0x1')]);
  assert.equal(s.count, 2);
  assert.deepEqual(s.players.map((p) => [p.player, p.number, p.at]), [[A.toLowerCase(), 1, 100], [B, 2, 200]]);
  assert.equal(startFromLogs('0xc', []).count, 0);
});
