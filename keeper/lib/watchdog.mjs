// Missed run detection from onchain state only (no access to the keeper host needed).
// Pure; unit tested in keeper/test/watchdog.test.mjs. Times in unix seconds.
export const GRACE = 15 * 60;
export const DAY = 24 * 3600;

/**
 * @param {object} o
 * @param {{commitDeadline:number, revealDeadline:number, questionCount:number, resolvedMask:number, baselineCommit:string, baselineRevealed:boolean, isSealed:boolean}} o.round
 * @param {number} o.resolvedOnchainMask questions whose CTF payoutDenominator > 0
 * @param {number} o.unprocessed committers neither scored nor forfeited
 * @param {number} o.now
 * @returns {string[]} missed duties, empty when the round is on schedule
 */
export function missedDuties({ round, resolvedOnchainMask, unprocessed, now, grace = GRACE }) {
  const out = [];
  const cd = Number(round.commitDeadline), rd = Number(round.revealDeadline);
  const noBaseline = /^0x0{64}$/.test(round.baselineCommit ?? '0x' + '0'.repeat(64));
  if (now >= cd && noBaseline) out.push('baseline: not committed before the commit deadline');
  if (now > cd + grace && !round.isSealed) out.push('seal: round not sealed 15 minutes after the commit deadline');
  if (now > cd + grace && !noBaseline && !round.baselineRevealed) out.push('baseline reveal: not revealed 15 minutes after the commit deadline');
  const pending = resolvedOnchainMask & ~Number(round.resolvedMask);
  if (now > cd + grace && pending !== 0) out.push(`finalize: questions resolved onchain but not finalized (mask ${pending})`);
  const all = (1 << Number(round.questionCount)) - 1;
  if (now > rd + grace && Number(round.resolvedMask) === all && unprocessed > 0) out.push(`score: ${unprocessed} committers not scored or forfeited`);
  return out;
}

/** A daily round must be created every day: alert when the newest round is older than a day plus grace. */
export function dailyOpenMissed(latestCreatedAt, now, grace = GRACE) {
  return now > Number(latestCreatedAt) + DAY + grace ? ['open: no new daily round in the last 24 hours'] : [];
}
