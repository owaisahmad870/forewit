// Backtest of agent/lib/baseline.mjs on Predict.fun style daily Up or Down questions (BTC, ETH, BNB), rebuilt from
// Binance spot candles with the exact rule: Up if the 1m close at noon ET on day D beats the 1m close at noon ET on D minus 1.
// Read only, public data, no key. Run: node scripts/research/baseline_backtest.mjs [days=365]
// Prints Brier vs the 0.25 coin flip with a paired SE, and calibration, at several commit times (hours after start).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { noonEt, pUp, sigmaPerMinute, SIGMA_DAYS } from '../../agent/lib/baseline.mjs';

const DAYS = Number(process.argv[2] ?? 365);
const ASSETS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
const HOST = 'https://data-api.binance.vision';
const CACHE = 'scripts/research/.cache';
mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    await sleep(1000 * (i + 1));
  }
  throw new Error('fetch failed ' + url);
}
async function cached(name, f) {
  const p = `${CACHE}/${name}.json`;
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  const v = await f(); writeFileSync(p, JSON.stringify(v)); return v;
}

const today = new Date();
const days = [];
for (let i = DAYS; i >= 1; i--) { const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)); days.push([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]); }
const noons = [...days.map(([y, m, d]) => noonEt(y, m, d))];
const first = noons[0] - (SIGMA_DAYS + 2) * 86400000;

// Commit times to evaluate, in hours after the window start. Our daily deadline is 23:00 UTC = 6 h (winter) or 7 h (summer).
const EVAL_H = [0.5, 3, 6, 12, 18, 23];

const rows = [];
for (const sym of ASSETS) {
  const hourly = await cached(`${sym}_1h_${DAYS}`, async () => {
    const out = []; let t = first;
    while (t < Date.now()) { const k = await get(`${HOST}/api/v3/klines?symbol=${sym}&interval=1h&startTime=${t}&limit=1000`); if (!k.length) break; out.push(...k.map((x) => [x[0], Number(x[4])])); t = k[k.length - 1][0] + 3600000; }
    return out;
  });
  const hIdx = new Map(hourly.map(([t, c], i) => [t, i]));
  const at1m = await cached(`${sym}_noon1m_${DAYS}`, async () => {
    const o = {};
    for (const n of noons) { const k = await get(`${HOST}/api/v3/klines?symbol=${sym}&interval=1m&startTime=${n}&limit=1`); if (k.length && k[0][0] === n) o[n] = Number(k[0][4]); }
    return o;
  });
  for (let i = 1; i < noons.length; i++) {
    const startMs = noons[i - 1], endMs = noons[i];
    const start = at1m[startMs], end = at1m[endMs];
    if (start == null || end == null || end === start) continue;
    const y = end > start ? 1 : 0;
    for (const h of EVAL_H) {
      const nowMs = startMs + h * 3600000;
      const hourOpen = Math.floor(nowMs / 3600000) * 3600000 - 3600000; // last fully closed hour before nowMs
      const j = hIdx.get(hourOpen);
      if (j == null || j < SIGMA_DAYS * 24 || hourOpen + 3600000 >= endMs) continue;
      const now = hourly[j][1];
      const sigmaMin = sigmaPerMinute(hourly.slice(j - SIGMA_DAYS * 24, j + 1).map((x) => x[1]));
      rows.push({ sym, day: i, h, y, startMs, endMs, nowMs: hourOpen + 3600000, start, now, sigmaMin });
    }
  }
}

const brier = (p, y) => (p - y) ** 2;
function score(rs, scale) {
  const d = rs.map((r) => { const p = pUp({ ...r, scale }); return { p, y: r.y, b: brier(p, r.y), diff: brier(p, r.y) - 0.25 }; });
  const n = d.length, B = d.reduce((a, x) => a + x.b, 0) / n, md = B - 0.25;
  const sd = Math.sqrt(d.reduce((a, x) => a + (x.diff - md) ** 2, 0) / (n - 1));
  const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  for (const x of d) { const k = Math.min(9, Math.floor(x.p * 10)); bins[k].n++; bins[k].p += x.p; bins[k].y += x.y; }
  const ece = bins.reduce((a, b) => a + (b.n ? Math.abs(b.p / b.n - b.y / b.n) * b.n : 0), 0) / n;
  return { n, brier: B, se: sd / Math.sqrt(n), ece };
}

// Half A (older days) picks a volatility scale; half B (newer days) confirms. Scale 1 is the untuned model.
const half = Math.floor(DAYS / 2);
const A = rows.filter((r) => r.day < half), Bh = rows.filter((r) => r.day >= half);
const scales = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5];
const pick = scales.map((s) => [s, score(A.filter((r) => r.h === 6 || r.h === 12), s).brier]).sort((a, b) => a[1] - b[1])[0][0];

const lines = [`Baseline backtest: ${ASSETS.join(', ')}, last ${DAYS} days to ${today.toISOString().slice(0, 10)}, Binance spot candles, rule: Up if noon ET close beats the previous noon ET close.`,
  `Volatility scale picked on half A (older ${half} days, hours 6 and 12): ${pick}. Numbers below are on half B (newer days) unless marked all.`, ''];
for (const h of EVAL_H) {
  const all1 = score(rows.filter((r) => r.h === h), 1), b1 = score(Bh.filter((r) => r.h === h), 1), bp = score(Bh.filter((r) => r.h === h), pick);
  lines.push(`* ${String(h).padStart(4)} h after start: all scale 1 Brier ${all1.brier.toFixed(4)} (n ${all1.n}, SE ${all1.se.toFixed(4)}, calib err ${(all1.ece * 100).toFixed(1)} pts) | half B scale 1 ${b1.brier.toFixed(4)} calib ${(b1.ece * 100).toFixed(1)} | half B scale ${pick} ${bp.brier.toFixed(4)} calib ${(bp.ece * 100).toFixed(1)} (n ${bp.n})`);
}
writeFileSync(CACHE + "/p6.json", JSON.stringify(rows.filter((r) => r.h === 6).map((r) => pUp({ ...r, scale: 1 }))));
console.log(lines.join('\n'));
writeFileSync('scripts/research/baseline_backtest.out.txt', lines.join('\n') + '\n');
