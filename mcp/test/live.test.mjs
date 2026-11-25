// functions/api/live.js: live prices only for markets with a Forewit open forecast, per market cache, input checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { live, resetAllowed } from '../../functions/api/live.js';

const snap = { open: { forecasts: [{ marketId: '11', baselineBps: 4000 }, { marketId: '22', baselineBps: 5000 }, { marketId: '33', baselineBps: null }, { marketId: '44', baselineBps: 5000, voided: true }] } }; // 33 unpriced and 44 voided never get live prices (review L1)
const market = (bid, ask) => ({ data: { outcomes: [{ bestBid: { price: bid }, bestAsk: { price: ask } }, {}], tradingStatus: 'OPEN', status: 'REGISTERED', title: 'not passed on' } });
function fake() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), key: init?.headers?.['x-api-key'] });
    if (String(url).endsWith('/data/snapshot.json')) return Response.json(snap);
    if (String(url).endsWith('/v1/markets/11')) return Response.json(market('0.60', '0.64'));
    if (String(url).endsWith('/v1/markets/22')) return Response.json(market('0.30', '0.40'));
    return new Response('no', { status: 404 });
  };
  const store = new Map();
  const cache = { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => { store.set(r.url, res); } };
  return { calls, fetchImpl, cache };
}
const req = (q) => new Request(`https://forewit.xyz/api/live?ids=${q}`);

test('returns prices only for markets in the snapshot open forecasts, cached per market', async () => {
  resetAllowed();
  const f = fake();
  const env = { PREDICT_LIVE_API_KEY: 'k' };
  const r = await live(req('11,99,22,33,44'), env, { ...f, now: 1000 });
  const body = await r.json();
  assert.equal(r.headers.get('cache-control'), 'public, max-age=15');
  assert.equal(body.source, 'Predict.fun');
  assert.deepEqual(body.prices, { 11: { yesPct: 62, tradingStatus: 'OPEN', status: 'REGISTERED' }, 22: { yesPct: 35, tradingStatus: 'OPEN', status: 'REGISTERED' } });
  for (const id of [99, 33, 44]) assert.ok(!f.calls.some((c) => c.url.endsWith('/' + id)), `market ${id}: no counted Forewit forecast, never fetched`);
  assert.ok(f.calls.filter((c) => c.url.includes('api.predict.fun')).every((c) => c.key === 'k'));
  const n = f.calls.length;
  await live(req('22,11'), env, { ...f, now: 2000 }); // other order, same markets: served from the caches
  assert.equal(f.calls.length, n);
});

test('rejects bad ids and returns no prices without the key', async () => {
  resetAllowed();
  const f = fake();
  for (const q of ['', '1a', '-1', Array.from({ length: 21 }, (_, i) => i + 1).join(',')]) assert.equal((await live(req(q), {}, f)).status, 400, q);
  const body = await (await live(req('11'), {}, f)).json();
  assert.deepEqual(body.prices, {});
  assert.ok(!f.calls.some((c) => c.url.includes('api.predict.fun')));
});
