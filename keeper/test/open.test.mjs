import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFromBook, priceFromHistory, voidReason } from '../open.mjs';

const CTF = '0x22DA1810B194ca018378464a58f6Ac2B10C9d244';
const CID = '0x' + 'ab'.repeat(32);

test('market price: middle of a deep two sided Yes book, mirrored for slot 1', () => {
  const book = { bids: [[0.62, 200]], asks: [[0.66, 100]] };
  assert.deepEqual(priceFromBook(book, 0), { ok: true, bps: 6400 });
  assert.deepEqual(priceFromBook(book, 1), { ok: true, bps: 3600 });
  assert.equal(priceFromBook({ bids: [[0.55, 200]], asks: [[0.65, 200]] }, 0).ok, true); // exactly 10 points counts (integer compare)
});

test('review H1: dust orders cannot set the price; thin or wide books score on accuracy only', () => {
  assert.match(priceFromBook({ bids: [[0.9, 1]], asks: [[0.94, 1]] }, 0).why, /less than 50 USD/);
  assert.equal(priceFromBook({ bids: [], asks: [[0.5, 1000]] }, 0).ok, false);
  assert.match(priceFromBook({ bids: [[0.3, 1000]], asks: [[0.45, 1000]] }, 0).why, /spread 15 points/);
  assert.match(priceFromBook({ bids: [[0.62, 200]], asks: [[0.66, 100]] }, 0, 50, 20).why, /traded in 24 hours/); // same floor as v1
});

test('final review: the price comes from before the commit and cannot be planted after it', () => {
  const series = [{ x: 1000, y: 40 }, { x: 1060, y: 41 }, { x: 1120, y: 90 }]; // 90 appears after the commit at 1100
  assert.deepEqual(priceFromHistory(series, 1100, 0, 500), { ok: true, bps: 4100, at: 1060 });
  assert.deepEqual(priceFromHistory(series, 1100, 1, 500), { ok: true, bps: 5900, at: 1060 });
  assert.match(priceFromHistory([{ x: 500, y: 40 }], 1100, 0, 500).why, /5 minutes before/);
  assert.match(priceFromHistory(series, 1100, 0, 20).why, /traded in 24 hours/);
  assert.equal(priceFromHistory([{ x: 1000, y: 100 }], 1100, 0, 500).ok, false);
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
