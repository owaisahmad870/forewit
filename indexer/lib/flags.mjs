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
