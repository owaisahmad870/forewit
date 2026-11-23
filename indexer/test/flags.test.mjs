import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundFlags, roleHolders, operators } from '../lib/flags.mjs';

test('a round past its deadline without a baseline is flagged; before the deadline or with a baseline it is not', () => {
  assert.deepEqual(roundFlags({ commitDeadline: '100', baseline: null }, 100), ['baseline_missing']);
  assert.deepEqual(roundFlags({ commitDeadline: '100', baseline: null }, 99), []);
  assert.deepEqual(roundFlags({ commitDeadline: '100', baseline: '42' }, 500), []);
});

test('role holders follow grants and revokes in order; operators are their union', () => {
  const ev = [
    { eventName: 'RoleGranted', role: 'ADMIN', account: '0xA' },
    { eventName: 'RoleGranted', role: 'MANAGER', account: '0xK' },
    { eventName: 'RoleGranted', role: 'PAUSER', account: '0xA' },
    { eventName: 'RoleRevoked', role: 'PAUSER', account: '0xA' },
    { eventName: 'RoleGranted', role: 'PAUSER', account: '0xB' },
  ];
  const h = roleHolders(ev);
  assert.deepEqual([...h.PAUSER], ['0xb']);
  assert.deepEqual(operators(h), ['0xa', '0xb', '0xk']);
});

import { commitTiming, meanMovePts } from '../lib/flags.mjs';

test('commit timing uses each forecaster\'s last commit and the gap to the baseline post', () => {
  const t = commitTiming([{ forecaster: '0xA', at: 100 }, { forecaster: '0xB', at: 400 }, { forecaster: '0xA', at: 520 }], 500);
  assert.deepEqual(t['0xa'], { at: 520, afterBaseline: true, gapSec: 20 });
  assert.deepEqual(t['0xb'], { at: 400, afterBaseline: false, gapSec: -100 });
  assert.deepEqual(commitTiming([{ forecaster: '0xA', at: 1 }], null)['0xa'], { at: 1, afterBaseline: false, gapSec: null });
});

test('mean market move inside the window in probability points', () => {
  assert.equal(meanMovePts([5000, 3000], [5100, 2900]), 1);
  assert.equal(meanMovePts([5000], [null]), null);
});
