import { createContext, useContext } from 'react';
import en from './locales/en.json';
import zh from './locales/zh.json';

export type Lang = 'en' | 'zh';
export const DICTS: Record<Lang, unknown> = { en, zh };

export function lookup(lang: Lang, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), DICTS[lang]);
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const v = lookup(lang, key);
  const s = typeof v === 'string' ? v : key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });

export function useT() {
  const { lang } = useContext(LangContext);
  return {
    lang,
    t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    raw: <T,>(key: string) => lookup(lang, key) as T,
  };
}

export function initialLang(): Lang {
  try {
    const s = localStorage.getItem('lang');
    if (s === 'en' || s === 'zh') return s;
  } catch { /* storage blocked */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
