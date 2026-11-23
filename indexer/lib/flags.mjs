// Round and forecaster flags published with every snapshot (security review mitigations). Pure; tests in indexer/test/flags.test.mjs.

/** baseline_missing: the commit deadline passed with no baseline posted, so the round scores with skill 0 (review M1). */
export function roundFlags(round, nowSec) {
  const out = [];
  if (nowSec >= Number(round.commitDeadline) && (round.baseline === null || round.baseline === undefined)) out.push('baseline_missing');
  return out;
}

/** Current holders of each role from RoleGranted and RoleRevoked events in log order. */
export function roleHolders(events) {
  const holders = {};
  for (const e of events) {
    const set = (holders[e.role] ??= new Set());
    if (e.eventName === 'RoleGranted') set.add(e.account.toLowerCase());
    if (e.eventName === 'RoleRevoked') set.delete(e.account.toLowerCase());
  }
  return holders;
}

/** Operators (round manager, admin, pauser holders) never appear on the leaderboard (review L1). */
export function operators(holders) {
  return [...new Set(Object.values(holders).flatMap((s) => [...s]))].sort();
}

/**
 * Commit timing versus the baseline post (Owais, 23 Nov 2026). commits: [{ forecaster, at }] in log order (unix s);
 * baselineAt: unix s of BaselineSet, or null. The effective commit is a forecaster's last one (overwrites allowed).
 * gapSec = at minus baselineAt (positive: committed after seeing the posted baseline).
 */
export function commitTiming(commits, baselineAt) {
  const last = {};
  for (const c of commits) last[c.forecaster.toLowerCase()] = Number(c.at);
  const out = {};
  for (const [f, at] of Object.entries(last)) {
    const gapSec = baselineAt === null || baselineAt === undefined ? null : at - Number(baselineAt);
    out[f] = { at, afterBaseline: gapSec !== null && gapSec >= 0, gapSec };
  }
  return out;
}

/** Mean absolute market move inside the posting window, in probability points (bps / 100): baseline vs deadline mids. */
export function meanMovePts(baselineBps, deadlineBps) {
  const pairs = baselineBps.map((b, i) => [b, deadlineBps[i]]).filter(([b, d]) => Number.isFinite(b) && Number.isFinite(d));
  return pairs.length ? pairs.reduce((s, [b, d]) => s + Math.abs(d - b), 0) / pairs.length / 100 : null;
}
