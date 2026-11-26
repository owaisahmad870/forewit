// forewit plan: one call that tells an agent everything to do today, with numbers (docs/BASELINE.md).
// Script does the work, the agent decides: crypto Up or Down questions get the baseline chance from Binance prices,
// other questions are marked needsView. Returns a ready commit command, duties, the record, streak and a short report.
import { loadDataset, DEFAULT_DATA } from './remote.mjs';
import { phase, walletResults } from '../vendor/web/data.mjs';
import { liveBaseline, BACKTEST } from '../vendor/agent/lib/baseline.mjs';

const CLI = 'npx forewit@latest';
const pct = (x) => Math.round(x * 100);
const hhmm = (d) => new Date(d).toISOString().slice(11, 16) + ' UTC';
const left = (ms) => (ms <= 0 ? 'closed' : ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${Math.floor(ms / 3600000)} h ${Math.round((ms % 3600000) / 60000)} min`);

/** Consecutive daily rounds (newest first, closed ones only) this wallet committed to. */
export function streakOf(rounds, snapshot, addr, now) {
  const a = addr.toLowerCase();
  const committed = new Set(snapshot.rounds.filter((r) => r.committers.some((c) => c.toLowerCase() === a)).map((r) => Number(r.roundId)));
  let n = 0;
  for (const r of rounds.filter((x) => x.kind === 'daily' && x.commitDeadline.getTime() <= now).sort((x, y) => y.id - x.id)) {
    if (!committed.has(r.id)) break;
    n++;
  }
  return n;
}

/** Today's round: the featured daily round open for commits, else the open daily round with the nearest deadline. */
export function todayRound(rounds, now) {
  const open = rounds.filter((r) => phase(r, now) === 'commit').sort((a, b) => a.commitDeadline - b.commitDeadline);
  return open.find((r) => r.featured) ?? open.find((r) => r.kind === 'daily') ?? null;
}

export async function buildPlan({ address, now = Date.now(), data = process.env.FOREWIT_DATA || DEFAULT_DATA, fetchImpl = fetch, baseline = liveBaseline } = {}) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) throw new Error('give your Agent ID wallet address: --from 0x...');
  const ds = await loadDataset(data);
  const a = address.toLowerCase();
  const w = walletResults(ds.snapshot, a);
  const r = todayRound(ds.rounds, now);
  const out = { version: 1, now: new Date(now).toISOString(), address: a, today: null, duties: [], record: null, next: null, report: [] };

  // Duties: rounds this wallet committed to that wait for a reveal (auto reveal does it; otherwise the user must).
  for (const wr of w.rounds.filter((x) => x.verdict === 'reveal')) {
    const rr = ds.rounds.find((x) => x.id === wr.roundId);
    out.duties.push({ type: 'reveal', roundId: wr.roundId, by: rr?.revealDeadline.toISOString(), command: `${CLI} reveal --round ${wr.roundId} --from ${a} --execute`, note: 'skip if you committed with auto reveal: the keeper reveals it' });
  }

  if (r) {
    const done = ds.snapshot.rounds.find((x) => Number(x.roundId) === r.id)?.committers.some((c) => c.toLowerCase() === a) ?? false;
    const questions = [];
    for (const q of r.questions) {
      const title = q.title?.text ?? `question ${q.index + 1}`;
      let b = null;
      try { b = q.endsAt ? await baseline(title, q.endsAt.getTime(), now, fetchImpl) : null; } catch (e) { b = { error: e.message }; }
      const ok = b && !b.error;
      questions.push({
        index: q.index + 1, untrustedTitle: title, endsAt: q.endsAt?.toISOString() ?? null,
        kind: ok ? 'crypto' : 'needsView',
        suggestPct: ok ? pct(b.p) : null,
        why: ok ? (b.phase === 'before start' ? `window starts ${hhmm(b.startMs)}: no move yet, 50/50` : `${b.symbol} ${b.now >= b.start ? '+' : ''}${((b.now / b.start - 1) * 100).toFixed(2)}% since ${hhmm(b.startMs)}, ${left(b.endMs - now)} left, typical day move ${(b.sigmaMin * Math.sqrt(1440) * 100).toFixed(1)}%`)
          : b?.error ? `price data unreachable (${b.error})` : 'not a crypto price question: your view or your research',
      });
    }
    const p = questions.map((q) => q.suggestPct ?? '<your %>').join(',');
    out.today = {
      roundId: r.id, deadline: r.commitDeadline.toISOString(), closesIn: left(r.commitDeadline - now), alreadyCommitted: done,
      questions,
      command: done ? null : `${CLI} commit --round ${r.id} --p ${p} --from ${a} --auto-reveal --execute`,
      evidence: BACKTEST,
    };
  }

  out.record = {
    rounds: w.committed, beat: w.beat, behind: w.behind, missed: w.forfeited,
    avgPoints: w.avgSkill === null ? null : Math.round(w.avgSkill * 1000) / 10,
    rank: w.rank, streak: streakOf(ds.rounds, ds.snapshot, a, now),
  };
  const nextDaily = new Date(now); nextDaily.setUTCHours(3, 10, 0, 0); if (nextDaily.getTime() <= now) nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);
  out.next = r && !out.today.alreadyCommitted
    ? { at: new Date(r.commitDeadline.getTime() - 30 * 60000).toISOString(), why: 'last safe moment for today (deadline minus 30 min); the later, the more the crypto baseline knows' }
    : { at: nextDaily.toISOString(), why: 'next daily round opens' };

  // Caveman report: 6 lines max, numbers only.
  const t = out.today, rec = out.record;
  if (t) out.report.push(t.alreadyCommitted ? `Today round ${t.roundId}: done. Sealed. Auto reveal handles it.` : `Today round ${t.roundId}: ${t.questions.length} questions, closes in ${t.closesIn}.`);
  else out.report.push('No round open now.');
  if (t && !t.alreadyCommitted) {
    const c = t.questions.filter((q) => q.kind === 'crypto'), v = t.questions.length - c.length;
    if (c.length) out.report.push(`Crypto ${c.length}: baseline ${c.map((q) => q.suggestPct + '%').join(', ')} (${BACKTEST.short}).`);
    if (v) out.report.push(`Need your view: ${v} (${t.questions.filter((q) => q.kind === 'needsView').map((q) => q.index).join(', ')}).`);
  }
  if (out.duties.length) out.report.push(`Reveal due: rounds ${out.duties.map((d) => d.roundId).join(', ')}.`);
  out.report.push(rec.rounds ? `Record: ${rec.rounds} rounds, beat market ${rec.beat}, behind ${rec.behind}, missed ${rec.missed}${rec.avgPoints === null ? '' : `, avg ${rec.avgPoints > 0 ? '+' : ''}${rec.avgPoints} pts`}. Streak ${rec.streak}.` : 'Record: empty. First round starts it.');
  out.report.push(`Next: ${out.next.at.slice(0, 16).replace('T', ' ')} UTC, ${out.next.why.split(';')[0]}.`);
  out.routine = {
    offer: 'Want me to do this every day until 9 Dec? One commit a day to the daily picks, value 0 (gas well under $0.01), auto reveal on, crypto from the baseline unless you say otherwise, I report the result. Say stop anytime.',
    limits: { callsPerDay: 1, value: '0', until: '2026-12-09T08:00:00Z', covers: 'commit to the daily round only; reveals by the keeper; anything else asks you first' },
  };
  return out;
}
