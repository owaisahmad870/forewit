import { useContext, useEffect, useRef, useState } from 'react';
import { LangContext, initialLang, translate, useT, type Lang } from './i18n';
import { loadData, type Dataset } from './lib/data';
import { fmtUtc } from './lib/format';
import { Home } from './pages/Home';
import { RoundPage, Rounds } from './pages/Round';
import { MyResults } from './pages/MyResults';
import { Leaderboard } from './pages/Leaderboard';
import { Crowd, DocPage, DocsIndex, Profile } from './pages/Static';
import { Proof } from './pages/Proof';
import { Start } from './pages/Start';
import { RoundBanner } from './components';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

const NAV = [
  ['', 'nav.home'],
  ['start', 'nav.start'],
  ['rounds', 'nav.rounds'],
  ['leaderboard', 'nav.leaderboard'],
  ['me', 'nav.me'],
  ['crowd', 'nav.crowd'],
  ['docs', 'nav.docs'],
  ['proof', 'nav.proof'],
] as const;

const MARK = (
  /* Same mark as public/favicon.svg: a forecast on the 0 to 1 probability scale. */
  <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16h24M4 12.5v7M28 12.5v7" className="stroke-muted" strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M13 9.5l6.5 6.5-6.5 6.5-6.5-6.5z" className="fill-accent" /></svg>
);

/** Side navigation from 60rem; under it a top bar whose menu opens the same list. */
function Sidebar({ route, theme, setTheme }: { route: string[]; theme: string; setTheme: (t: string) => void }) {
  const { t, lang } = useT();
  const { setLang } = useContext(LangContext);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [route]);
  const current = route[0] === 'round' ? 'rounds' : route[0] ?? '';
  const links = (
    <ul className="space-y-0.5">
      {NAV.map(([path, key]) => (
        <li key={path}>
          <a href={`#/${path}`} aria-current={current === path ? 'page' : undefined} className={`flex min-h-10 items-center rounded-lg px-3 text-[0.95rem] ${current === path ? 'bg-surface-2 font-semibold text-ink shadow-[inset_2px_0_0_var(--accent)]' : 'text-muted hover:bg-surface hover:text-ink'}`}>{t(key)}</a>
        </li>
      ))}
    </ul>
  );
  const btn = 'min-h-10 rounded-lg border border-line px-3 text-sm text-muted hover:border-accent hover:text-ink';
  const toggles = (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn} lang={lang === 'en' ? 'zh' : 'en'} title={t('ui.otherLangName')} onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{t('ui.otherLang')}</button>
      <button type="button" className={btn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? t('ui.toLight') : t('ui.toDark')}</button>
    </div>
  );
  const brand = (
    <a href="#/" className="flex min-h-11 items-center gap-2 font-semibold">
      {MARK}
      {t('brand')}
      {t('brandLocal') && <span lang="zh-CN" className="font-normal text-muted">{t('brandLocal')}</span>}
    </a>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-bg px-3 py-4 min-[60rem]:flex">
        <div className="px-2">{brand}</div>
        <nav aria-label={t('nav.main')} className="flex-1">{links}</nav>
        <div className="px-2">{toggles}</div>
      </aside>
      <header className="border-b border-line min-[60rem]:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">{brand}{toggles}</div>
        <details ref={menu} className="border-t border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm">{t('nav.menu')}</summary>
          <nav aria-label={t('nav.main')} className="px-2 pb-2">{links}</nav>
        </details>
      </header>
    </>
  );
}

function RiskBanner() {
  const { t } = useT();
  const [seen, setSeen] = useState(() => store.get('riskSeen') === '1');
  if (seen) return null;
  return (
    <div role="region" aria-label={t('docs.pages.risk.title')} className="border-b border-accent bg-surface-2">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p lang="en" className="font-semibold">{t('risk')}</p>
          {t('riskLocal') && <p className="mt-1">{t('riskLocal')}</p>}
        </div>
        <button type="button" className="min-h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink" onClick={() => { store.set('riskSeen', '1'); setSeen(true); }}>{t('ui.dismiss')}</button>
      </div>
    </div>
  );
}

function Footer({ data }: { data: Dataset | null }) {
  const { t, lang } = useT();
  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 text-sm sm:px-8">
        <p lang="en" className="font-semibold">{t('risk')}</p>
        {t('riskLocal') && <p>{t('riskLocal')}</p>}
        {data && (
          <div className="rounded-lg border border-line p-3 text-muted">
            {data.manifest.sample && <p className="font-semibold text-ink">{t('ui.sampleData')}</p>}
            <p>{t('ui.builtAt', { date: fmtUtc(new Date(data.snapshot.builtAt), lang) })}</p>
            <p>{t('ui.network', { id: data.snapshot.network })}</p>
          </div>
        )}
        <p className="flex flex-wrap gap-x-4">
          <a href="#/docs/risk" className="inline-flex min-h-11 items-center text-accent">{t('docs.pages.risk.title')}</a>
          <a href="#/docs/owner" className="inline-flex min-h-11 items-center text-accent">{t('docs.pages.owner.title')}</a>
          <a href="#/profile" className="inline-flex min-h-11 items-center text-accent">{t('profile.title')}</a>
          <a href="https://forewit.xyz/" className="inline-flex min-h-11 items-center text-accent">forewit.xyz</a>
          <a href="https://x.com/forewitai" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent">{t('ui.onX')}</a>
        </p>
      </div>
    </footer>
  );
}

function Page({ route, data, error }: { route: string[]; data: Dataset | null; error: boolean }) {
  const { t } = useT();
  const [head, arg] = route;
  if (head === 'play') return <Start />; // old How to play page: Start covers it
  if (head === 'start') return <Start />;
  if (head === 'docs') return arg ? <DocPage slug={arg} /> : <DocsIndex />;
  if (head === 'profile') return <Profile />;
  if (error) return <p className="text-muted">{t('ui.loadError')}</p>;
  if (!data) return <p className="text-muted">{t('ui.loading')}</p>;
  // the home page already shows the live commit countdown, so its banner shows reveal reminders only
  return <><RoundBanner rounds={data.rounds} showCommit={!!head} /><DataPage head={head} arg={arg} data={data} /></>;
}

function DataPage({ head, arg, data }: { head?: string; arg?: string; data: Dataset }) {
  const { t } = useT();
  if (!head) return <Home data={data} />;
  if (head === 'rounds') return <Rounds data={data} />;
  if (head === 'round') return <RoundPage data={data} id={Number(arg)} />;
  if (head === 'leaderboard') return <Leaderboard data={data} />;
  if (head === 'me') return <MyResults data={data} />;
  if (head === 'crowd') return <Crowd data={data} />;
  if (head === 'proof') return <Proof data={data} />;
  return <p className="text-muted">{t('ui.notFound')} <a href="#/" className="text-accent underline">{t('ui.backHome')}</a></p>;
}

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState(() => (store.get('theme') === 'light' ? 'light' : 'dark'));
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState(false);
  const route = useRoute();
  const chooseLang = (l: Lang) => { store.set('lang', l); setLang(l); };

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = [translate(lang, 'brand'), translate(lang, 'brandLocal')].filter(Boolean).join(' ');
  }, [lang]);
  useEffect(() => {
    if (theme === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    store.set('theme', theme);
  }, [theme]);
  useEffect(() => { loadData().then(setData, () => setError(true)); }, []);

  return (
    <LangContext.Provider value={{ lang, setLang: chooseLang }}>
      <a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-surface focus:p-2">{translate(lang, 'ui.skip')}</a>
      <div className="min-[60rem]:flex">
        <Sidebar route={route} theme={theme} setTheme={setTheme} />
        <div className="min-w-0 flex-1">
          <RiskBanner />
          <main id="main" tabIndex={-1} className="mx-auto min-h-svh max-w-5xl px-4 py-6 sm:px-8">
            <Page route={route} data={data} error={error} />
          </main>
          <Footer data={data} />
        </div>
      </div>
    </LangContext.Provider>
  );
}
