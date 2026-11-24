// Read only dry run of rule v3.2 topic rounds against live Predict.fun data. Sends nothing.
// Run: node --env-file=.env keeper/plan_topics.mjs [--deadline 2026-11-25T23:00:00Z] [--out file]
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isBinary, isSports, isCryptoUpDown } from './lib/selection.mjs';
import { planTopicRounds } from './lib/topics.mjs';

const { values: o } = parseArgs({ options: { deadline: { type: 'string' }, out: { type: 'string' } } });
const API = 'https://api.predict.fun';
const get = async (p) => {
  const r = await fetch(API + p, { headers: { 'x-api-key': process.env.PREDICT_API_KEY } });
  if (!r.ok) throw new Error(`API ${p.split('?')[0]} HTTP ${r.status}`);
  return r.json();
};
const deadline = Date.parse(o.deadline || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1, 23)).toISOString());
const markets = [];
for (let cur = '', i = 0; i < 300; i++) {
  const j = await get('/v1/markets?status=OPEN&first=100&includeStats=true' + (cur ? '&after=' + cur : ''));
  markets.push(...j.data);
  if (!(cur = j.cursor)) break;
}
// categories for every binary market that is not an Up or Down market (sports included: the optional board)
const slugs = [...new Set(markets.filter((m) => isBinary(m) && !isCryptoUpDown(m)).map((m) => m.categorySlug))];
const cats = {};
let calls = 0;
for (const s of slugs) {
  cats[s] = (await get('/v1/categories/' + s).catch(() => ({ data: null }))).data;
  if (++calls % 200 === 0) await new Promise((r) => setTimeout(r, 60_000)); // stay under 250 requests a minute
}
const plan = planTopicRounds(markets, cats, deadline, { caps: { scored: Infinity, open: Infinity, optional: Infinity } });
const count = (f) => plan.rounds.filter(f).length;
const qs = (f) => plan.rounds.filter(f).reduce((n, r) => n + r.questions.length, 0);
const summary = {
  deadline: new Date(deadline).toISOString(), openMarkets: markets.length, categoriesFetched: slugs.length, skipped: plan.skipped,
  scored: { rounds: count((r) => r.board === 'scored' && !r.optional), questions: qs((r) => r.board === 'scored' && !r.optional) },
  open: { rounds: count((r) => r.board === 'open' && !r.optional), questions: qs((r) => r.board === 'open' && !r.optional) },
  optional: { rounds: count((r) => r.optional), questions: qs((r) => r.optional), sportsMarkets: markets.filter((m) => isSports(m)).length },
  byTopic: Object.fromEntries(['crypto', 'macro', 'tech', 'weather', 'other', 'sports', 'elections'].map((t) => [t, `${count((r) => r.topic === t)} rounds / ${qs((r) => r.topic === t)} q`])),
};
console.log(JSON.stringify(summary, null, 1));
if (o.out) writeFileSync(o.out, JSON.stringify({ summary, rounds: plan.rounds }, null, 1));
