import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normCdf, pUp, sigmaPerMinute, noonEt, dailyWindow, symbolOf, P_MAX, P_MIN } from '../lib/baseline.mjs';

test('normCdf matches known values', () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-9);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(normCdf(-1) - 0.158655) < 1e-5);
});

test('pUp is 0.5 before start and at the start price, symmetric, clamped', () => {
  const w = { startMs: 0, endMs: 1440 * 60000, sigmaMin: 0.0005 };
  assert.equal(pUp({ ...w, start: null, now: 100, nowMs: -1 }), 0.5);
  assert.equal(pUp({ ...w, start: 100, now: 100, nowMs: 60000 }), 0.5);
  const up = pUp({ ...w, start: 100, now: 101, nowMs: 360 * 60000 }), down = pUp({ ...w, start: 100, now: 100 / 1.01, nowMs: 360 * 60000 });
  assert.ok(up > 0.5 && Math.abs(up + down - 1) < 1e-9);
  assert.equal(pUp({ ...w, start: 100, now: 150, nowMs: 1439 * 60000 }), P_MAX);
  assert.equal(pUp({ ...w, start: 100, now: 50, nowMs: 1439 * 60000 }), P_MIN);
  assert.throws(() => pUp({ ...w, start: 100, now: 100, nowMs: w.endMs }));
});

test('calibrated on a synthetic random walk (seeded)', () => {
  let s = 42; // mulberry32
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const sig = 0.0006, bins = Array.from({ length: 5 }, () => ({ n: 0, p: 0, y: 0 }));
  for (let k = 0; k < 4000; k++) {
    let x = 0; const steps = 1440, at = 360;
    let xAt = 0;
    for (let i = 0; i < steps; i++) { x += sig * gauss(); if (i === at - 1) xAt = x; }
    const p = pUp({ start: 1, now: Math.exp(xAt), sigmaMin: sig, nowMs: at * 60000, startMs: 0, endMs: steps * 60000 });
    const b = bins[Math.min(4, Math.floor(p * 5))]; b.n++; b.p += p; b.y += x > 0 ? 1 : 0;
  }
  for (const b of bins) if (b.n > 200) assert.ok(Math.abs(b.p / b.n - b.y / b.n) < 0.05, `bin off: ${b.p / b.n} vs ${b.y / b.n}`);
});

test('sigmaPerMinute needs a day of hours and scales hourly variance', () => {
  assert.throws(() => sigmaPerMinute([1, 2, 3]));
  const closes = Array.from({ length: 49 }, (_, i) => 100 * Math.exp((i % 2 ? 1 : -1) * 0.006));
  assert.ok(Math.abs(sigmaPerMinute(closes) - (0.012 * Math.sqrt(48 / 47)) / Math.sqrt(60)) < 1e-4);
});

test('noon ET follows daylight saving and the daily window is noon to noon', () => {
  assert.equal(new Date(noonEt(2026, 11, 27)).toISOString(), '2026-11-27T17:00:00.000Z');
  assert.equal(new Date(noonEt(2026, 7, 1)).toISOString(), '2026-07-01T16:00:00.000Z');
  const w = dailyWindow(Date.parse('2026-11-27T17:00:00Z'));
  assert.equal(new Date(w.startMs).toISOString(), '2026-11-26T17:00:00.000Z');
  assert.equal(new Date(w.endMs).toISOString(), '2026-11-27T17:00:00.000Z');
});

test('symbolOf reads crypto Up or Down titles only', () => {
  assert.equal(symbolOf('Bitcoin Up or Down on November 27?'), 'BTCUSDT');
  assert.equal(symbolOf('BNB Up or Down on November 27?'), 'BNBUSDT');
  assert.equal(symbolOf('Highest temperature in Tokyo on November 25?'), null);
});
