// The extended view: every open Predict.fun market, grouped, with why it is or is not in a Forewit round.
// Input is the keeper's own daily download (keeper/archive/<network>/<day>_daily/markets_raw.json), so publishing it
// costs no API call and no gas. Output stays small: counts per group plus the most traded markets of each group.

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

const mid = (m) => {
  const a = m.outcomes?.[0];
  if (!a?.bestBid || !a?.bestAsk) return null;
  return Math.round(((Number(a.bestBid.price) + Number(a.bestAsk.price)) / 2) * 1000) / 10; // percent, one decimal
};

/** {fetchedAt, total, groups: {name: {count, why, top: [...]}}}; `asked` holds market ids already in a Forewit round. */
export function marketsView(raw, { fetchedAt, asked = new Set(), perGroup = 60 } = {}) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g, { count: 0, why: WHY[g], top: [] }]));
  const by = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const m of raw) {
    const g = groupOf(m);
    groups[g].count++;
    by[g].push(m);
  }
  for (const g of GROUPS) {
    groups[g].top = by[g]
      .sort((a, b) => (b.stats?.volume24hUsd ?? 0) - (a.stats?.volume24hUsd ?? 0))
      .slice(0, perGroup)
      .map((m) => ({ id: String(m.id), title: String(m.title ?? '').slice(0, 140), question: String(m.question ?? '').slice(0, 200), category: m.categorySlug ?? null, yesPct: mid(m), vol24hUsd: Math.round(m.stats?.volume24hUsd ?? 0), inRound: asked.has(String(m.id)) }));
  }
  return { fetchedAt, total: raw.length, groups };
}
