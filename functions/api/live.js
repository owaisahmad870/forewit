// forewit.xyz/api/live?ids=1,2,3: live Predict.fun prices, ONLY for markets that carry a Forewit open forecast in the
// published snapshot, so this never becomes a general Predict.fun data feed (their terms forbid redistribution).
// Uses Forewit's own key (Pages secret PREDICT_LIVE_API_KEY); each market is edge cached 15 s, the snapshot 60 s.
// No imports, so it deploys even when the MCP connector bundle does not.
const SNAPSHOT = 'https://forewit.xyz/data/snapshot.json';
const MAX_IDS = 20;
let allowed = { at: -Infinity, ids: new Set() };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=15', 'x-content-type-options': 'nosniff' },
});

async function openIds(fetchImpl, now) {
  if (now - allowed.at < 60_000) return allowed.ids;
  try {
    const r = await fetchImpl(SNAPSHOT);
    if (r.ok) {
      const snap = await r.json();
      allowed = { at: now, ids: new Set((snap.open?.forecasts ?? []).map((f) => String(f.marketId))) };
    }
  } catch { /* keep the last known list */ }
  return allowed.ids;
}

// same formula as agent/lib/open.mjs marketInfo: the order book middle of outcome 1, in percent with one decimal
const yesPct = (m) => {
  const a = m?.outcomes?.[0];
  return a?.bestBid && a?.bestAsk ? Math.round(((Number(a.bestBid.price) + Number(a.bestAsk.price)) / 2) * 1000) / 10 : null;
};

async function price(id, key, fetchImpl, cache) {
  const cacheKey = new Request(`https://forewit.xyz/api/live/market/${id}`);
  const hit = cache && (await cache.match(cacheKey));
  if (hit) return hit.json();
  const r = await fetchImpl(`https://api.predict.fun/v1/markets/${id}`, { headers: { 'x-api-key': key } });
  if (!r.ok) return null;
  const m = (await r.json())?.data;
  const p = { yesPct: yesPct(m), tradingStatus: m?.tradingStatus ?? null, status: m?.status ?? null };
  await cache?.put(cacheKey, new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=15' } }));
  return p;
}

export async function live(request, env, { fetchImpl = fetch, cache = globalThis.caches?.default, now = Date.now() } = {}) {
  const raw = new URL(request.url).searchParams.get('ids') ?? '';
  const ids = [...new Set(raw.split(',').filter(Boolean))];
  if (!ids.length || ids.length > MAX_IDS || !ids.every((x) => /^\d{1,18}$/.test(x))) return json({ error: `ids: 1 to ${MAX_IDS} market ids, digits only, comma separated` }, 400);
  const ok = await openIds(fetchImpl, now);
  const want = ids.filter((x) => ok.has(x));
  const prices = {};
  if (want.length && env.PREDICT_LIVE_API_KEY) {
    const got = await Promise.all(want.map((x) => price(x, env.PREDICT_LIVE_API_KEY, fetchImpl, cache).catch(() => null)));
    want.forEach((x, i) => { if (got[i]) prices[x] = got[i]; });
  }
  return json({ prices, source: 'Predict.fun', at: new Date(now).toISOString() });
}

export const onRequestGet = ({ request, env }) => live(request, env);
export const resetAllowed = () => { allowed = { at: -Infinity, ids: new Set() }; }; // tests only
