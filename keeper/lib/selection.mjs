// Selection rule v3.1 (docs/QUESTION_SELECTION.md, pre registered 23 Nov 2026). Pure, unit tested in keeper/test/selection.test.mjs.
export const RULE = 'QUESTION_SELECTION v3.1';
export const CAP_MS = Date.parse('2026-12-08T00:00:00Z'); // daily rounds only
export const LONG_MAX_HOURS = 100 * 24; // long horizon: end within 100 days (approved), the 120 day wait covers the oracle step
export const MIN_ROUND = 3, MAX_ROUND = 8, MIN_VOLUME_USD = 100, MAX_SPREAD = 0.1;

// Long horizon allowlist by category tag (Owais, 23 Nov 2026): macro and central banks, crypto and finance, tech and AI, science and weather.
export const LONG_ALLOWED_TAGS = new Set(['Economy', 'Fed', 'Crypto', 'Finance', 'Stocks', 'Commodities', 'Market Cap', 'IPO', 'Pre-IPO', 'BTC', 'ETH', 'BNB', 'Tech', 'AI', 'Anthropic', 'Science', 'Weather']);
const MACRO = new Set(['Economy', 'Fed']);
const tagNames = (cat) => (cat?.tags ?? []).map((t) => t?.name ?? t);

export const isSports = (m, cat) => /^E?SPORTS_/.test(m.marketVariant ?? '') || tagNames(cat).some((t) => t === 'Sports' || t === 'Esports');
/** Politics excluded in every round (v3.1). A Politics tag next to Economy or Fed is a macro market and stays. */
export function isPolitics(cat) {
  const t = tagNames(cat);
  if (t.includes('Elections') || t.includes('Trump')) return true;
  return t.includes('Politics') && !t.some((x) => MACRO.has(x));
}
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

/** Cheap market only check before fetching the category (rate limit). Category rules are applied in eligible(). */
export function prefilter(m, kind) {
  if (!isBinary(m) || isSports(m)) return false;
  if (kind === 'daily') return isDailyCrypto(m) || (!isCryptoUpDown(m) && isLiquid(m));
  return !isCryptoUpDown(m) && isLiquid(m);
}

/** Full rule. cat is the market's category (endsAt, tags); deadlineMs the round's commit deadline. */
export function eligible(m, cat, deadlineMs, kind) {
  if (!prefilter(m, kind) || !cat) return false;
  if (isSports(m, cat) || isPolitics(cat)) return false;
  const endMs = Date.parse(cat.endsAt ?? '');
  if (!Number.isFinite(endMs)) return false;
  const h = (endMs - deadlineMs) / 3.6e6;
  if (kind === 'daily') return h >= 6 && h <= 72 && endMs <= CAP_MS;
  if (kind === 'long') return h > 72 && h <= LONG_MAX_HOURS && tagNames(cat).some((t) => LONG_ALLOWED_TAGS.has(t));
  throw new Error(`unknown round kind ${kind}`);
}
