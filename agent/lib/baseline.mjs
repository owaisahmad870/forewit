// Forewit baseline for crypto Up or Down questions (docs/BASELINE.md). A random walk estimate, calibrated by design:
// P(Up) = Phi(ln(now / start) / (sigma * sqrt(minutes left))), 0.5 before the window starts. It knows only price and
// volatility, so it is a floor to beat, not an edge. Prices: Binance spot 1m candles, the source Predict.fun resolves on.

export const KLINE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
export const SYMBOLS = { bitcoin: 'BTCUSDT', btc: 'BTCUSDT', ethereum: 'ETHUSDT', eth: 'ETHUSDT', bnb: 'BNBUSDT', solana: 'SOLUSDT', sol: 'SOLUSDT' };
export const SIGMA_DAYS = 7; // realized volatility lookback, hourly closes
export const P_MIN = 0.02, P_MAX = 0.98; // never claim near certainty from a model this simple

// Measured by scripts/research/baseline_backtest.mjs (docs/BASELINE.md); shown to users as the evidence for the baseline.
export const BACKTEST = {
  short: '1 year backtest: Brier 0.214 vs coin flip 0.25 at the deadline, n 1092',
  detail: 'BTC, ETH, BNB daily Up or Down rebuilt from Binance 1m closes, 27 Nov 2025 to 25 Nov 2026. Brier at 6 h after the window start (our 23:00 UTC deadline in winter): 0.2142 (SE 0.0041) vs 0.25 for 50/50; 3 h: 0.2288; 12 h: 0.1824. Calibration error 4.4 points, inside the noise of a perfectly calibrated model at this n (95th percentile 4.55). Not compared with the market price yet; the market likely knows as much, so this is a floor, not an edge.',
  source: 'https://github.com/owaisahmad870/forewit/blob/main/docs/BASELINE.md',
};

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
export function normCdf(x) {
  if (x === 0) return 0.5;
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Per minute log return volatility from hourly closes (oldest first). */
export function sigmaPerMinute(hourlyCloses) {
  const r = [];
  for (let i = 1; i < hourlyCloses.length; i++) r.push(Math.log(hourlyCloses[i] / hourlyCloses[i - 1]));
  if (r.length < 24) throw new Error('need at least 25 hourly closes for volatility');
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v / 60);
}

/** P(Up) for a window [startMs, endMs] seen at nowMs. start is the start close (null before the window starts). */
export function pUp({ start, now, sigmaMin, nowMs, startMs, endMs, scale = 1 }) {
  if (nowMs >= endMs) throw new Error('window already ended');
  if (nowMs < startMs || start == null) return 0.5;
  const left = (endMs - nowMs) / 60000;
  const z = Math.log(now / start) / (sigmaMin * scale * Math.sqrt(left));
  return Math.min(P_MAX, Math.max(P_MIN, normCdf(z)));
}

/** UTC ms of 12:00 in America/New_York on the ET calendar day of `dayUtcMs` (handles daylight saving). */
export function noonEt(y, m, d) {
  for (const h of [16, 17]) {
    const t = Date.UTC(y, m - 1, d, h);
    const hh = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(t);
    if (Number(hh) === 12) return t;
  }
  throw new Error('no noon ET found');
}

/** Daily question window: from noon ET the day before endsAt to endsAt (Predict.fun daily Up or Down rule). */
export function dailyWindow(endsAtMs) {
  const end = new Date(endsAtMs);
  const prev = new Date(endsAtMs - 86400000);
  return { startMs: noonEt(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate()), endMs: noonEt(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
}

/** Asset symbol from a question title like "Bitcoin Up or Down on November 27?" (null when not a crypto Up or Down). */
export function symbolOf(title) {
  const m = /^\s*(\w+)\s+Up or Down\b/i.exec(title ?? '');
  return m ? SYMBOLS[m[1].toLowerCase()] ?? null : null;
}

async function klines(symbol, interval, params, fetchImpl = fetch) {
  let last;
  for (const h of KLINE_HOSTS) {
    try {
      const q = new URLSearchParams({ symbol, interval, ...params });
      const r = await fetchImpl(`${h}/api/v3/klines?${q}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`${h} ${r.status}`);
      return await r.json();
    } catch (e) { last = e; }
  }
  throw new Error(`Binance price data unreachable (${last?.message}); allow data-api.binance.vision in the network list`);
}

/** Close of the 1m candle that opens at `ms` (Predict.fun's "Close price for the 12:00 candle"). */
export async function closeAt(symbol, ms, fetchImpl) {
  const k = await klines(symbol, '1m', { startTime: String(ms), limit: '1' }, fetchImpl);
  if (!k.length || k[0][0] !== ms) throw new Error(`no 1m candle at ${new Date(ms).toISOString()}`);
  return Number(k[0][4]);
}

/** Live baseline for one question: { p, sigmaMin, start, now, minutesLeft, phase }. */
export async function liveBaseline(title, endsAtMs, nowMs = Date.now(), fetchImpl = fetch) {
  const symbol = symbolOf(title);
  if (!symbol) return null;
  const { startMs, endMs } = dailyWindow(endsAtMs);
  const hourly = (await klines(symbol, '1h', { endTime: String(nowMs), limit: String(SIGMA_DAYS * 24 + 1) }, fetchImpl)).map((k) => Number(k[4]));
  const sigmaMin = sigmaPerMinute(hourly);
  const last = await klines(symbol, '1m', { endTime: String(nowMs), limit: '1' }, fetchImpl);
  const now = Number(last[0][4]);
  const start = nowMs >= startMs + 60000 ? await closeAt(symbol, startMs, fetchImpl) : null;
  const p = pUp({ start, now, sigmaMin, nowMs, startMs, endMs });
  return { symbol, p, sigmaMin, start, now, startMs, endMs, minutesLeft: Math.round((endMs - nowMs) / 60000), phase: start == null ? 'before start' : 'running' };
}
