// Data layer: loads the static JSON (indexer snapshot plus keeper public round files), joins them and computes
// every number the site shows. Pure functions take `now` so the fixtures can be tested at any date.
import { presentQuestion } from './question.mjs';

export type Outcome = 'Unresolved' | 'Yes' | 'No' | 'Void';
type Sums = { questions: string; brier: string; skill: string };

export interface SnapRound {
  roundId: string;
  questions: { conditionId: string; ctf: string; yesSlot: number; marketId: string }[];
  committers: string[];
  revealed: string[];
  scored: Record<string, Sums>;
  forfeited: Record<string, Sums>;
  outcomes: Record<string, Outcome>;
  baseline: string | null;
  commitDeadline: string;
  revealDeadline: string;
  resolutionWait?: string | null;
  commitCount: number;
  revealRate: number | null;
  // not produced by indexer/build.mjs yet (sample only): revealed packed forecasts and the crowd aggregate
  forecasts?: Record<string, string>;
  commitTiming?: Record<string, { at: number; afterBaseline: boolean; gapSec: number | null }>;
  crowd?: { method: string; bps: (number | null)[] } | null;
}

export interface Snapshot {
  network: number;
  ledger: string;
  builtAt: string;
  metrics: { distinctCommitters: number; rounds: number; perDay: Record<string, { commits: number; reveals: number }>; windowMove?: { rounds: number; avgPts: number | null; thresholdPts: number; active: boolean } };
  rounds: SnapRound[];
  profiles?: Record<string, { isPublic: boolean; name?: string }>;
  operators?: string[]; // round manager, admin and pauser wallets: never ranked (security review L1)
  open?: { forecasts: OpenForecast[]; committers: string[] }; // v2 open forecasts (indexer/build_open.mjs), absent until OpenForecasts is live
}

// One v2 open forecast (docs/OPEN_FORECASTS.md). bps values are the chance for `slot`; Brier units as v1 (BRIER_MAX).
export interface OpenForecast {
  key: string;
  marketId: string;
  forecaster: string;
  slot: number;
  committedAt: number;
  baselineBps: number | null;
  voided: boolean;
  revealedBps: number | null;
  scored: { brier: string; baselineBrier: string; skill: string; baselineUsed: boolean; forfeited: boolean } | null;
  finalized: { slot0Outcome: Outcome; split: boolean; at: number } | null;
}

// A v2 forecast counts toward the record only when scored on a Yes or No payout: void forecasts and split payouts never count.
// counts only with a market price posted in time: without one it carries no weight at all (re-review M1, so a late
// commit during a keeper gap can never help a record)
// a baseline outside 1 to 99 percent never counts (final review L1: a stolen keeper key cannot mint skill with 0 or 100)
export const openCounts = (f: OpenForecast) => !!f.scored && f.scored.baselineUsed && f.baselineBps !== null && f.baselineBps >= 100 && f.baselineBps <= 9900 && !f.voided && !!f.finalized && !f.finalized.split;
const dayOf = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

export interface RoundFile {
  network: number;
  ledger: string;
  roundId: string | number;
  kind?: string;
  rule?: string;
  commitDeadline: string;
  revealDeadline: string;
  resolutionWaitSeconds?: string | number;
  marketPriceAt?: string;
  board?: 'scored' | 'open';
  featured?: boolean;
  funnel?: Funnel | null;
  questions: { index: number; marketId: string; eventQuestion?: string | null; label?: string | null; endsAt?: string | null; tags?: string[]; marketPrice?: number }[];
}

export interface Funnel { open: number; binary: number; notSports: number; liquid: number; notPolitics: number; inWindow: number; events: number; chosen: number }

export interface Manifest { sample?: boolean; note?: string; snapshot: string; rounds: string[] }

export interface Question {
  index: number;
  title: { event: string; label: string; text: string } | null; // null: no event question, never rendered
  marketId: string;
  endsAt: Date | null;
  tags: string[];
  outcome: Outcome;
  baseline: number | null; // market mid at the commit deadline, bps
  crowd: number | null; // bps
  marketPrice: number | null; // latest published price before the deadline, 0 to 1
  forecasts: number[]; // revealed forecasts, bps
}

export interface Round {
  id: number;
  kind: string;
  rule: string | null;
  commitDeadline: Date;
  revealDeadline: Date;
  resolutionWaitDays: number | null;
  commitCount: number;
  revealedCount: number;
  scoredCount: number;
  forfeitCount: number;
  revealRate: number | null;
  hasBaseline: boolean;
  crowdMethod: string | null;
  marketPriceAt: Date | null;
  board: 'scored' | 'open';
  featured: boolean;
  funnel: Funnel | null;
  questions: Question[];
}

export const BRIER_MAX = 1e8;

export const unpack = (packed: string, n: number): number[] =>
  Array.from({ length: n }, (_, i) => Number((BigInt(packed) >> BigInt(16 * i)) & 0xffffn));

export function safeTitle(q: { eventQuestion?: string | null; label?: string | null } | undefined) {
  try { return presentQuestion(q); } catch { return null; }
}

export function joinRounds(snap: Snapshot, files: RoundFile[]): Round[] {
  const byId = new Map(
    files
      .filter((f) => Number(f.network) === Number(snap.network) && String(f.ledger).toLowerCase() === String(snap.ledger).toLowerCase())
      .map((f) => [String(f.roundId), f]),
  );
  return snap.rounds
    .map((r): Round => {
      const file = byId.get(String(r.roundId));
      const n = r.questions.length;
      const base = r.baseline ? unpack(r.baseline, n) : null;
      const reveals = Object.values(r.forecasts ?? {}).map((p) => unpack(p, n));
      const wait = r.resolutionWait ?? file?.resolutionWaitSeconds;
      return {
        id: Number(r.roundId),
        kind: file?.kind ?? 'daily',
        rule: file?.rule ?? null,
        commitDeadline: new Date(Number(r.commitDeadline) * 1000),
        revealDeadline: new Date(Number(r.revealDeadline) * 1000),
        resolutionWaitDays: wait == null ? null : Number(wait) / 86400,
        commitCount: r.commitCount,
        revealedCount: r.revealed.length,
        scoredCount: Object.keys(r.scored).length,
        forfeitCount: Object.keys(r.forfeited).length,
        revealRate: r.revealRate,
        hasBaseline: base !== null,
        crowdMethod: r.crowd?.method ?? null,
        marketPriceAt: file?.marketPriceAt ? new Date(file.marketPriceAt) : null,
        board: file?.board ?? 'scored',
        featured: file?.featured ?? (file?.kind ?? 'daily') === 'daily',
        funnel: file?.funnel ?? null,
        questions: r.questions.map((q, i) => {
          const fq = file?.questions.find((x) => x.index === i);
          return {
            index: i,
            title: fq ? safeTitle(fq) : null,
            marketId: String(q.marketId),
            endsAt: fq?.endsAt ? new Date(fq.endsAt) : null,
            tags: fq?.tags ?? [],
            outcome: r.outcomes[String(i)] ?? 'Unresolved',
            baseline: base ? base[i] : null,
            crowd: r.crowd?.bps?.[i] ?? null,
            marketPrice: typeof fq?.marketPrice === 'number' ? fq.marketPrice : null,
            forecasts: reveals.map((v) => v[i]),
          };
        }),
      };
    })
    .sort((a, b) => b.id - a.id);
}

export type Phase = 'commit' | 'reveal' | 'resolving' | 'scored';
export function phase(r: Round, now: number): Phase {
  if (now < r.commitDeadline.getTime()) return 'commit';
  if (now < r.revealDeadline.getTime()) return 'reveal';
  const resolved = r.questions.every((q) => q.outcome !== 'Unresolved');
  return resolved && r.scoredCount + r.forfeitCount === r.commitCount ? 'scored' : 'resolving';
}

// The round the home page features: one open for commits (nearest deadline), else one in its reveal window, else the newest.
export function liveRound(rounds: Round[], now: number): Round | null {
  const soonest = (end: (r: Round) => number) => rounds.filter((r) => now < end(r)).sort((a, b) => end(a) - end(b))[0];
  return soonest((r) => r.commitDeadline.getTime()) ?? soonest((r) => r.revealDeadline.getTime()) ?? rounds[0] ?? null;
}

// Upcoming: rounds open for commits now (nearest deadline first), and when the next daily round opens. The keeper opens
// the daily round from 03:07 UTC (keeper.yml cron "7 3 * * *"; GitHub can start it late), so the site says "about 03:10 UTC".
export const DAILY_OPEN_UTC = { h: 3, m: 10 };
export function upcoming(rounds: Round[], now: number) {
  const open = rounds.filter((r) => phase(r, now) === 'commit').sort((a, b) => a.commitDeadline.getTime() - b.commitDeadline.getTime());
  const d = new Date(now);
  let next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAILY_OPEN_UTC.h, DAILY_OPEN_UTC.m);
  if (next <= now) next += 86400000;
  return { open, nextOpen: new Date(next) };
}

// The banner: every round in its reveal window (it overlaps the next round's commit window) plus the open round with the nearest commit deadline.
export function bannerRounds(rounds: Round[], now: number) {
  const reveal = rounds.filter((r) => phase(r, now) === 'reveal').sort((a, b) => a.revealDeadline.getTime() - b.revealDeadline.getTime());
  const commit = rounds.filter((r) => phase(r, now) === 'commit').sort((a, b) => a.commitDeadline.getTime() - b.commitDeadline.getTime())[0] ?? null;
  return { reveal, commit };
}

const brierOf = (p: number, outcome: Outcome) => (p - (outcome === 'Yes' ? 10000 : 0)) ** 2;

// Agent ID Crowd vs Market on every resolved Yes/No question that has both a crowd value and a baseline.
export function crowdVsMarket(rounds: Round[]) {
  let crowd = 0, market = 0, n = 0;
  for (const r of rounds) for (const q of r.questions) {
    if ((q.outcome !== 'Yes' && q.outcome !== 'No') || q.crowd == null || q.baseline == null) continue;
    crowd += brierOf(q.crowd, q.outcome);
    market += brierOf(q.baseline, q.outcome);
    n++;
  }
  return n ? { crowd: crowd / n / BRIER_MAX, market: market / n / BRIER_MAX, n } : { crowd: null, market: null, n: 0 };
}

export const bins10 = (bps: number[]) => bps.reduce((c, p) => (c[Math.min(9, Math.floor(p / 1000))]++, c), Array(10).fill(0) as number[]);

// Expected calibration error over 10 equal bins (diagnostic only, never used for rank).
export function calibrationError(pairs: { p: number; yes: boolean }[]): number | null {
  if (!pairs.length) return null;
  const b = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  for (const { p, yes } of pairs) { const x = b[Math.min(9, Math.floor(p / 1000))]; x.n++; x.p += p / 10000; x.y += yes ? 1 : 0; }
  return b.reduce((s, x) => s + (x.n ? (x.n / pairs.length) * Math.abs(x.p / x.n - x.y / x.n) : 0), 0);
}

export const K = 20;
export const MIN_ROUNDS = 5; // merged board (docs/OPEN_FORECASTS.md Record): scoring days, each scored v1 round counting as one (as before) plus each distinct UTC date of a v2 resolution
export const MIN_BASELINE_QUESTIONS = 20;

export interface Row {
  postBaselineFlag: boolean;
  addr: string;
  name: string | null;
  isPublic: boolean;
  rounds: number; // rounds with a score (revealed or forfeited)
  days: number; // scoring days: scored v1 rounds plus distinct UTC dates of v2 resolutions (ranking needs MIN_ROUNDS)
  openForecasts: number; // scored v2 open forecasts in the record
  roundsCommitted: number;
  roundsRevealed: number;
  questions: number;
  baselineQuestions: number;
  meanBrier: number | null; // 0 to 1
  shrunkSkill: number; // 0 to 1 Brier units, sumSkill / (baselineQuestions + K)
  participation: number | null;
  calibrationError: number | null;
  ranked: boolean;
}

// Leaderboard per docs/SCORING.md, merged with v2 open forecasts per docs/OPEN_FORECASTS.md "Record": one record per
// wallet. Every forecaster is computed (for aggregate counts); only opt in rows are shown.
export function leaderboard(snap: Snapshot): { rows: Row[]; forecasters: number; publicCount: number; all: Row[] } {
  const acc = new Map<string, { committed: number; revealed: number; rounds: number; open: number; days: Set<string>; q: number; bq: number; brier: bigint; skill: bigint; postSkill: bigint; cal: { p: number; yes: boolean }[] }>();
  const get = (a: string) => {
    const k = a.toLowerCase();
    if (!acc.has(k)) acc.set(k, { committed: 0, revealed: 0, rounds: 0, open: 0, days: new Set(), q: 0, bq: 0, brier: 0n, skill: 0n, postSkill: 0n, cal: [] });
    return acc.get(k)!;
  };
  const builtAt = Date.parse(snap.builtAt) / 1000;
  for (const r of snap.rounds) {
    const n = r.questions.length;
    // participation counts only rounds whose reveal window had closed when the snapshot was built
    const closed = !(Number(r.revealDeadline) > builtAt);
    for (const a of r.committers) get(a).committed += closed ? 1 : 0;
    for (const a of r.revealed) get(a).revealed += closed ? 1 : 0;
    for (const [a, s] of [...Object.entries(r.scored), ...Object.entries(r.forfeited)]) {
      const x = get(a);
      x.rounds++;
      x.days.add(`r${r.roundId}`); // v1 keeps its 5 rounds rule: two rounds on one date still count twice
      x.q += Number(s.questions);
      x.brier += BigInt(s.brier);
      if (r.baseline) { x.bq += Number(s.questions); x.skill += BigInt(s.skill); }
      if (r.baseline && r.commitTiming?.[a.toLowerCase()]?.afterBaseline) x.postSkill += BigInt(s.skill); // committed after seeing the baseline
    }
    for (const [a, packed] of Object.entries(r.forecasts ?? {})) {
      unpack(packed, n).forEach((p, i) => {
        const o = r.outcomes[String(i)];
        if (o === 'Yes' || o === 'No') get(a).cal.push({ p, yes: o === 'Yes' });
      });
    }
  }
  for (const f of snap.open?.forecasts ?? []) {
    const x = get(f.forecaster);
    if (!openCounts(f)) continue;
    const s = f.scored!;
    x.open++;
    x.q++;
    x.brier += BigInt(s.brier);
    x.days.add(dayOf(f.finalized!.at));
    if (s.baselineUsed) { x.bq++; x.skill += BigInt(s.skill); }
    if (f.revealedBps !== null) x.cal.push({ p: f.revealedBps, yes: (f.finalized!.slot0Outcome === 'Yes') === (f.slot === 0) });
  }
  const profiles = Object.fromEntries(Object.entries(snap.profiles ?? {}).map(([a, p]) => [a.toLowerCase(), p]));
  const ops = new Set((snap.operators ?? []).map((a) => a.toLowerCase()));
  const all: Row[] = [...acc.entries()].map(([addr, x]) => {
    const prof = profiles[addr];
    const isPublic = !!prof?.isPublic;
    return {
      addr,
      name: isPublic ? prof?.name ?? null : null,
      isPublic,
      rounds: x.rounds,
      days: x.days.size,
      openForecasts: x.open,
      roundsCommitted: x.committed,
      roundsRevealed: x.revealed,
      questions: x.q,
      baselineQuestions: x.bq,
      meanBrier: x.q ? Number(x.brier) / x.q / BRIER_MAX : null,
      shrunkSkill: Number(x.skill) / (x.bq + K) / BRIER_MAX,
      participation: x.committed ? x.revealed / x.committed : null,
      calibrationError: calibrationError(x.cal),
      ranked: isPublic && !ops.has(addr) && x.days.size >= MIN_ROUNDS && x.bq >= MIN_BASELINE_QUESTIONS,
      // pre registered 23 Nov 2026: once the first 5 rounds show an average window move above 0.5 points, flag positive skill earned by post baseline commits
      postBaselineFlag: !!snap.metrics.windowMove?.active && x.postSkill > 0n,
    };
  });
  const rows = all.filter((r) => r.isPublic).sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.shrunkSkill - a.shrunkSkill);
  return { rows, forecasters: all.length, publicCount: rows.length, all };
}

// One wallet's results card: no money moves in Forewit, so a round is won or lost against the market price.
// beat: skill above 0 (closer to the truth than the market); behind: below 0; level: exactly 0;
// forfeited: committed but never revealed; waiting: revealed, questions not scored yet; reveal: reveal still owed.
export type RoundVerdict = 'beat' | 'behind' | 'level' | 'scored' | 'forfeited' | 'waiting' | 'reveal' | 'missed';
export interface WalletRound { roundId: number; verdict: RoundVerdict; questions: number | null; skill: number | null; brier: number | null; marketBrier: number | null }
// v2 open forecasts on the card: void (voided or split payout), forfeited, scored (beat, behind, level, or scored without
// a market price), revealed (waiting for scoring), waiting (sealed until the market resolves).
export type PredictionStatus = 'waiting' | 'revealed' | 'beat' | 'behind' | 'level' | 'scored' | 'void' | 'forfeited';
export interface WalletPrediction {
  marketId: string; slot: number; committedAt: Date; status: PredictionStatus;
  chance: number | null; // your chance for `slot`, 0 to 1; null while sealed
  open: boolean; // market not resolved onchain yet and not void: a live price makes sense
  skill: number | null; brier: number | null; marketBrier: number | null;
}
export function walletPredictions(snap: Snapshot, addr: string): WalletPrediction[] {
  const a = addr.toLowerCase();
  return (snap.open?.forecasts ?? [])
    .filter((f) => f.forecaster.toLowerCase() === a)
    .map((f): WalletPrediction => {
      const s = f.scored;
      const counted = openCounts(f);
      const brier = counted ? Number(s!.brier) / BRIER_MAX : null;
      const skill = counted && s!.baselineUsed ? Number(s!.skill) / BRIER_MAX : null;
      const status: PredictionStatus = f.voided || f.finalized?.split ? 'void'
        : counted && s!.forfeited ? 'forfeited'
        : counted ? (skill === null ? 'scored' : skill > 0 ? 'beat' : skill < 0 ? 'behind' : 'level')
        : s ? 'scored' // scored onchain without a market price: shown, never counted
        : f.revealedBps !== null ? 'revealed' : 'waiting';
      return {
        marketId: f.marketId, slot: f.slot, committedAt: new Date(f.committedAt * 1000), status,
        chance: f.revealedBps === null ? null : f.revealedBps / 10000,
        open: !f.finalized && !f.voided,
        skill, brier, marketBrier: brier !== null && skill !== null ? brier + skill : null,
      };
    })
    .sort((x, y) => y.committedAt.getTime() - x.committedAt.getTime());
}

export interface WalletResults {
  addr: string; rounds: WalletRound[]; predictions: WalletPrediction[];
  committed: number; revealed: number; beat: number; behind: number; forfeited: number;
  avgSkill: number | null; shrunkSkill: number; rank: number | null; ranked: boolean; isPublic: boolean;
}

export function walletResults(snap: Snapshot, addr: string): WalletResults {
  const a = addr.toLowerCase();
  const has = (list: string[]) => list.some((x) => x.toLowerCase() === a);
  const pick = (rec: Record<string, Sums>) => Object.entries(rec).find(([k]) => k.toLowerCase() === a)?.[1];
  const builtAt = Date.parse(snap.builtAt) / 1000;
  let bq = 0, skillSum = 0;
  const rounds = snap.rounds
    .filter((r) => has(r.committers))
    .map((r): WalletRound => {
      const s = pick(r.scored), f = pick(r.forfeited), sums = s ?? f;
      const q = sums ? Number(sums.questions) : null;
      const per = (v: string | undefined) => (sums && q ? Number(v) / q / BRIER_MAX : null);
      const skill = r.baseline ? per(sums?.skill) : null;
      if (sums && r.baseline) { bq += Number(sums.questions); skillSum += Number(sums.skill); }
      const verdict: RoundVerdict = f ? 'forfeited'
        : s ? (skill === null ? 'scored' : skill > 0 ? 'beat' : skill < 0 ? 'behind' : 'level')
        : has(r.revealed) ? 'waiting'
        : Number(r.revealDeadline) > builtAt ? 'reveal' : 'missed';
      const brier = per(sums?.brier);
      return { roundId: Number(r.roundId), verdict, questions: q, skill, brier, marketBrier: brier !== null && skill !== null ? brier + skill : null };
    })
    .sort((x, y) => y.roundId - x.roundId);
  const predictions = walletPredictions(snap, a);
  for (const f of snap.open?.forecasts ?? []) {
    if (f.forecaster.toLowerCase() !== a || !openCounts(f) || !f.scored!.baselineUsed) continue;
    bq++;
    skillSum += Number(f.scored!.skill);
  }
  const lb = leaderboard(snap);
  const row = lb.all.find((r) => r.addr === a);
  const rank = row?.ranked ? lb.rows.filter((r) => r.ranked).findIndex((r) => r.addr === a) + 1 : null;
  return {
    addr: a, rounds, predictions,
    committed: rounds.length,
    revealed: rounds.filter((r) => !['reveal', 'missed', 'forfeited'].includes(r.verdict)).length,
    beat: rounds.filter((r) => r.verdict === 'beat').length,
    behind: rounds.filter((r) => r.verdict === 'behind').length,
    forfeited: rounds.filter((r) => r.verdict === 'forfeited').length,
    avgSkill: bq ? skillSum / bq / BRIER_MAX : null,
    shrunkSkill: skillSum / (bq + K) / BRIER_MAX,
    rank, ranked: !!row?.ranked, isPublic: !!row?.isPublic,
  };
}

export interface Dataset { manifest: Manifest; snapshot: Snapshot; rounds: Round[] }

export async function loadData(base = import.meta.env.BASE_URL): Promise<Dataset> {
  const get = async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${base}data/${path}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  };
  const manifest = await get<Manifest>('index.json');
  const [snapshot, files] = await Promise.all([
    get<Snapshot>(manifest.snapshot),
    Promise.all(manifest.rounds.map((p) => get<RoundFile>(p).catch(() => null))),
  ]);
  return { manifest, snapshot, rounds: joinRounds(snapshot, files.filter((f): f is RoundFile => f !== null)) };
}
