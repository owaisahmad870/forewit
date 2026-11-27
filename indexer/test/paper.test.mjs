import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkBuy, sideAsks, paperTrade, summarize, PAPER } from '../lib/paper.mjs';

// Round 1 question 0, the real saved book (top levels)
const book = { bids: [[0.63, 164.5587], [0.62, 320]], asks: [[0.65, 114.457], [0.66, 245.61]] };

test('walkBuy walks levels in order and reports the average price', () => {
  const f = walkBuy([[0.5, 10], [0.6, 100]], 11);
  assert.equal(f.spent, 11);
  assert.ok(Math.abs(f.shares - (10 + 6 / 0.6)) < 1e-9); // 10 at 0.50, then 6 USDT at 0.60
  assert.ok(Math.abs(f.avgPrice - 11 / 20) < 1e-9);
  const thin = walkBuy([[0.5, 4]], 10);
  assert.equal(thin.spent, 2);
});

test('a No buy takes the Yes bids at 1 minus their price', () => {
  assert.deepEqual(sideAsks(book, 'No').map(([p]) => Math.round(p * 100)), [37, 38]);
});

test('hand computed Yes trade on the real round 1 book: fee in shares, payout, pnl', () => {
  const t = paperTrade({ youBps: 7500, book, outcome: 'Yes' });
  // 10 / 0.65 = 15.3846 shares; fee = 0.02 x 0.35 x 15.3846 = 0.1077 USDT = 0.1657 shares; net 15.2189
  assert.equal(t.side, 'Yes');
  assert.equal(t.edgePts, 10);
  assert.equal(t.spent, 10);
  assert.equal(t.avgPrice, 0.65);
  assert.equal(t.shares, 15.22);
  assert.equal(t.feeUsdt, 0.11);
  assert.equal(t.payout, 15.21); // less 0.01 redeem gas
  assert.equal(t.pnl, 5.21);
  assert.equal(paperTrade({ youBps: 7500, book, outcome: 'No' }).pnl, -10);
});

test('no trade inside the edge threshold, No trade below the market, unresolved stays open', () => {
  assert.equal(paperTrade({ youBps: 6800, book, outcome: 'Yes' }).side, null); // 68 vs ask 65: 3 points
  const no = paperTrade({ youBps: 2000, book, outcome: 'No' }); // No chance 80 vs No ask 37
  assert.equal(no.side, 'No');
  assert.ok(no.pnl > 0);
  const open = paperTrade({ youBps: 9000, book, outcome: 'Unresolved' });
  assert.equal(open.pnl, undefined);
});

test('too thin a book is no trade', () => {
  assert.equal(paperTrade({ youBps: 9900, book: { bids: [], asks: [[0.5, 1]] }, outcome: 'Yes' }).reason, 'too_thin');
});

test('summary totals, seeded bootstrap range, and the judging threshold', () => {
  const ts = [{ side: 'Yes', spent: 10, pnl: 5 }, { side: 'No', spent: 10, pnl: -10 }, { side: 'Yes', spent: 10, pnl: 2 }];
  const s = summarize(ts);
  assert.equal(s.trades, 3);
  assert.equal(s.pnl, -3);
  assert.equal(s.roi, -0.1);
  assert.ok(s.roiLow <= s.roi && s.roi <= s.roiHigh);
  assert.deepEqual(summarize(ts), s); // deterministic
  assert.equal(s.enough, false);
  assert.equal(PAPER.MIN_TRADES_TO_JUDGE, 20);
});

test('the walk never pays more than your chance minus the edge threshold', () => {
  const deep = { bids: [], asks: [[0.5, 4], [0.6, 100], [0.7, 100]] };
  const t = paperTrade({ youBps: 6600, book: deep, outcome: 'Yes' }); // cap 0.61: takes 0.50 and 0.60, never 0.70
  assert.equal(t.spent, 10);
  assert.ok(t.avgPrice <= 0.61);
  const capped = paperTrade({ youBps: 5600, book: deep, outcome: 'Yes' }); // cap 0.51: only the 2 USDT at 0.50
  assert.equal(capped.spent, 2);
  assert.equal(capped.partial, true);
});

test('the range resamples whole rounds: one round gives no range', () => {
  const one = summarize([{ side: 'Yes', spent: 10, pnl: 5, round: '1' }, { side: 'No', spent: 10, pnl: -10, round: '1' }]);
  assert.equal(one.roiLow, null);
  const two = summarize([{ side: 'Yes', spent: 10, pnl: 5, round: '1' }, { side: 'No', spent: 10, pnl: -10, round: '2' }]);
  assert.ok(two.roiLow <= two.roi && two.roi <= two.roiHigh);
});

test('v1.1: a market fee rate overrides the fallback and is recorded on the trade', () => {
  const t = paperTrade({ youBps: 7500, book, outcome: 'Yes', p: { ...PAPER, FEE_BPS: 100 } });
  assert.equal(t.feeBps, 100);
  assert.equal(t.feeUsdt, 0.05); // half of the 200 bps fee (0.1077)
  assert.equal(paperTrade({ youBps: 7500, book, outcome: 'Yes' }).feeBps, 200);
});
