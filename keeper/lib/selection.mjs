// Selection rule v3 (docs/QUESTION_SELECTION.md, pre registered 23 Nov 2026). Pure, unit tested in keeper/test/selection.test.mjs.
export const RULE = 'QUESTION_SELECTION v3';
export const CAP_MS = Date.parse('2026-12-08T00:00:00Z'); // daily rounds only
export const LONG_MAX_HOURS = 100 * 24; // long horizon: end within 100 days, so the 120 day resolution wait covers it
export const MIN_ROUND = 3, MAX_ROUND = 8, MIN_VOLUME_USD = 100, MAX_SPREAD = 0.1;

export const isSports = (m) => /^E?SPORTS_/.test(m.marketVariant ?? '');
export const isCryptoUpDown = (m) => m.marketVariant === 'CRYPTO_UP_DOWN' || m.marketVariant === 'UP_DOWN';
export const isDailyCrypto = (m) => isCryptoUpDown(m) && /Up or Down on /.test(m.title ?? '');
export function isBinary(m) {
  const [a, b] = m.outcomes ?? [];
  return m.outcomes?.length === 2 && a.indexSet === 1 && b.indexSet === 2 && /^(Yes|Up)$/.test(a.name) && /^(No|Down)$/.test(b.name);
}
export function isLiquid(m, minVol = MIN_VOLUME_USD) {
  const a = m.outcomes[0];
  return Boolean(a.bestBid && a.bestAsk) && a.bestAsk.price - a.bestBid.price <= MAX_SPREAD && (m.stats?.volume24hUsd ?? 0) >= minVol;
}

/** Cheap check before fetching the category (the end time), to stay inside the API rate limit. */
export function prefilter(m, kind) {
  if (!isBinary(m) || isSports(m)) return false;
  if (kind === 'daily') return isDailyCrypto(m) || (!isCryptoUpDown(m) && isLiquid(m));
  return !isCryptoUpDown(m) && isLiquid(m);
}

/** Full rule given the category endsAt (ms) and the round's commit deadline (ms). */
export function eligible(m, endMs, deadlineMs, kind) {
  if (!prefilter(m, kind) || !Number.isFinite(endMs)) return false;
  const h = (endMs - deadlineMs) / 3.6e6;
  if (kind === 'daily') return h >= 6 && h <= 72 && endMs <= CAP_MS;
  if (kind === 'long') return h > 72 && h <= LONG_MAX_HOURS;
  throw new Error(`unknown round kind ${kind}`);
}
