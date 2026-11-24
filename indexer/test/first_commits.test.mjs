import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstCommits } from '../build.mjs';

test('firstCommits keeps each forecaster\'s earliest Committed log, lowercased, and ignores other events', () => {
  const logs = [
    { eventName: 'RoundCreated', blockNumber: '1', args: { roundId: '1' } },
    { eventName: 'Committed', blockNumber: '5', transactionHash: '0xaa', args: { roundId: '1', forecaster: '0xABC' } },
    { eventName: 'Revealed', blockNumber: '6', transactionHash: '0xbb', args: { roundId: '1', forecaster: '0xabc' } },
    { eventName: 'Committed', blockNumber: '7', transactionHash: '0xcc', args: { roundId: '2', forecaster: '0xabc' } },
    { eventName: 'Committed', blockNumber: '8', args: { roundId: '2', forecaster: '0xDEF' } },
  ];
  assert.deepEqual(firstCommits(logs), {
    '0xabc': { tx: '0xaa', roundId: '1', block: '5' },
    '0xdef': { tx: null, roundId: '2', block: '8' },
  });
});

test('adminLog lists role, pause and admin seat events with readable role names and skips everything else', async () => {
  const { adminLog } = await import('../build.mjs');
  const { keccak256, toHex } = await import('viem');
  const logs = [
    { eventName: 'RoleGranted', blockNumber: '1', transactionHash: '0x01', args: { role: `0x${'0'.repeat(64)}`, account: '0xAA', sender: '0xDD' } },
    { eventName: 'RoleGranted', blockNumber: '1', transactionHash: '0x01', args: { role: keccak256(toHex('ROUND_MANAGER_ROLE')), account: '0xBB', sender: '0xDD' } },
    { eventName: 'Committed', blockNumber: '2', transactionHash: '0x02', args: { roundId: '1', forecaster: '0xCC' } },
    { eventName: 'Paused', blockNumber: '3', transactionHash: '0x03', args: { account: '0xAA' } },
    { eventName: 'DefaultAdminTransferScheduled', blockNumber: '4', transactionHash: '0x04', args: { newAdmin: '0xEE', acceptSchedule: '99' } },
  ];
  assert.deepEqual(adminLog(logs), [
    { event: 'RoleGranted', block: '1', tx: '0x01', role: 'DEFAULT_ADMIN', account: '0xaa', by: '0xdd' },
    { event: 'RoleGranted', block: '1', tx: '0x01', role: 'ROUND_MANAGER', account: '0xbb', by: '0xdd' },
    { event: 'Paused', block: '3', tx: '0x03', account: '0xaa' },
    { event: 'DefaultAdminTransferScheduled', block: '4', tx: '0x04', newAdmin: '0xee', acceptAt: '99' },
  ]);
});
