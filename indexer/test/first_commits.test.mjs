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
