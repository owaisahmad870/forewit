import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicOf, horizonOf, planTopicRounds, MAX_PER_ROUND } from '../lib/topics.mjs';

const yes = (liquid) => ({ name: 'Yes', indexSet: 1, ...(liquid ? { bestBid: { price: 0.4 }, bestAsk: { price: 0.45 } } : {}) });
const no = { name: 'No', indexSet: 2 };
const mk = (id, cat, liquid = true, extra = {}) => ({ id, categorySlug: cat, conditionId: '0x' + String(id).padStart(64, '0'), outcomes: [yes(liquid), no], stats: { volume24hUsd: liquid ? 500 : 0 }, title: 'L' + id, ...extra });
const cat = (tags, hours, dl) => ({ title: 'Event', endsAt: new Date(dl + hours * 3.6e6).toISOString(), tags: tags.map((name) => ({ name })) });
const DL = Date.parse('2026-11-25T23:00:00Z');

test('topic map: sports and elections first, policy under macro', () => {
  assert.equal(topicOf(mk(1, 'a'), cat(['Sports', 'Crypto'], 24, DL)), 'sports');
  assert.equal(topicOf(mk(1, 'a'), cat(['Politics'], 24, DL)), 'elections');
  assert.equal(topicOf(mk(1, 'a'), cat(['Politics', 'Fed'], 24, DL)), 'macro');
  assert.equal(topicOf(mk(1, 'a'), cat(['Elections', 'Economy'], 24, DL)), 'elections');
  assert.equal(topicOf(mk(1, 'a'), cat(['ETH'], 24, DL)), 'crypto');
  assert.equal(topicOf(mk(1, 'a'), cat(['AI'], 24, DL)), 'tech');
  assert.equal(topicOf(mk(1, 'a'), cat(['Weather'], 24, DL)), 'weather');
  assert.equal(topicOf(mk(1, 'a'), cat(['Movies'], 24, DL)), 'other');
});

test('horizon buckets and window', () => {
  assert.equal(horizonOf(5), null);
  assert.equal(horizonOf(6).name, '3d');
  assert.equal(horizonOf(100).name, '7d');
  assert.equal(horizonOf(2400).name, '100d');
  assert.equal(horizonOf(2401), null);
});

test('plan: boards, chunks of 16, skips asked and featured, caps open rounds', () => {
  const cats = { c1: cat(['Tech'], 48, DL), c2: cat(['Tech'], 48, DL), c3: cat(['Fed'], 400, DL) };
  const markets = [];
  for (let i = 0; i < 20; i++) markets.push(mk(i, 'c1'));
  for (let i = 20; i < 25; i++) markets.push(mk(i, 'c2', false));
  markets.push(mk(99, 'c3'), mk(98, 'c1', true, { marketVariant: 'CRYPTO_UP_DOWN', title: 'BTC Up or Down on Nov 26' }));
  const { rounds, skipped } = planTopicRounds(markets, cats, DL, { asked: new Set(['0']), featured: new Set(['1']) });
  const scoredTech = rounds.filter((r) => r.board === 'scored' && r.topic === 'tech');
  assert.deepEqual(scoredTech.map((r) => r.questions.length), [16, 2]); // 20 minus asked minus featured
  assert.ok(rounds.every((r) => r.questions.length <= MAX_PER_ROUND));
  assert.equal(rounds.find((r) => r.board === 'open').questions.length, 5);
  assert.equal(rounds.find((r) => r.topic === 'macro').horizon, '30d');
  assert.equal(skipped.asked, 1); assert.equal(skipped.featured, 1); assert.equal(skipped.dailyCrypto, 1);
  assert.equal(rounds[0].board, 'scored');
  const capped = planTopicRounds(markets, cats, DL, { caps: { scored: 1, open: 0 } });
  assert.equal(capped.rounds.length, 1);
  assert.ok(capped.dropped >= 2);
});
