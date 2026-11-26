import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bins10, profilePicks, reliability, streak, calibrationError, crowdVsMarket, bannerRounds, joinRounds, leaderboard, liveRound, phase, unpack, walletResults, type OpenForecast, type RoundFile, type Snapshot, type SnapRound } from '../lib/data';

const json = <T,>(p: string): T => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const pack = (bps: number[]) => bps.reduce((a, p, i) => a | (BigInt(p) << BigInt(16 * i)), 0n).toString();

// docs/SCORING.md golden vectors: outcomes Yes, No, Void, Yes; forecast [8000, 3000, 9000, 6500]; baseline [6000, 5000, 5000, 7000]
const GOLD_F = [8000, 3000, 9000, 6500];
const GOLD_B = [6000, 5000, 5000, 7000];
const goldRound = (id: number, scoredAs: Record<string, { questions: string; brier: string; skill: string }>, extra: Partial<SnapRound> = {}): SnapRound => ({
  roundId: String(id),
  questions: GOLD_F.map((_, i) => ({ conditionId: `0x${i}`, ctf: '0x0', yesSlot: 0, marketId: String(i) })),
  committers: Object.keys(scoredAs), revealed: Object.keys(scoredAs), scored: scoredAs, forfeited: {},
  outcomes: { 0: 'Yes', 1: 'No', 2: 'Void', 3: 'Yes' }, baseline: pack(GOLD_B),
  commitDeadline: String(1795000000 + id * 86400), revealDeadline: String(1795086400 + id * 86400), resolutionWait: '604800',
  commitCount: Object.keys(scoredAs).length, revealRate: 1, ...extra,
});
const snap = (rounds: SnapRound[], profiles: Snapshot['profiles'] = {}): Snapshot => ({ network: 97, ledger: '0xL', builtAt: '2026-11-23T00:00:00Z', metrics: { distinctCommitters: 0, rounds: rounds.length, perDay: {} }, rounds, profiles });

describe('unpack', () => {
  it('reads 16 bits per question', () => {
    expect(unpack(pack(GOLD_F), 4)).toEqual(GOLD_F);
    expect(unpack('0', 3)).toEqual([0, 0, 0]);
  });
});

describe('scoring against the golden vectors', () => {
  const gold = { questions: '3', brier: '25250000', skill: '24750000' };
  it('crowd vs market Brier skips Void and matches the golden sums', () => {
    const rounds = joinRounds(snap([goldRound(1, { '0xa': gold }, { crowd: { method: 'test', bps: GOLD_F } })]), []);
    const s = crowdVsMarket(rounds);
    expect(s.n).toBe(3);
    expect(s.crowd).toBeCloseTo(25250000 / 3 / 1e8, 12);
    expect(s.market).toBeCloseTo(50000000 / 3 / 1e8, 12);
  });
  it('leaderboard shrinks skill with K = 20', () => {
    const r = leaderboard(snap([goldRound(1, { '0xa': gold })], { '0xa': { isPublic: true, name: 'A' } })).rows[0];
    expect(r.meanBrier).toBeCloseTo(25250000 / 3 / 1e8, 12);
    expect(r.shrunkSkill).toBeCloseTo(24750000 / 23 / 1e8, 12);
    expect(r.ranked).toBe(false);
  });
  it('empty state when nothing is resolved', () => {
    expect(crowdVsMarket([])).toEqual({ crowd: null, market: null, n: 0 });
  });
});

describe('leaderboard eligibility', () => {
  const s = (q: number) => ({ questions: String(q), brier: '0', skill: String(q * 1e6) });
  const build = (rounds: number, qPer: number, isPublic = true) =>
    leaderboard(snap(Array.from({ length: rounds }, (_, i) => goldRound(i + 1, { '0xA': s(qPer) })), { '0xa': { isPublic, name: 'A' } }));
  it('ranks at exactly 5 rounds and 20 baseline questions', () => expect(build(5, 4).rows[0].ranked).toBe(true));
  it('does not rank at 4 rounds', () => expect(build(4, 5).rows[0].ranked).toBe(false));
  it('flags post baseline skill only when the pre registered window move rule is active', () => {
    const r = goldRound(1, { '0xA': s(4) });
    (r as any).commitTiming = { '0xa': { at: 2, afterBaseline: true, gapSec: 60 } };
    const base = snap([r], { '0xa': { isPublic: true, name: 'A' } });
    const off = leaderboard({ ...base, metrics: { ...base.metrics, windowMove: { rounds: 5, avgPts: 0.4, thresholdPts: 0.5, active: false } } }).rows[0];
    const on = leaderboard({ ...base, metrics: { ...base.metrics, windowMove: { rounds: 5, avgPts: 0.7, thresholdPts: 0.5, active: true } } }).rows[0];
    expect(off.postBaselineFlag).toBe(false);
    expect(on.postBaselineFlag).toBe(true);
  });
  it('never ranks an operator wallet (round manager, admin, pauser), even when public and eligible', () => {
    const snapOps = { ...snap(Array.from({ length: 5 }, (_, i) => goldRound(i + 1, { '0xA': s(4) })), { '0xa': { isPublic: true, name: 'A' } }), operators: ['0xA'] };
    expect(leaderboard(snapOps).rows[0]?.ranked ?? false).toBe(false);
  });
  it('does not rank at 19 baseline questions', () => expect(build(5, 3.8).rows[0]?.ranked ?? false).toBe(false));
  it('never lists forecasters who did not opt in, but counts them', () => {
    const lb = build(6, 5, false);
    expect(lb.rows).toEqual([]);
    expect(lb.forecasters).toBe(1);
  });
  it('participation ignores rounds still inside their reveal window', () => {
    const open = goldRound(9, {}, { committers: ['0xa'], revealed: [], commitCount: 1, revealDeadline: String(Date.parse('2026-11-23T00:00:00Z') / 1000 + 3600) });
    const lb = leaderboard(snap([goldRound(1, { '0xa': s(3) }), open], { '0xa': { isPublic: true } }));
    expect(lb.rows[0].participation).toBe(1);
  });
  it('rounds without a baseline add no skill and no baseline questions', () => {
    const lb = leaderboard(snap([goldRound(1, { '0xa': s(3) }, { baseline: null })], { '0xa': { isPublic: true } }));
    expect(lb.rows[0].baselineQuestions).toBe(0);
    expect(lb.rows[0].shrunkSkill).toBe(0);
  });
});

describe('round state uses the passed clock', () => {
  const [r] = joinRounds(snap([goldRound(1, {})]), []);
  it('moves through the phases', () => {
    expect(phase(r, r.commitDeadline.getTime() - 1)).toBe('commit');
    expect(phase(r, r.commitDeadline.getTime())).toBe('reveal');
    expect(phase(r, r.revealDeadline.getTime() + 1)).toBe('scored');
  });
  it('features the open round, else the newest', () => {
    const rounds = joinRounds(snap([goldRound(1, {}), goldRound(2, {})]), []);
    expect(liveRound(rounds, rounds[1].commitDeadline.getTime() - 1)?.id).toBe(1);
    expect(liveRound(rounds, 4e12)?.id).toBe(2);
  });
  it('banner: commit round, then reveal due overlapping the next commit window, then nothing', () => {
    const rounds = joinRounds(snap([goldRound(1, {}), goldRound(2, {})]), []);
    const [r1, r2] = [1, 2].map((id) => rounds.find((r) => r.id === id)!);
    const at = (now: number) => { const b = bannerRounds(rounds, now); return { reveal: b.reveal.map((r) => r.id), commit: b.commit?.id ?? null }; };
    r1.revealedCount = r1.commitCount - 1; // one reveal still owed
    expect(at(r1.commitDeadline.getTime() - 1)).toEqual({ reveal: [], commit: 1 });
    expect(at(r1.commitDeadline.getTime())).toEqual({ reveal: [1], commit: 2 });
    r1.revealedCount = r1.commitCount; // everyone revealed: no reveal banner
    expect(at(r1.commitDeadline.getTime())).toEqual({ reveal: [], commit: 2 });
    expect(at(r2.revealDeadline.getTime())).toEqual({ reveal: [], commit: null });
  });
});

describe('histogram and calibration', () => {
  it('bins 0 to 100% into 10 bins, 100% in the last', () => expect(bins10([0, 999, 1000, 5000, 10000])).toEqual([2, 1, 0, 0, 0, 1, 0, 0, 0, 1]));
  it('calibration error is 0 when frequencies match', () => {
    expect(calibrationError([{ p: 5000, yes: true }, { p: 5000, yes: false }])).toBeCloseTo(0, 12);
    expect(calibrationError([{ p: 9000, yes: false }])).toBeCloseTo(0.9, 12);
    expect(calibrationError([])).toBeNull();
  });
});

describe('real indexer output (testnet snapshot, no round files)', () => {
  const real = json<Snapshot>('./fixtures/testnet_snapshot.json');
  it('parses and hides every question, since no event question was published', () => {
    const [r] = joinRounds(real, []);
    expect(r.questions).toHaveLength(3);
    expect(r.questions.every((q) => q.title === null)).toBe(true);
    expect(r.hasBaseline).toBe(true);
    expect(r.questions[0].outcome).toBe('Yes');
  });
  it('round files for another ledger are never joined', () => {
    const file: RoundFile = { network: 97, ledger: '0xother', roundId: '1', commitDeadline: '', revealDeadline: '', questions: [{ index: 0, marketId: '1', eventQuestion: 'E?', label: 'L' }] };
    expect(joinRounds(real, [file])[0].questions[0].title).toBeNull();
  });
});

describe('published dataset in public/data (sample or real)', () => {
  const index = json<{ sample: boolean; snapshot: string; rounds: string[] }>('../../public/data/index.json');
  const s = json<Snapshot>(`../../public/data/${index.snapshot}`);
  const files = index.rounds.map((p) => json<RoundFile>(`../../public/data/${p}`));
  it('says whether it is sample data', () => expect(typeof index.sample).toBe('boolean'));
  it('every published question has an event question', () => {
    for (const f of files) for (const q of f.questions) expect(q.eventQuestion?.trim()).toBeTruthy();
  });
  it('stored scores match the scoring rule recomputed from forecasts, baseline and outcomes', () => {
    for (const r of s.rounds) {
      if (!r.baseline) continue;
      const n = r.questions.length;
      const base = unpack(r.baseline, n);
      for (const [a, packed] of Object.entries(r.forecasts ?? {})) {
        if (!r.scored[a]) continue; // revealed but not scored yet (live data)
        const f = unpack(packed, n);
        let brier = 0, b = 0, q = 0;
        f.forEach((p, i) => {
          const o = r.outcomes[String(i)];
          if (o !== 'Yes' && o !== 'No') return;
          const y = o === 'Yes' ? 10000 : 0;
          brier += (p - y) ** 2; b += (base[i] - y) ** 2; q++;
        });
        expect(r.scored[a]).toMatchObject({ questions: String(q), brier: String(brier), skill: String(b - brier) });
      }
    }
  });
});

describe('wallet results card', () => {
  const gold = { questions: '3', brier: '25250000', skill: '24750000' };
  const lost = { questions: '3', brier: '60000000', skill: '-10000000' };
  it('says beat or behind the market per round, forfeits, owed reveals and the overall average', () => {
    const s = snap([
      goldRound(1, { '0xA': gold }),
      goldRound(2, { '0xA': lost }),
      goldRound(3, {}, { committers: ['0xA'], revealed: [], forfeited: { '0xa': lost } }),
      goldRound(4, {}, { committers: ['0xa'], revealed: [], revealDeadline: String(Date.parse('2026-11-24T00:00:00Z') / 1000) }),
      goldRound(5, {}, { committers: ['0xa'], revealed: ['0xA'] }),
    ]);
    const w = walletResults(s, '0xa');
    expect(w.rounds.map((r) => [r.roundId, r.verdict])).toEqual([[5, 'waiting'], [4, 'reveal'], [3, 'forfeited'], [2, 'behind'], [1, 'beat']]);
    expect(w.rounds[4].skill).toBeCloseTo(0.0825);
    expect(w.rounds[4].marketBrier).toBeCloseTo(0.1667, 3);
    expect([w.committed, w.revealed, w.beat, w.behind, w.forfeited]).toEqual([5, 3, 1, 1, 1]);
    expect(w.avgSkill).toBeCloseTo((24750000 - 10000000 - 10000000) / 9 / 1e8);
    expect(w.rank).toBeNull();
  });
  it('a wallet that never committed has an empty card', () => {
    expect(walletResults(snap([goldRound(1, { '0xb': gold })]), '0xa')).toMatchObject({ committed: 0, rounds: [], avgSkill: null });
  });
});

describe('merged record with v2 open forecasts (docs/OPEN_FORECASTS.md Record)', () => {
  const DAY = 86400;
  // one v2 forecast; `day` sets the onchain resolution day, skill in Brier units times 1e8
  const of = (forecaster: string, n: number, over: Partial<OpenForecast> = {}): OpenForecast => ({
    key: `0x${n}`, marketId: String(100 + n), forecaster, slot: 0, committedAt: 1795000000 + n * DAY, baselineBps: 6000, voided: false, revealedBps: 8000,
    scored: { brier: '4000000', baselineBrier: '16000000', skill: '12000000', baselineUsed: true, forfeited: false },
    finalized: { slot0Outcome: 'Yes', split: false, at: 1795000000 + n * DAY }, ...over,
  });
  const s = (q: number) => ({ questions: String(q), brier: '0', skill: String(q * 1e6) });
  const pub = { '0xa': { isPublic: true, name: 'A' } };
  it('a snapshot without an open section gives the same rows as before', () => {
    const rounds = Array.from({ length: 5 }, (_, i) => goldRound(i + 1, { '0xA': s(4) }));
    const a = leaderboard(snap(rounds, pub));
    const b = leaderboard({ ...snap(rounds, pub), open: { forecasts: [], committers: [] } });
    expect(b.rows).toEqual(a.rows);
    expect(a.rows[0]).toMatchObject({ ranked: true, days: 5, openForecasts: 0 });
  });
  it('adds v2 skill and baseline forecasts to v1: (sumSkill v1 + v2) / (questions v1 + v2 + 20)', () => {
    const base = snap([goldRound(1, { '0xA': s(4) }), goldRound(2, { '0xA': s(4) })], pub);
    const open = { forecasts: Array.from({ length: 12 }, (_, i) => of('0xa', i + 10)), committers: ['0xa'] };
    const row = leaderboard({ ...base, open }).rows[0];
    expect(row.baselineQuestions).toBe(20);
    expect(row.questions).toBe(20);
    expect(row.openForecasts).toBe(12);
    expect(row.days).toBe(14);
    expect(row.shrunkSkill).toBeCloseTo((8e6 + 12 * 12e6) / 40 / 1e8);
    expect(row.ranked).toBe(true);
    expect(walletResults({ ...base, open }, '0xA').shrunkSkill).toBeCloseTo(row.shrunkSkill, 12);
  });
  it('v1 keeps its 5 rounds rule: two rounds closing on the same date still count as two', () => {
    const rounds = Array.from({ length: 5 }, (_, i) => goldRound(i + 1, { '0xA': s(4) }, { commitDeadline: String(1795000000 + (i < 2 ? 0 : i) * DAY) }));
    expect(leaderboard(snap(rounds, pub)).rows[0]).toMatchObject({ days: 5, ranked: true });
  });
  it('needs 5 distinct scoring days: 20 forecasts resolved on one day do not rank', () => {
    const open = { forecasts: Array.from({ length: 20 }, (_, i) => of('0xa', i, { finalized: { slot0Outcome: 'Yes', split: false, at: 1795000000 } })), committers: ['0xa'] };
    const row = leaderboard({ ...snap([], pub), open }).rows[0];
    expect(row.baselineQuestions).toBe(20);
    expect(row.days).toBe(1);
    expect(row.ranked).toBe(false);
  });
  it('void forecasts and split payouts never count; forfeits count; no market price counts for nothing', () => {
    const open = { forecasts: [
      of('0xa', 1, { voided: true, scored: null }),
      of('0xa', 2, { finalized: { slot0Outcome: 'Void', split: true, at: 1795000000 }, scored: { brier: '0', baselineBrier: '0', skill: '0', baselineUsed: false, forfeited: false } }),
      of('0xa', 3, { revealedBps: null, scored: { brier: '100000000', baselineBrier: '16000000', skill: '-84000000', baselineUsed: true, forfeited: true } }),
      of('0xa', 4, { baselineBps: null, scored: { brier: '4000000', baselineBrier: '0', skill: '0', baselineUsed: false, forfeited: false } }),
      of('0xa', 5, { revealedBps: null, scored: null, finalized: null }),
      of('0xa', 6, { scored: null, finalized: null }),
      of('0xa', 7, { slot: 1, scored: { brier: '64000000', baselineBrier: '36000000', skill: '-28000000', baselineUsed: true, forfeited: false } }),
    ], committers: ['0xa'] };
    const row = leaderboard({ ...snap([], pub), open }).rows[0];
    expect([row.questions, row.baselineQuestions, row.openForecasts]).toEqual([2, 2, 2]);
    expect(row.meanBrier).toBeCloseTo((1e8 + 64e6) / 2 / 1e8);
    const w = walletResults({ ...snap([], pub), open }, '0xa');
    expect(w.committed).toBe(0);
    expect(Object.fromEntries(w.predictions.map((p) => [p.marketId, p.status]))).toEqual({ 101: 'void', 102: 'void', 103: 'forfeited', 104: 'scored', 105: 'waiting', 106: 'revealed', 107: 'behind' });
    const p7 = w.predictions.find((p) => p.marketId === '107')!;
    expect([p7.chance, p7.skill, p7.brier, p7.marketBrier]).toEqual([0.8, -0.28, 0.64, 0.36]);
    expect(w.predictions.find((p) => p.marketId === '105')).toMatchObject({ chance: null, open: true });
    expect(w.predictions.find((p) => p.marketId === '101')!.open).toBe(false);
    expect(w.avgSkill).toBeCloseTo((-84e6 - 28e6) / 2 / 1e8);
  });
});

describe('profile helpers', () => {
  it('reliability bins chance against how often it happened', () => {
    expect(reliability([{ p: 8000, yes: true }, { p: 8500, yes: false }, { p: 2000, yes: false }])).toEqual([
      { bin: 2, n: 1, chance: 0.2, freq: 0 },
      { bin: 8, n: 2, chance: 0.825, freq: 0.5 },
    ]);
  });
  it('streak counts closed daily rounds in a row and picks read the revealed chance per question', () => {
    const s = snap([
      goldRound(1, { '0xa': { questions: '3', brier: '1', skill: '1' } }, { forecasts: { '0xa': pack(GOLD_F) } }),
      goldRound(2, {}, { committers: ['0xA'] }),
      goldRound(3, {}, { committers: [] }),
    ]);
    const rounds = joinRounds(s, []);
    const after3 = (1795000000 + 3 * 86400 + 1) * 1000;
    expect(streak(rounds, s, '0xa', after3)).toBe(0); // round 3 missed
    expect(streak(rounds, s, '0xa', after3 - 86400 * 1000)).toBe(2); // rounds 2 and 1
    const data = { manifest: { snapshot: '', rounds: [] }, snapshot: s, rounds };
    const picks = profilePicks(data, '0xA');
    expect(picks.filter((p) => p.roundId === 1).map((p) => p.chance)).toEqual([0.8, 0.3, 0.9, 0.65]);
    expect(picks.find((p) => p.roundId === 2)?.chance).toBeNull();
    expect(leaderboard(s).all.find((r) => r.addr === '0xa')?.cal).toHaveLength(3); // the Void question has no outcome
  });
});
