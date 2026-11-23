import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missedDuties, dailyOpenMissed, GRACE, DAY } from '../lib/watchdog.mjs';

const CD = 1_800_000_000, RD = CD + 24 * 3600;
const ZERO = '0x' + '0'.repeat(64), H = '0x' + 'ab'.repeat(32);
const round = (o = {}) => ({ commitDeadline: CD, revealDeadline: RD, questionCount: 3, resolvedMask: 0, baselineCommit: H, baselineRevealed: true, isSealed: true, ...o });
const check = (o, now, extra = {}) => missedDuties({ round: round(o), resolvedOnchainMask: 0, unprocessed: 0, now, ...extra });

test('a round on schedule reports nothing', () => {
  assert.deepEqual(check({ isSealed: false, baselineRevealed: false }, CD - 60), []);
  assert.deepEqual(check({}, CD + 2 * GRACE), []);
});

test('missed baseline commit is detected at the deadline', () => {
  assert.match(check({ baselineCommit: ZERO, isSealed: false, baselineRevealed: false }, CD)[0], /baseline: not committed/);
});

test('missed seal and missed baseline reveal are detected after the grace period, not before', () => {
  assert.deepEqual(check({ isSealed: false, baselineRevealed: false }, CD + GRACE), []);
  const m = check({ isSealed: false, baselineRevealed: false }, CD + GRACE + 1);
  assert.ok(m.some((x) => x.startsWith('seal')) && m.some((x) => x.startsWith('baseline reveal')));
});

test('missed finalize: resolved onchain but not finalized', () => {
  assert.match(check({ resolvedMask: 1 }, CD + 2 * GRACE, { resolvedOnchainMask: 0b011 })[0], /finalize.*mask 2/);
});

test('missed score after the reveal deadline when the round is fully resolved', () => {
  assert.deepEqual(check({ resolvedMask: 7 }, RD + GRACE, { unprocessed: 2 }), []);
  assert.match(check({ resolvedMask: 7 }, RD + GRACE + 1, { unprocessed: 2 })[0], /score: 2 committers/);
  assert.deepEqual(check({ resolvedMask: 3 }, RD + 2 * GRACE, { unprocessed: 2 }), []); // not fully resolved yet: not late
});

test('missed daily open', () => {
  assert.deepEqual(dailyOpenMissed(CD, CD + DAY + GRACE), []);
  assert.match(dailyOpenMissed(CD, CD + DAY + GRACE + 1)[0], /open: no new daily round/);
});
