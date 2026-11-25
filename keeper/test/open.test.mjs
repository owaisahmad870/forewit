import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFromHistory, voidReason, liveMidBps, tooLate } from '../open.mjs';

const CTF = '0x22DA1810B194ca018378464a58f6Ac2B10C9d244';
const CID = '0x' + 'ab'.repeat(32);

test('final review: the price comes from before the commit and cannot be planted after it', () => {
  const series = [{ x: 960, y: 40 }, { x: 1020, y: 41 }, { x: 1080, y: 90 }]; // the 1080 bucket runs past the commit at 1100
  assert.deepEqual(priceFromHistory(series, 1100, 0, 500, 4150), { ok: true, bps: 4100, at: 1020 });
  assert.deepEqual(priceFromHistory(series, 1100, 1, 500, 4150), { ok: true, bps: 5900, at: 1020 });
  assert.match(priceFromHistory([{ x: 500, y: 40 }], 1100, 0, 500, 4000).why, /3 minutes before/);
  assert.match(priceFromHistory(series, 1100, 0, 20, 4100).why, /traded in 24 hours/);
  assert.equal(priceFromHistory([{ x: 1000, y: 100 }], 1100, 0, 500, 9900).ok, false);
});

test('final review M2 (rule v2.1): no price when the live book has moved from the last bucket', () => {
  const series = [{ x: 1020, y: 41 }];
  assert.match(priceFromHistory(series, 1100, 0, 500, 4800).why, /moved 7 points/); // commit timed after a jump
  assert.match(priceFromHistory(series, 1100, 0, 500, null).why, /no live price/);
  assert.equal(liveMidBps({ bids: [[0.4, 10]], asks: [[0.42, 10]] }), 4100);
  assert.equal(liveMidBps({ bids: [], asks: [[0.5, 1]] }), null);
});

test('off chain review M5: no price in the last 20 percent of a market (at least 60 s)', () => {
  assert.equal(tooLate({ committedAt: 1000, startsAtS: 700, endsAtS: 1000 + 100 }), false); // 400 s market, 100 s left (limit 80 s)
  assert.equal(tooLate({ committedAt: 1000, startsAtS: 100, endsAtS: 1000 + 100 }), true); // 100 s left of a 1000 s market
  assert.equal(tooLate({ committedAt: 1000, startsAtS: NaN, endsAtS: 1030 }), true);
  assert.equal(tooLate({ committedAt: 1000, startsAtS: NaN, endsAtS: NaN }), false);
});

test('rule v2.2: commits from 25 Nov 2026 20:00 UTC lose only the last 60 s', () => {
  const t = 1795636800;
  assert.equal(tooLate({ committedAt: t, startsAtS: t - 600, endsAtS: t + 100 }), false); // 100 s left of a 700 s market
  assert.equal(tooLate({ committedAt: t, startsAtS: t - 600, endsAtS: t + 59 }), true);
  assert.equal(tooLate({ committedAt: t - 1, startsAtS: t - 600, endsAtS: t + 100 }), true); // v2.1 still applies before
});

test('void only on positive evidence', () => {
  const f = { conditionId: CID, ctf: CTF, committedAt: 1000 };
  const ok = { conditionId: CID, isYieldBearing: false, isNegRisk: false, tradingStatus: 'OPEN', outcomes: [{ indexSet: 1 }, { indexSet: 2 }] };
  assert.equal(voidReason({ f, market: ok, endsAtS: 2000, readAtS: 1005, chainId: 56 }), 0);
  assert.equal(voidReason({ f, market: null, endsAtS: NaN, readAtS: 1005, chainId: 56 }), 3); // review M1: no such market
  assert.equal(voidReason({ f, market: { ...ok, conditionId: '0x' + 'cd'.repeat(32) }, endsAtS: 2000, readAtS: 1005, chainId: 56 }), 3);
  assert.equal(voidReason({ f, market: { ...ok, isYieldBearing: true }, endsAtS: 2000, readAtS: 1005, chainId: 56 }), 3); // wrong CTF
  assert.equal(voidReason({ f, market: { ...ok, outcomes: [{ indexSet: 2 }, { indexSet: 1 }] }, endsAtS: 2000, readAtS: 1005, chainId: 56 }), 3); // review M7
  assert.equal(voidReason({ f, market: ok, endsAtS: 1000, readAtS: 1005, chainId: 56 }), 1);
  assert.equal(voidReason({ f, market: { ...ok, tradingStatus: 'CLOSED' }, endsAtS: 2000, readAtS: 1010, chainId: 56 }), 2);
  assert.equal(voidReason({ f, market: { ...ok, tradingStatus: 'CLOSED' }, endsAtS: 2000, readAtS: 1100, chainId: 56 }), 0); // review L2: read late, no void
  // re-review N1: a reveal start far after the market end is void
  assert.equal(voidReason({ f: { ...f, revealNotBefore: 2060 }, market: ok, endsAtS: 2000, readAtS: 1005, chainId: 56 }), 0);
  assert.equal(voidReason({ f: { ...f, revealNotBefore: 2000 + 120 * 86400 }, market: ok, endsAtS: 2000, readAtS: 1005, chainId: 56 }), 4);
  assert.equal(voidReason({ f: { ...f, revealNotBefore: 5000 }, market: ok, endsAtS: NaN, readAtS: 1005, chainId: 56 }), 4);
});
