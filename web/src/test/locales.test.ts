import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

const RISK = 'Forecasting scores only. Not financial advice. PRESCIENT does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.';

const keys = (o: unknown, p = ''): string[] =>
  o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => [`${p}${k}`, ...keys(v, `${p}${k}.`)]) : [];
const strings = (o: unknown): string[] => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : []);

describe.each([['en', en], ['zh', zh]] as const)('locale %s', (_, dict) => {
  it('has the mandatory risk text verbatim', () => expect(dict.risk).toBe(RISK));
  it('uses no hyphen or dash characters', () => {
    for (const s of strings(dict)) expect(s, s).not.toMatch(/[-‐-―⸺⸻﹘﹣－]/);
  });
  it('never uses hype words', () => {
    for (const s of strings(dict)) expect(s, s).not.toMatch(/\b(win|wins|winning|winner|earn|earns|earning|earnings|profit|profits|profitable|passive income)\b|赚钱|收益|盈利|被动收入/i);
  });
  it('names no product with Binance or BNB', () => expect(dict.brand).not.toMatch(/binance|bnb/i));
});

describe('locale parity', () => {
  it('en and zh have the same keys', () => expect(keys(zh).sort()).toEqual(keys(en).sort()));
});
