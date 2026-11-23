import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crowdV1, shrunkSkill } from '../lib/crowd.mjs';

const fresh = { rounds: 0, sumSkill: 0, baselineQuestions: 0 };

test('equal weights while nobody has 3 resolved rounds; log odds mean', () => {
  const r = crowdV1([[8000, 5000], [2000, 5000]], [fresh, { ...fresh, rounds: 2, sumSkill: 9e9 }], 2);
  assert.deepEqual(r.weights, [1, 1]);
  assert.deepEqual(r.bps, [5000, 5000]); // logit(0.8) and logit(0.2) cancel
  assert.deepEqual(r.bps, r.simpleBps);
});

test('established forecasters: 0.1 floor plus skill over mean positive skill', () => {
  const good = { rounds: 3, sumSkill: 30 * 1e6, baselineQuestions: 10 }; // shrunk skill 1e6
  const bad = { rounds: 5, sumSkill: -30 * 1e6, baselineQuestions: 10 };
  const r = crowdV1([[9000], [1000], [5000]], [good, bad, fresh], 1);
  assert.equal(shrunkSkill(good), 1e6);
  assert.deepEqual(r.weights, [1.1, 0.1, 1]);
  assert.ok(r.bps[0] > 5000, 'skilled forecaster pulls the crowd toward 90%');
});

test('no established forecaster with positive skill: established get the floor only', () => {
  const r = crowdV1([[9000], [1000]], [{ rounds: 3, sumSkill: -1, baselineQuestions: 1 }, fresh], 1);
  assert.deepEqual(r.weights, [0.1, 1]);
});

test('probabilities are clamped to 1% and 99%; no reveals gives null', () => {
  const r = crowdV1([[0], [10000]], [fresh, fresh], 1);
  assert.equal(r.bps[0], 5000);
  assert.deepEqual(crowdV1([], [], 2).bps, [null, null]);
});
