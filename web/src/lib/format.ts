import type { Lang } from '../i18n';

const loc = (lang: Lang) => (lang === 'zh' ? 'zh-CN' : 'en-GB');
const MINUS = '−';

export const fmtBrier = (x: number | null) => (x == null ? '' : x.toFixed(3));
// skill in points (Brier x 100, the unit My results and the plan use)
export const fmtSkill = (x: number | null) => (x == null ? '' : `${x > 0 ? '+' : x < 0 ? MINUS : ''}${(Math.abs(x) * 100).toFixed(2)} pts`);
export const fmtPct = (bps: number | null) => (bps == null ? '' : `${Math.round(bps / 100)}%`);
export const fmtShare = (x: number | null) => (x == null ? '' : `${Math.round(x * 100)}%`);

export function fmtUtc(d: Date, lang: Lang) {
  return new Intl.DateTimeFormat(loc(lang), { timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) + ' UTC';
}
export function fmtLocal(d: Date, lang: Lang) {
  return new Intl.DateTimeFormat(loc(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).format(d);
}

export function fmtCountdown(ms: number, dayUnit = 'd') {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, '0')).join(':');
  return d ? `${d}${dayUnit} ${hms}` : hms;
}
