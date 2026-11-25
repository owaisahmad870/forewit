import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPEN_LEDGER = '0x' + '11'.repeat(20); // module load needs a ledger; nothing runs at import
const { priceFromBook } = await import('../open.mjs');

test('market price: middle of a two sided Yes book, mirrored for slot 1, refused when thin', () => {
  const book = { bids: [[0.62, 100]], asks: [[0.66, 50]] };
  assert.deepEqual(priceFromBook(book, 0), { ok: true, bps: 6400 });
  assert.deepEqual(priceFromBook(book, 1), { ok: true, bps: 3600 });
  assert.equal(priceFromBook({ bids: [], asks: [[0.5, 1]] }, 0).ok, false);
  assert.match(priceFromBook({ bids: [[0.3, 1]], asks: [[0.45, 1]] }, 0).why, /spread 15 points/);
});
