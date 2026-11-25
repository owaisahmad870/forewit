import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketsView, groupOf } from '../lib/markets.mjs';

const m = (id, marketVariant, title, vol, bid, ask) => ({ id, marketVariant, title, question: title, categorySlug: 'c' + id, stats: { volume24hUsd: vol }, outcomes: [{ bestBid: bid && { price: bid }, bestAsk: ask && { price: ask } }] });

test('groups every market and explains why it is or is not in a round', () => {
  assert.equal(groupOf(m(1, 'CRYPTO_UP_DOWN', 'Bitcoin Up or Down on November 25?')), 'crypto_daily');
  assert.equal(groupOf(m(2, 'UP_DOWN', 'BTC Up or Down 15m 10:15 UTC')), 'crypto_short');
  assert.equal(groupOf(m(3, 'SPORTS_EXACT_SCORE', 'x')), 'sports');
  assert.equal(groupOf(m(4, 'ESPORTS_CS2', 'x')), 'esports');
  const v = marketsView([m(1, 'CRYPTO_UP_DOWN', 'Bitcoin Up or Down on November 25?', 5, 0.4, 0.5), m(2, 'UP_DOWN', 'short', 9, null, null), m(5, 'DEFAULT', 'a', 1), m(6, 'DEFAULT', 'b', 100, 0.7, 0.72)], { fetchedAt: 't', asked: new Set(['1']), perGroup: 1 });
  assert.equal(v.total, 4);
  assert.equal(v.groups.other.count, 2);
  assert.deepEqual(v.groups.other.top.map((x) => x.id), ['6']); // most traded first, capped per group
  assert.equal(v.groups.other.top[0].yesPct, 71);
  assert.equal(v.groups.crypto_daily.top[0].inRound, true);
  assert.equal(v.groups.crypto_short.top[0].yesPct, null);
  assert.match(v.groups.crypto_short.why, /2 hours/);
});
