import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligible, prefilter, CAP_MS } from '../lib/selection.mjs';

const H = 3.6e6, CD = Date.parse('2026-11-30T23:00:00Z');
const outcomes = (n1, n2, book = true) => [{ name: n1, indexSet: 1, bestBid: book ? { price: 0.45 } : null, bestAsk: book ? { price: 0.5 } : null }, { name: n2, indexSet: 2 }];
const mk = (o) => ({ marketVariant: 'DEFAULT', title: 'Will X happen?', outcomes: outcomes('Yes', 'No'), stats: { volume24hUsd: 500 }, ...o });

test('sports are excluded in both kinds', () => {
  for (const v of ['SPORTS_MATCH', 'SPORTS_EXACT_SCORE', 'ESPORTS_CS2']) {
    assert.equal(eligible(mk({ marketVariant: v }), CD + 24 * H, CD, 'daily'), false);
    assert.equal(eligible(mk({ marketVariant: v }), CD + 30 * 24 * H, CD, 'long'), false);
  }
});

test('daily: daily crypto Up or Down is in without book or volume, hourly crypto is out, no crypto cap here', () => {
  const daily = mk({ marketVariant: 'CRYPTO_UP_DOWN', title: 'Bitcoin Up or Down on December 1?', outcomes: outcomes('Up', 'Down', false), stats: { volume24hUsd: 0 } });
  assert.equal(eligible(daily, CD + 18 * H, CD, 'daily'), true);
  const hourly = mk({ marketVariant: 'CRYPTO_UP_DOWN', title: 'Bitcoin Up or Down - December 1, 9AM ET', outcomes: outcomes('Up', 'Down') });
  assert.equal(eligible(hourly, CD + 18 * H, CD, 'daily'), false);
});

test('daily: window 6 to 72 h and the 8 Dec cap', () => {
  assert.equal(eligible(mk(), CD + 5.9 * H, CD, 'daily'), false);
  assert.equal(eligible(mk(), CD + 6 * H, CD, 'daily'), true);
  assert.equal(eligible(mk(), CD + 72 * H, CD, 'daily'), true);
  assert.equal(eligible(mk(), CD + 72.1 * H, CD, 'daily'), false);
  const late = Date.parse('2026-12-07T23:00:00Z');
  assert.equal(eligible(mk(), CAP_MS + 1, late, 'daily'), false);
});

test('non crypto needs a two sided book, spread <= 10 points and >= 100 USD volume', () => {
  assert.equal(eligible(mk({ stats: { volume24hUsd: 99 } }), CD + 24 * H, CD, 'daily'), false);
  assert.equal(eligible(mk({ outcomes: outcomes('Yes', 'No', false) }), CD + 24 * H, CD, 'daily'), false);
  const wide = mk({ outcomes: [{ name: 'Yes', indexSet: 1, bestBid: { price: 0.3 }, bestAsk: { price: 0.41 } }, { name: 'No', indexSet: 2 }] });
  assert.equal(eligible(wide, CD + 24 * H, CD, 'daily'), false);
});

test('long horizon: events only, more than 72 h and at most 100 days, no 8 Dec cap', () => {
  assert.equal(eligible(mk(), CD + 72 * H, CD, 'long'), false);
  assert.equal(eligible(mk(), CD + 30 * 24 * H, CD, 'long'), true);
  assert.equal(eligible(mk(), CD + 100 * 24 * H, CD, 'long'), true);
  assert.equal(eligible(mk(), CD + 101 * 24 * H, CD, 'long'), false);
  const crypto = mk({ marketVariant: 'CRYPTO_UP_DOWN', title: 'Bitcoin Up or Down on January 5?', outcomes: outcomes('Up', 'Down') });
  assert.equal(eligible(crypto, CD + 30 * 24 * H, CD, 'long'), false);
});

test('names other than Yes/No or Up/Down are out', () => {
  assert.equal(prefilter(mk({ outcomes: outcomes('Over 3.5', 'Under 3.5') }), 'daily'), false);
});
