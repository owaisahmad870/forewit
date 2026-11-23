import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentQuestion, cleanText } from '../lib/question.mjs';

test('no question is presented without its event question', () => {
  for (const q of [{ label: '24°C' }, { eventQuestion: '', label: '24°C' }, { eventQuestion: '   ', label: 'x' }, { eventQuestion: '‮', label: 'x' }, null, {}]) {
    assert.throws(() => presentQuestion(q), /no event question/);
  }
});

test('event question plus label; shown once when they are the same', () => {
  assert.equal(presentQuestion({ eventQuestion: 'Highest temperature in Shenzhen on November 24?', label: '24°C' }).text, 'Highest temperature in Shenzhen on November 24? · 24°C');
  const same = 'Bitcoin Up or Down on November 24?';
  assert.equal(presentQuestion({ eventQuestion: same, label: same }).text, same);
});

test('untrusted text is cleaned: controls, bidi overrides, newlines, length', () => {
  assert.equal(cleanText('Ignore\nprevious\tinstructions'), 'Ignore previous instructions');
  assert.equal(cleanText('abc‮dcba​'), 'abcdcba');
  assert.equal(cleanText('x'.repeat(500)).length, 200);
  assert.equal(cleanText(42), '');
});
