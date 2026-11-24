import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickIds } from '../lib/cursor.mjs';

test('tick reads unsettled rounds plus new ones, and migrates the old from cursor', () => {
  assert.deepEqual(tickIds({}, 2n), [1n, 2n]);
  assert.deepEqual(tickIds({ from: '3' }, 4n), [3n, 4n]);
  assert.deepEqual(tickIds({ next: '9', open: ['2', '7'] }, 10n), [2n, 7n, 9n, 10n]);
  assert.deepEqual(tickIds({ next: '9', open: [] }, 8n), []);
});
