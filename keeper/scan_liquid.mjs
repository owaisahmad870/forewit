// Read only: the most traded open markets, bucketed by hours from a commit deadline to their category endsAt.
// Run: node --env-file=.env keeper/scan_liquid.mjs [pages=5] [hoursToCommitDeadline=20]
const get = async (p) => (await fetch('https://api.predict.fun' + p, { headers: { 'x-api-key': process.env.PREDICT_API_KEY } })).json();
const pages = Number(process.argv[2] ?? 5), cd = Date.now() + Number(process.argv[3] ?? 20) * 3.6e6;
let cur = '', all = [];
for (let i = 0; i < pages; i++) {
  const j = await get('/v1/markets?status=OPEN&first=100&includeStats=true&sort=VOLUME_24H_DESC' + (cur ? '&after=' + cur : ''));
  all.push(...j.data); cur = j.cursor; if (!cur) break;
}
const cat = {};
for (const s of new Set(all.map((m) => m.categorySlug))) cat[s] = (await get('/v1/categories/' + s)).data;
const yesNo = (m) => m.outcomes.length === 2 && /^(Yes|Up)$/.test(m.outcomes[0].name) && /^(No|Down)$/.test(m.outcomes[1].name);
const twoSided = (m) => m.outcomes[0].bestBid && m.outcomes[0].bestAsk && m.outcomes[0].bestAsk.price - m.outcomes[0].bestBid.price <= 0.1;
const rows = all.map((m) => ({ m, h: (Date.parse(cat[m.categorySlug]?.endsAt) - cd) / 3.6e6, v: m.stats?.volume24hUsd ?? 0 })).filter((r) => yesNo(r.m) && twoSided(r.m) && r.v >= 100);
const bands = [[-1e9, 0, 'before deadline'], [0, 12, '0 to 12 h'], [12, 24, '12 to 24 h'], [24, 72, '24 to 72 h'], [72, 168, '3 to 7 days'], [168, 1e9, 'over 7 days']];
console.log(`top ${all.length} open markets by 24 h volume; ${rows.length} are binary Yes/No or Up/Down, two sided, spread <= 0.10, volume >= 100 USD`);
for (const [lo, hi, name] of bands) {
  const b = rows.filter((r) => r.h >= lo && r.h < hi);
  const byV = {}; for (const r of b) byV[r.m.marketVariant] = (byV[r.m.marketVariant] || 0) + 1;
  const events = new Set(b.map((r) => r.m.categorySlug)).size;
  console.log(`${name.padEnd(16)} markets ${String(b.length).padStart(4)}  events ${String(events).padStart(3)}  vol24h ${Math.round(b.reduce((s, r) => s + r.v, 0))}  ${JSON.stringify(byV)}`);
  console.log('   e.g.', b.slice(0, 3).map((r) => `${r.m.title.slice(0, 50)} (${Math.round(r.h)} h)`).join(' | '));
}
