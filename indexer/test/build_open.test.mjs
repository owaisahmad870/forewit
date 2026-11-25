import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openFromLogs } from '../build_open.mjs';

// fake logs in the cached shape (bigints as strings); keys and addresses are built, never pasted
const word = (n) => '0x' + String(n).padStart(64, '0');
const addr = (n) => '0x' + String(n).padStart(40, 'a');
const K1 = word(1), K2 = word(2), K3 = word(3);
const A = addr(1), B = addr(2);
let i = 0;
const log = (eventName, blockNumber, args) => ({ eventName, blockNumber: String(blockNumber), logIndex: i++, transactionHash: word(900 + i), args });
const commit = (key, forecaster, slot, marketId, block) => log('Committed', block, { key, forecaster, ctf: addr(9), conditionId: word(7), slot, marketId: String(marketId), commitHash: word(8), sealedCopy: '0xdead' });

test('rebuilds open forecasts: baseline, void, finalize, reveal, score, forfeit and split', () => {
  const logs = [
    commit(K1, A, 0, 11, 100), commit(K1, B, 1, 11, 100), commit(K2, A, 1, 22, 101), commit(K3, B, 0, 33, 102),
    log('BaselineSet', 100, { key: K1, forecaster: A, bps: 6000 }),
    log('ForecastVoided', 101, { key: K2, forecaster: A, reason: 1 }),
    log('MarketFinalized', 200, { key: K1, slot0: 1, split: false }),
    log('MarketFinalized', 201, { key: K3, slot0: 3, split: true }),
    log('Revealed', 210, { key: K1, forecaster: A, bps: 8000, caller: A }),
    log('Scored', 211, { key: K1, forecaster: A, brier: '4000000', baselineBrier: '16000000', skill: '12000000', baselineUsed: true, forfeited: false }),
    log('Scored', 300, { key: K1, forecaster: B, brier: '100000000', baselineBrier: '0', skill: '0', baselineUsed: false, forfeited: true }),
    log('Scored', 301, { key: K3, forecaster: B, brier: '0', baselineBrier: '0', skill: '0', baselineUsed: false, forfeited: false }),
    log('Revealed', 5, { key: K2, forecaster: B, bps: 1 }), // no commit for this pair: ignored
  ];
  const times = { 100: '1000', 101: '1003', 102: '1006', 200: '90000', 201: '90003' };
  const o = openFromLogs(logs, times);
  assert.deepEqual(o.committers, [A, B]);
  assert.equal(o.forecasts.length, 4);
  const [a1, b1, a2, b3] = o.forecasts;
  assert.deepEqual(a1, {
    key: K1, marketId: '11', forecaster: A, slot: 0, committedAt: 1000, baselineBps: 6000, voided: false, revealedBps: 8000,
    scored: { brier: '4000000', baselineBrier: '16000000', skill: '12000000', baselineUsed: true, forfeited: false },
    finalized: { slot0Outcome: 'Yes', split: false, at: 90000 },
  });
  assert.equal(b1.slot, 1);
  assert.equal(b1.scored.forfeited, true);
  assert.equal(b1.revealedBps, null);
  assert.equal(a2.voided, true);
  assert.equal(a2.finalized, null);
  assert.deepEqual(b3.finalized, { slot0Outcome: 'Void', split: true, at: 90003 });
  assert.ok(!JSON.stringify(o).includes('dead'), 'the sealed copy is never published');
});

test('review L4: v2 role holders are operators (never ranked)', () => {
  const K = '0xD1460596715c9f39a6EFBfd2760F62A4bF586C38';
  const o = openFromLogs([{ eventName: 'RoleGranted', args: { role: '0x01', account: K } }], {});
  assert.deepEqual(o.operators, [K.toLowerCase()]);
});
