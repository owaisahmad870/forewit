// Read only market census for the selection rule: how many open Predict.fun markets would pass rule v1 now.
// Run: node --env-file=.env keeper/scan_window.mjs [hoursToCommitDeadline=20]
const KEY = process.env.PREDICT_API_KEY;
const get = async (p) => (await fetch('https://api.predict.fun' + p, { headers: { 'x-api-key': KEY } })).json();
const cdHours = Number(process.argv[2] ?? 20);
const now = Date.now();
const commitDeadline = now + cdHours * 3.6e6;
const CAP = Date.parse('2026-12-08T00:00:00Z');

let cur = '', all = [];
for (let i = 0; i < 200; i++) {
  const j = await get('/v1/markets?status=OPEN&first=100&includeStats=true' + (cur ? '&after=' + cur : ''));
  all.push(...j.data);
  cur = j.cursor;
  if (!cur) break;
}
const slugs = [...new Set(all.map((m) => m.categorySlug))];
const cat = {};
for (const s of slugs) cat[s] = (await get('/v1/categories/' + s)).data;

const bucket = { lt24: 0, '24to72': 0, '72to168': 0, gt168: 0, none: 0 };
const pass = { window: 0, names: 0, book: 0, spread: 0 };
const eligible = [];
for (const m of all) {
  const e = Date.parse(cat[m.categorySlug]?.endsAt ?? '');
  if (!e) { bucket.none++; continue; }
  const h = (e - commitDeadline) / 3.6e6;
  bucket[h < 24 ? 'lt24' : h < 72 ? '24to72' : h < 168 ? '72to168' : 'gt168']++;
  if (!(h >= 24 && h <= 72 && e <= CAP)) continue;
  pass.window++;
  const [a, b] = m.outcomes;
  if (!(m.outcomes.length === 2 && a.indexSet === 1 && b.indexSet === 2 && /^(Yes|Up)$/.test(a.name) && /^(No|Down)$/.test(b.name))) continue;
  pass.names++;
  if (!(a.bestBid && a.bestAsk)) continue;
  pass.book++;
  const spread = a.bestAsk.price - a.bestBid.price;
  if (spread > 0.1) continue;
  pass.spread++;
  eligible.push({ id: m.id, cat: m.categorySlug, endsAt: cat[m.categorySlug].endsAt, variant: m.marketVariant, mid: +((a.bestAsk.price + a.bestBid.price) / 2).toFixed(3), spread: +spread.toFixed(3), vol24h: Math.round(m.stats?.volume24hUsd ?? 0) });
}
console.log(`open markets ${all.length}, categories ${slugs.length}, commit deadline in ${cdHours} h`);
console.log('hours from commit deadline to category endsAt:', JSON.stringify(bucket));
console.log('rule v1 funnel (window and cap, names, two sided book, spread <= 0.10):', JSON.stringify(pass));
console.log('eligible sample:', JSON.stringify(eligible.slice(0, 12)));
const byVariant = {};
for (const e of eligible) byVariant[e.variant] = (byVariant[e.variant] || 0) + 1;
console.log('eligible by variant:', JSON.stringify(byVariant));
const vol = (t) => eligible.filter((e) => e.vol24h >= t).length;
console.log('eligible with 24h volume >= 1, >= 100, >= 1000 USD:', vol(1), vol(100), vol(1000));
console.log('distinct events (categories) among eligible:', new Set(eligible.map((e) => e.cat)).size, '; with volume >= 100:', new Set(eligible.filter((e) => e.vol24h >= 100).map((e) => e.cat)).size);
const lt = all.filter((m) => { const e = Date.parse(cat[m.categorySlug]?.endsAt ?? ''); return e && (e - commitDeadline) / 3.6e6 < 24 && e > commitDeadline; });
const v = {}; for (const m of lt) v[m.marketVariant] = (v[m.marketVariant] || 0) + 1;
console.log('markets ending 0 to 24 h after the commit deadline, by variant:', JSON.stringify(v));

