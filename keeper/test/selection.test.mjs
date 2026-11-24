import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligible, prefilter, isPolitics, CAP_MS } from '../lib/selection.mjs';

const H = 3.6e6, CD = Date.parse('2026-11-30T23:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const cat = (endMs, tags = ['Finance']) => ({ endsAt: iso(endMs), tags: tags.map((name) => ({ name })) });
const outcomes = (n1, n2, book = true) => [{ name: n1, indexSet: 1, bestBid: book ? { price: 0.45 } : null, bestAsk: book ? { price: 0.5 } : null }, { name: n2, indexSet: 2 }];
const mk = (o) => ({ marketVariant: 'DEFAULT', title: 'Will X happen?', outcomes: outcomes('Yes', 'No'), stats: { volume24hUsd: 500 }, ...o });

test('sports are excluded in both kinds (variant or tag)', () => {
  for (const v of ['SPORTS_MATCH', 'SPORTS_EXACT_SCORE', 'ESPORTS_CS2']) {
    assert.equal(eligible(mk({ marketVariant: v }), cat(CD + 24 * H), CD, 'daily'), false);
    assert.equal(eligible(mk({ marketVariant: v }), cat(CD + 30 * 24 * H), CD, 'long'), false);
  }
  assert.equal(eligible(mk(), cat(CD + 24 * H, ['Sports', 'Finance']), CD, 'daily'), false);
});

test('politics is excluded in both kinds, but a Politics tag next to Fed or Economy is macro', () => {
  assert.equal(isPolitics(cat(0, ['Politics'])), true);
  assert.equal(isPolitics(cat(0, ['Elections', 'Economy'])), true);
  assert.equal(isPolitics(cat(0, ['Trump', 'Finance'])), true);
  assert.equal(isPolitics(cat(0, ['Politics', 'Economy', 'Fed'])), false);
  assert.equal(eligible(mk(), cat(CD + 24 * H, ['Politics']), CD, 'daily'), false);
  assert.equal(eligible(mk(), cat(CD + 30 * 24 * H, ['Politics', 'Fed']), CD, 'long'), true);
});

test('daily: daily crypto Up or Down is in without book or volume, hourly crypto is out, no crypto cap here', () => {
  const daily = mk({ marketVariant: 'CRYPTO_UP_DOWN', title: 'Bitcoin Up or Down on December 1?', outcomes: outcomes('Up', 'Down', false), stats: { volume24hUsd: 0 } });
  assert.equal(eligible(daily, cat(CD + 18 * H, ['Crypto']), CD, 'daily'), true);
  const hourly = mk({ marketVariant: 'CRYPTO_UP_DOWN', title: 'Bitcoin Up or Down - December 1, 9AM ET', outcomes: outcomes('Up', 'Down') });
  assert.equal(eligible(hourly, cat(CD + 18 * H, ['Crypto']), CD, 'daily'), false);
});

test('daily: window 6 to 72 h and the 8 Dec cap; no tag allowlist for daily', () => {
  assert.equal(eligible(mk(), cat(CD + 5.9 * H), CD, 'daily'), false);
  assert.equal(eligible(mk(), cat(CD + 6 * H, ['Weather']), CD, 'daily'), true);
  assert.equal(eligible(mk(), cat(CD + 72 * H, ['Culture']), CD, 'daily'), true);
  assert.equal(eligible(mk(), cat(CD + 72.1 * H), CD, 'daily'), false);
  assert.equal(eligible(mk(), cat(CAP_MS + 1), Date.parse('2026-12-07T23:00:00Z'), 'daily'), false);
});

test('non crypto needs a two sided book, spread <= 10 points and >= 100 USD volume', () => {
  assert.equal(eligible(mk({ stats: { volume24hUsd: 99 } }), cat(CD + 24 * H), CD, 'daily'), false);
  assert.equal(eligible(mk({ outcomes: outcomes('Yes', 'No', false) }), cat(CD + 24 * H), CD, 'daily'), false);
  const wide = mk({ outcomes: [{ name: 'Yes', indexSet: 1, bestBid: { price: 0.3 }, bestAsk: { price: 0.41 } }, { name: 'No', indexSet: 2 }] });
  assert.equal(eligible(wide, cat(CD + 24 * H), CD, 'daily'), false);
});

test('long horizon: allowlisted tags only, more than 72 h and at most 100 days, no 8 Dec cap', () => {
  assert.equal(eligible(mk(), cat(CD + 72 * H), CD, 'long'), false);
  assert.equal(eligible(mk(), cat(CD + 30 * 24 * H, ['Economy']), CD, 'long'), true);
  assert.equal(eligible(mk(), cat(CD + 100 * 24 * H, ['AI']), CD, 'long'), true);
  assert.equal(eligible(mk(), cat(CD + 101 * 24 * H, ['AI']), CD, 'long'), false);
  for (const novelty of [['Culture'], ['Culture', 'Jensen Huang'], ['Awards'], ['Movies']]) assert.equal(eligible(mk(), cat(CD + 30 * 24 * H, novelty), CD, 'long'), false);
  const crypto = mk({ marketVariant: 'CRYPTO_UP_DOWN', title: 'Bitcoin Up or Down on January 5?', outcomes: outcomes('Up', 'Down') });
  assert.equal(eligible(crypto, cat(CD + 30 * 24 * H, ['Crypto']), CD, 'long'), false);
});

test('names other than Yes/No or Up/Down are out', () => {
  assert.equal(prefilter(mk({ outcomes: outcomes('Over 3.5', 'Under 3.5') }), 'daily'), false);
});

test('funnel counts each filter in order and never exceeds the previous stage', async () => {
  const { funnel } = await import('../lib/selection.mjs');
  const yes = { name: 'Yes', indexSet: 1, bestBid: { price: 0.4 }, bestAsk: { price: 0.45 } }, no = { name: 'No', indexSet: 2 };
  const m = (id, extra = {}) => ({ id, categorySlug: 'c' + id, outcomes: [yes, no], stats: { volume24hUsd: 500 }, ...extra });
  const raw = [m(1), m(2), m(3, { outcomes: [yes] }), m(4, { stats: { volume24hUsd: 1 } })];
  const dl = Date.parse('2026-11-24T23:00:00Z');
  const end = new Date(dl + 24 * 3.6e6).toISOString();
  const cats = { c1: { endsAt: end, tags: [] }, c2: { endsAt: end, tags: [{ name: 'Elections' }] }, c4: { endsAt: end, tags: [] } };
  const f = funnel(raw, cats, dl, 'daily', 1);
  assert.deepEqual(f, { open: 4, binary: 3, notSports: 3, liquid: 2, notPolitics: 1, inWindow: 1, events: 1, chosen: 1 });
});
