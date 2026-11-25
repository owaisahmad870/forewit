import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unionLogs } from '../lib/logs.mjs';

const log = (tx, i, b = 1n) => ({ transactionHash: tx, logIndex: i, blockNumber: b });
const ok = (logs) => ({ getLogs: async () => logs });
const fail = (msg) => ({ getLogs: async () => { throw new Error(msg); } });

test('a provider that silently returns nothing cannot hide a log another provider has', async () => {
  const get = unionLogs([ok([log('0xa', 0, 2n)]), ok([])], [ok([log('0xb', 1, 1n), log('0xa', 0, 2n)])]);
  assert.deepEqual(await get({}), [log('0xb', 1, 1n), log('0xa', 0, 2n)]);
});

test('a required provider error is thrown (so range errors halve the span); an optional one is ignored', async () => {
  await assert.rejects(unionLogs([ok([]), fail('block range limit')])({}), /range limit/);
  assert.deepEqual(await unionLogs([ok([log('0xa', 0)])], [fail('down')])({}), [log('0xa', 0)]);
});
