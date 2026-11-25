// The extended view: every open Predict.fun market, grouped, with why it is or is not in a Forewit round.
// Input is the keeper's own daily download (keeper/archive/<network>/<day>_daily/markets_raw.json), so publishing it
// costs no API call and no gas. Output is counts per group and the reason only (see marketsView).

export const GROUPS = ['crypto_short', 'crypto_daily', 'sports', 'esports', 'tweets', 'other'];
// why a group is not in today's scored rounds (rule v3.1 and the ledger's 2 hour minimum commit window)
export const WHY = {
  crypto_short: 'resolves within minutes or hours: commits stay open at least 2 hours, so it would settle before the deadline',
  crypto_daily: 'eligible: daily crypto questions are in the daily round',
  sports: 'approved for the optional sports board (25 Nov 2026); liquid markets join topic rounds once they switch on',
  esports: 'approved for the optional sports board (25 Nov 2026); liquid markets join topic rounds once they switch on',
  tweets: 'eligible when liquid and resolving 6 to 72 hours after a deadline',
  other: 'eligible when liquid, not politics, and resolving 6 to 72 hours after a deadline',
};

export function groupOf(m) {
  const v = m.marketVariant ?? '';
  if (v.startsWith('ESPORTS_')) return 'esports';
  if (v.startsWith('SPORTS_')) return 'sports';
  if (v === 'CRYPTO_UP_DOWN' || v === 'UP_DOWN') return /Up or Down on /.test(m.title ?? '') ? 'crypto_daily' : 'crypto_short';
  if (v === 'TWEET_COUNT') return 'tweets';
  return 'other';
}

/** {fetchedAt, total, groups: {name: {count, why}}, browse}: aggregate counts only. Predict.fun's terms forbid
 * redistributing their data, so no title, price or id ever leaves here; users search markets with their own key. */
export const BROWSE = 'Browse and search markets in your own agent with your own free Predict.fun API key from https://developers.predict.fun (set PREDICT_API_KEY).';
export const SEARCH_COMMAND = 'forewit markets --search "<words>"';
export function marketsView(raw, { fetchedAt } = {}) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g, { count: 0, why: WHY[g] }]));
  for (const m of raw) groups[groupOf(m)].count++;
  return { fetchedAt, total: raw.length, groups, browse: BROWSE, searchCommand: SEARCH_COMMAND };
}
