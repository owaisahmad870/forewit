// Run: node --test keeper/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { takeBaseline, snapshotTimeOk, midBps, MAX_EARLY_MS } from '../lib/baseline.mjs';

const DEADLINE = Date.parse('2026-11-30T23:00:00Z');
const book = (bid, ask) => ({ bids: bid === null ? [] : [[bid, 10]], asks: ask === null ? [] : [[ask, 10]], updateTimestampMs: DEADLINE - 1000 });
const clock = (start, step = 1000) => { let t = start; return () => (t += step) - step; };

test('the snapshot is taken within 15 minutes before the commit deadline', async () => {
  const b = await takeBaseline({ deadlineMs: DEADLINE, marketIds: [1, 2, 3], fetchBook: async () => book(0.4, 0.5), now: clock(DEADLINE - 3 * 60 * 1000) });
  for (const t of [b.takenAtStart, b.takenAtEnd, ...b.books.map((x) => x.takenAt)]) {
    assert.ok(DEADLINE - t <= MAX_EARLY_MS && t < DEADLINE, `snapshot at ${t} is more than 15 minutes from the deadline`);
  }
  assert.equal(b.books[0].bps, 4500);
});

test('refuses a snapshot more than 15 minutes before the deadline (round open time)', async () => {
  await assert.rejects(
    takeBaseline({ deadlineMs: DEADLINE, marketIds: [1], fetchBook: async () => book(0.4, 0.5), now: clock(DEADLINE - 20 * 3600 * 1000) }),
    /baseline refused/,
  );
  await assert.rejects(
    takeBaseline({ deadlineMs: DEADLINE, marketIds: [1], fetchBook: async () => book(0.4, 0.5), now: clock(DEADLINE - MAX_EARLY_MS - 1) }),
    /baseline refused/,
  );
});

test('refuses at or after the deadline', async () => {
  await assert.rejects(takeBaseline({ deadlineMs: DEADLINE, marketIds: [1], fetchBook: async () => book(0.4, 0.5), now: clock(DEADLINE) }), /baseline refused/);
});

test('refuses when slow fetches push the snapshot past the deadline', async () => {
  await assert.rejects(
    takeBaseline({ deadlineMs: DEADLINE, marketIds: [1, 2, 3], fetchBook: async () => book(0.4, 0.5), now: clock(DEADLINE - 60 * 1000, 40 * 1000) }),
    /outside the 15 minute window/,
  );
});

test('window edges', () => {
  assert.equal(snapshotTimeOk(DEADLINE - MAX_EARLY_MS, DEADLINE), true);
  assert.equal(snapshotTimeOk(DEADLINE - MAX_EARLY_MS - 1, DEADLINE), false);
  assert.equal(snapshotTimeOk(DEADLINE - 1, DEADLINE), true);
  assert.equal(snapshotTimeOk(DEADLINE, DEADLINE), false);
});

test('mid price and fallbacks', () => {
  assert.deepEqual(midBps(book(0.33, 0.37)), { bps: 3500, source: 'mid' });
  assert.deepEqual(midBps({ ...book(null, 0.6), lastOrderSettled: { price: '0.58' } }), { bps: 5800, source: 'last_trade' });
  assert.equal(midBps(book(null, null)), null);
});
