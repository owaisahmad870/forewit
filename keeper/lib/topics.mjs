// Rule v3.2 topic rounds (docs/QUESTION_SELECTION.md). Pure: markets and categories in, round plans out.
// Boards: scored (liquid, baseline posted, counts for skill) and open (illiquid, no baseline, Brier only).
// Optional boards sports and elections are planned like the others but flagged optional (off by default in the UI).
import { isBinary, isSports, isLiquid, isCryptoUpDown, isDailyCrypto } from './selection.mjs';

export const TOPICS = ['crypto', 'macro', 'tech', 'weather', 'other', 'sports', 'elections'];
export const OPTIONAL = new Set(['sports', 'elections']);
export const MAX_PER_ROUND = 16; // ForecastLedger.MAX_QUESTIONS
// horizon buckets in hours after the commit deadline, with the round's resolution wait in days
export const HORIZONS = [
  { name: '3d', maxH: 72, waitDays: 7 },
  { name: '7d', maxH: 168, waitDays: 14 },
  { name: '30d', maxH: 720, waitDays: 45 },
  { name: '100d', maxH: 2400, waitDays: 120 },
];
export const MIN_H = 6;
// pre registered caps per day (v3.2): every scored round, open rounds capped so keeper gas and user load stay bounded
export const CAPS = { scored: Infinity, open: 10 };

const tagSet = (cat) => new Set((cat?.tags ?? []).map((t) => t?.name ?? t));
const any = (set, list) => list.some((t) => set.has(t));

/** Topic of a market from its category tags; first match wins, sports and elections before everything else. */
export function topicOf(m, cat) {
  const t = tagSet(cat);
  if (isSports(m, cat)) return 'sports';
  const macroTag = any(t, ['Economy', 'Fed']);
  if (any(t, ['Elections', 'Trump']) || (t.has('Politics') && !macroTag)) return 'elections';
  if (any(t, ['Crypto', 'BTC', 'ETH', 'BNB', 'Market Cap', 'Hit Price', 'Pre-Market'])) return 'crypto';
  if (macroTag || any(t, ['Finance', 'Commodities', 'Stocks', 'Global'])) return 'macro';
  if (any(t, ['Tech', 'AI', 'Anthropic', 'IPO', 'Pre-IPO'])) return 'tech';
  if (any(t, ['Weather', 'Science'])) return 'weather';
  return 'other';
}

export const horizonOf = (hours) => HORIZONS.find((h) => hours >= MIN_H && hours <= h.maxH) ?? null;

/**
 * Plan topic rounds for one commit deadline.
 * @param {object[]} markets open markets from the Predict.fun API
 * @param {Record<string, object>} cats categories by slug (endsAt, tags)
 * @param {number} deadlineMs commit deadline
 * @param {{asked?: Set<string>, featured?: Set<string>, caps?: object}} o markets already asked or in the Featured round are skipped
 * @returns {{rounds: {board, topic, horizon, optional, resolutionDays, questions: object[]}[], skipped: object}}
 */
export function planTopicRounds(markets, cats, deadlineMs, { asked = new Set(), featured = new Set(), caps = CAPS } = {}) {
  const groups = new Map();
  const skipped = { notBinary: 0, noCategory: 0, asked: 0, featured: 0, outOfWindow: 0, dailyCrypto: 0 };
  for (const m of markets) {
    const id = String(m.id);
    if (!isBinary(m)) { skipped.notBinary++; continue; }
    if (featured.has(id)) { skipped.featured++; continue; }
    if (asked.has(id)) { skipped.asked++; continue; }
    if (isDailyCrypto(m) || isCryptoUpDown(m)) { skipped.dailyCrypto++; continue; } // these belong to the Featured round
    const cat = cats[m.categorySlug];
    const endMs = Date.parse(cat?.endsAt ?? '');
    if (!cat || !Number.isFinite(endMs)) { skipped.noCategory++; continue; }
    const hz = horizonOf((endMs - deadlineMs) / 3.6e6);
    if (!hz) { skipped.outOfWindow++; continue; }
    const board = isLiquid(m) ? 'scored' : 'open';
    const topic = topicOf(m, cat);
    const key = `${board}|${topic}|${hz.name}`;
    if (!groups.has(key)) groups.set(key, { board, topic, horizon: hz.name, optional: OPTIONAL.has(topic), resolutionDays: hz.waitDays, items: [] });
    groups.get(key).items.push({ m, cat, endMs });
  }
  const rounds = [];
  for (const g of groups.values()) {
    // soonest resolving first, then the most traded
    g.items.sort((a, b) => a.endMs - b.endMs || (b.m.stats?.volume24hUsd ?? 0) - (a.m.stats?.volume24hUsd ?? 0));
    for (let i = 0; i < g.items.length; i += MAX_PER_ROUND) {
      rounds.push({ board: g.board, topic: g.topic, horizon: g.horizon, optional: g.optional, resolutionDays: g.resolutionDays, questions: g.items.slice(i, i + MAX_PER_ROUND).map(({ m, cat }) => ({ marketId: m.id, conditionId: m.conditionId, isYieldBearing: m.isYieldBearing, isNegRisk: m.isNegRisk, category: m.categorySlug, endsAt: cat.endsAt, eventQuestion: cat.title, label: m.title, marketQuestion: m.question, tags: [...tagSet(cat)], vol24h: m.stats?.volume24hUsd ?? 0 })) });
    }
  }
  // order: scored before open, default topics before optional, soonest horizon first; then apply the daily caps
  const hIdx = (h) => HORIZONS.findIndex((x) => x.name === h);
  rounds.sort((a, b) => (a.board === b.board ? 0 : a.board === 'scored' ? -1 : 1) || a.optional - b.optional || hIdx(a.horizon) - hIdx(b.horizon) || TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic));
  const count = { scored: 0, open: 0 };
  const kept = rounds.filter((r) => ++count[r.board] <= (caps[r.board] ?? Infinity));
  return { rounds: kept, dropped: rounds.length - kept.length, skipped };
}
