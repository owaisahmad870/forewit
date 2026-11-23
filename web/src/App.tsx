import { useContext, useEffect, useRef, useState } from 'react';
import { LangContext, initialLang, translate, useT, type Lang } from './i18n';
import { loadData, type Dataset } from './lib/data';
import { fmtUtc } from './lib/format';
import { Home } from './pages/Home';
import { RoundPage, Rounds } from './pages/Round';
import { Leaderboard } from './pages/Leaderboard';
import { Crowd, DocPage, DocsIndex, Play, Profile } from './pages/Static';

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
  ['rounds', 'nav.rounds'],
  ['leaderboard', 'nav.leaderboard'],
  ['crowd', 'nav.crowd'],
  ['play', 'nav.play'],
  ['docs', 'nav.docs'],
] as const;

function Header({ route, theme, setTheme }: { route: string[]; theme: string; setTheme: (t: string) => void }) {
  const { t, lang } = useT();
  const { setLang } = useContext(LangContext);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [route]);
  const current = route[0] === 'round' ? 'rounds' : route[0] ?? '';
  const links = NAV.map(([path, key]) => (
    <a key={path} href={`#/${path}`} aria-current={current === path ? 'page' : undefined} className={`flex min-h-11 items-center rounded-md px-3 ${current === path ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}>{t(key)}</a>
  ));
  const btn = 'min-h-11 min-w-11 rounded-md border border-line px-3 text-sm hover:border-accent';
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        <a href="#/" className="flex min-h-11 items-center gap-2 font-semibold tracking-wide">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><line x1="2" y1="11" x2="20" y2="11" className="stroke-muted" strokeWidth="1.5" /><rect x="5" y="7" width="8" height="8" rx="1" transform="rotate(45 9 11)" className="fill-accent" /></svg>
          {t('brand')}
        </a>
        <nav aria-label={t('nav.main')} className="hidden items-center md:flex">{links}</nav>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} lang={lang === 'en' ? 'zh' : 'en'} title={t('ui.otherLangName')} onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{t('ui.otherLang')}</button>
          <button type="button" className={btn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? t('ui.toLight') : t('ui.toDark')}</button>
        </div>
      </div>
      <details ref={menu} className="border-t border-line md:hidden">
        <summary className="mx-auto flex min-h-11 max-w-5xl cursor-pointer items-center px-4 text-sm">{t('nav.menu')}</summary>
        <nav aria-label={t('nav.main')} className="mx-auto grid max-w-5xl grid-cols-2 px-2 pb-2">{links}</nav>
      </details>
    </header>
  );
}

function RiskBanner() {
  const { t } = useT();
  const [seen, setSeen] = useState(() => store.get('riskSeen') === '1');
  if (seen) return null;
  return (
    <div role="region" aria-label={t('docs.pages.risk.title')} className="border-b border-accent bg-surface-2">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 text-sm">
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
        </p>
      </div>
    </footer>
  );
}

function Page({ route, data, error }: { route: string[]; data: Dataset | null; error: boolean }) {
  const { t } = useT();
  const [head, arg] = route;
  if (head === 'play') return <Play />;
  if (head === 'docs') return arg ? <DocPage slug={arg} /> : <DocsIndex />;
  if (head === 'profile') return <Profile />;
  if (error) return <p className="text-muted">{t('ui.loadError')}</p>;
  if (!data) return <p className="text-muted">{t('ui.loading')}</p>;
  if (!head) return <Home data={data} />;
  if (head === 'rounds') return <Rounds data={data} />;
  if (head === 'round') return <RoundPage data={data} id={Number(arg)} />;
  if (head === 'leaderboard') return <Leaderboard data={data} />;
  if (head === 'crowd') return <Crowd data={data} />;
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
    document.title = translate(lang, 'brand');
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
      <RiskBanner />
      <Header route={route} theme={theme} setTheme={setTheme} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-5">
        <Page route={route} data={data} error={error} />
      </main>
      <Footer data={data} />
    </LangContext.Provider>
  );
}
