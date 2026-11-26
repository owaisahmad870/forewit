// My results renders v2 open forecasts for a v2 only wallet and a mixed one (the wallet comes from localStorage).
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import type { Dataset, OpenForecast, Snapshot, SnapRound } from '../lib/data';
import { MyResults } from '../pages/MyResults';

const A = '0x' + 'a'.repeat(40);
const of = (n: number, over: Partial<OpenForecast> = {}): OpenForecast => ({
  key: `0x${n}`, marketId: String(500 + n), forecaster: A, slot: 0, committedAt: 1795000000 + n, baselineBps: 6000, voided: false, revealedBps: null, scored: null, finalized: null, ...over,
});
const round: SnapRound = {
  roundId: '1', questions: [{ conditionId: '0x1', ctf: '0x0', yesSlot: 0, marketId: '1' }], committers: [A], revealed: [A],
  scored: { [A]: { questions: '1', brier: '4000000', skill: '12000000' } }, forfeited: {}, outcomes: { 0: 'Yes' }, baseline: String(6000),
  commitDeadline: '1795000000', revealDeadline: '1795086400', commitCount: 1, revealRate: 1,
};
const page = (snap: Partial<Snapshot>) => {
  (globalThis as any).localStorage = { getItem: () => A, setItem: () => {} };
  const snapshot = { network: 56, ledger: '0xL', builtAt: '2026-11-25T00:00:00Z', metrics: { distinctCommitters: 1, rounds: 0, perDay: {} }, rounds: [], ...snap } as Snapshot;
  return renderToStaticMarkup(<MyResults data={{ manifest: { snapshot: '', rounds: [] }, snapshot, rounds: [] } as Dataset} />);
};
afterEach(() => { delete (globalThis as any).localStorage; });

describe('my results with open forecasts', () => {
  it('a v2 only wallet sees its open forecasts, not the empty message', () => {
    const html = page({ open: { forecasts: [of(1)], committers: [A] } });
    expect(html).toContain(en.me.predTitle);
    expect(html).toContain('Market 501, outcome 1');
    expect(html).toContain(en.me.sealed);
    expect(html).not.toContain(en.me.none);
  });
  it('a mixed wallet sees its rounds and its open forecasts, scored ones with points', () => {
    const scored = of(2, { revealedBps: 8000, scored: { brier: '4000000', baselineBrier: '16000000', skill: '12000000', baselineUsed: true, forfeited: false }, finalized: { slot0Outcome: 'Yes', split: false, at: 1795100000 } });
    const html = page({ rounds: [round], open: { forecasts: [scored], committers: [A] } });
    expect(html).toContain('Round 1');
    expect(html).toContain('Market 502, outcome 1');
    expect(html).toContain('your forecast 80%');
    expect(html).toContain('You beat the market by 12.0 points');
  });
});
