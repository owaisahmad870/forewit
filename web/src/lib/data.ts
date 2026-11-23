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
  crowd?: { method: string; bps: (number | null)[] } | null;
}

export interface Snapshot {
  network: number;
  ledger: string;
  builtAt: string;
  metrics: { distinctCommitters: number; rounds: number; perDay: Record<string, { commits: number; reveals: number }> };
  rounds: SnapRound[];
  profiles?: Record<string, { isPublic: boolean; name?: string }>;
}

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
  questions: { index: number; marketId: string; eventQuestion?: string | null; label?: string | null; endsAt?: string | null; tags?: string[]; marketPrice?: number }[];
}

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
export const MIN_ROUNDS = 5;
export const MIN_BASELINE_QUESTIONS = 20;

export interface Row {
  addr: string;
  name: string | null;
  isPublic: boolean;
  rounds: number; // rounds with a score (revealed or forfeited)
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

// Leaderboard per docs/SCORING.md. Every forecaster is computed (for aggregate counts); only opt in rows are shown.
export function leaderboard(snap: Snapshot): { rows: Row[]; forecasters: number; publicCount: number } {
  const acc = new Map<string, { committed: number; revealed: number; rounds: number; q: number; bq: number; brier: bigint; skill: bigint; cal: { p: number; yes: boolean }[] }>();
  const get = (a: string) => {
    const k = a.toLowerCase();
    if (!acc.has(k)) acc.set(k, { committed: 0, revealed: 0, rounds: 0, q: 0, bq: 0, brier: 0n, skill: 0n, cal: [] });
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
      x.q += Number(s.questions);
      x.brier += BigInt(s.brier);
      if (r.baseline) { x.bq += Number(s.questions); x.skill += BigInt(s.skill); }
    }
    for (const [a, packed] of Object.entries(r.forecasts ?? {})) {
      unpack(packed, n).forEach((p, i) => {
        const o = r.outcomes[String(i)];
        if (o === 'Yes' || o === 'No') get(a).cal.push({ p, yes: o === 'Yes' });
      });
    }
  }
  const profiles = Object.fromEntries(Object.entries(snap.profiles ?? {}).map(([a, p]) => [a.toLowerCase(), p]));
  const all: Row[] = [...acc.entries()].map(([addr, x]) => {
    const prof = profiles[addr];
    const isPublic = !!prof?.isPublic;
    return {
      addr,
      name: isPublic ? prof?.name ?? null : null,
      isPublic,
      rounds: x.rounds,
      roundsCommitted: x.committed,
      roundsRevealed: x.revealed,
      questions: x.q,
      baselineQuestions: x.bq,
      meanBrier: x.q ? Number(x.brier) / x.q / BRIER_MAX : null,
      shrunkSkill: Number(x.skill) / (x.bq + K) / BRIER_MAX,
      participation: x.committed ? x.revealed / x.committed : null,
      calibrationError: calibrationError(x.cal),
      ranked: isPublic && x.rounds >= MIN_ROUNDS && x.bq >= MIN_BASELINE_QUESTIONS,
    };
  });
  const rows = all.filter((r) => r.isPublic).sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.shrunkSkill - a.shrunkSkill);
  return { rows, forecasters: all.length, publicCount: rows.length };
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
