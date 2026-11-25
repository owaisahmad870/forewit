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

test('a range error from a trusted provider is thrown so the caller halves the span; the optional one cannot do that', async () => {
  await assert.rejects(unionLogs([fail('block range limit')], [ok([])])({}), /range limit/);
  assert.deepEqual(await unionLogs([ok([log('0xa', 0)])], [fail('rate limit exceeded')])({}), [log('0xa', 0)]);
});

test('one keyed provider down is tolerated; only the public provider answering is not', async () => {
  assert.deepEqual(await unionLogs([fail('down'), ok([log('0xa', 0)])], [])({}), [log('0xa', 0)]);
  await assert.rejects(unionLogs([fail('key down')], [ok([])])({}), /key down/);
  assert.deepEqual(await unionLogs([], [ok([log('0xa', 0)])])({}), [log('0xa', 0)]); // no keyed RPC configured
});
