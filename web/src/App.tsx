import { STEPS_PATH, WORD_PATH, WORD_VIEWBOX } from './brandMark';
import { useContext, useEffect, useRef, useState } from 'react';
import { LangContext, initialLang, translate, useT, type Lang } from './i18n';
import { loadData, type Dataset } from './lib/data';
import { fmtUtc } from './lib/format';
import { Home } from './pages/Home';
import { RoundPage, Rounds } from './pages/Round';
import { MyResults } from './pages/MyResults';
import { Leaderboard } from './pages/Leaderboard';
import { Crowd, DOC_SLUGS, DocPage, DocsIndex } from './pages/Static';
import { ProfilePage, Profiles } from './pages/Profile';
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
  ['profile', 'nav.profiles'],
  ['me', 'nav.me'],
  ['crowd', 'nav.crowd'],
  ['docs', 'nav.docs'],
  ['proof', 'nav.proof'],
] as const;

const X_URL = 'https://x.com/Forewitai';
const icon = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
const SUN = <svg {...icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
const MOON = <svg {...icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;
const X_ICON = <svg {...icon} fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z" /></svg>;

const MARK = (
  /* The Forewit wordmark (scripts/brand/build.py): the i dot climbs as three steps. */
  <svg viewBox={WORD_VIEWBOX} className="h-6 w-auto" aria-hidden="true"><path d={WORD_PATH} className="fill-ink" /><path d={STEPS_PATH} className="fill-accent" /></svg>
);

/** Side navigation from 60rem; under it a top bar whose menu opens the same list. */
function Sidebar({ route, theme, setTheme }: { route: string[]; theme: string; setTheme: (t: string) => void }) {
  const { t, lang } = useT();
  const { setLang } = useContext(LangContext);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (menu.current) menu.current.open = false; }, [route]);
  const current = route[0] === 'round' ? 'rounds' : route[0] ?? '';
  // Docs opens as a dropdown in this same list (no second sidebar); it starts open on any docs page
  const [docsOpen, setDocsOpen] = useState(current === 'docs');
  useEffect(() => { if (current === 'docs') setDocsOpen(true); }, [current]);
  const item = (on: boolean) => `flex min-h-10 items-center rounded-lg px-3 text-[0.95rem] ${on ? 'bg-surface-2 font-semibold text-ink shadow-[inset_2px_0_0_var(--accent)]' : 'text-muted hover:bg-surface hover:text-ink'}`;
  const links = (
    <ul className="space-y-0.5">
      {NAV.map(([path, key]) => path !== 'docs' ? (
        <li key={path}>
          <a href={`#/${path}`} aria-current={current === path ? 'page' : undefined} className={item(current === path)}>{t(key)}</a>
        </li>
      ) : (
        <li key={path}>
          <div className={`${item(current === 'docs' && !route[1])} gap-1 pr-1`}>
            <a href="#/docs" aria-current={current === 'docs' && !route[1] ? 'page' : undefined} className="flex min-h-10 items-center">{t(key)}</a>
            <button type="button" aria-expanded={docsOpen} aria-controls="nav-docs" aria-label={t(docsOpen ? 'nav.collapse' : 'nav.expand')} onClick={() => setDocsOpen((x) => !x)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2 hover:text-ink">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className={`transition-transform ${docsOpen ? 'rotate-90' : ''}`}><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          {docsOpen && (
            <ul id="nav-docs" className="mt-0.5 ml-3 space-y-0.5 border-l border-line pl-2">
              {DOC_SLUGS.map((slug) => (
                <li key={slug}>
                  <a href={`#/docs/${slug}`} aria-current={current === 'docs' && route[1] === slug ? 'page' : undefined} className={`flex min-h-9 items-center rounded-md px-3 text-sm ${current === 'docs' && route[1] === slug ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:bg-surface hover:text-ink'}`}>{t(`docs.pages.${slug}.title`)}</a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
  const btn = 'min-h-10 rounded-lg border border-line px-3 text-sm text-muted hover:border-accent hover:text-ink';
  const toggles = (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn} lang={lang === 'en' ? 'zh' : 'en'} title={t('ui.otherLangName')} onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>{t('ui.otherLang')}</button>
      <button type="button" className={`${btn} flex w-10 items-center justify-center px-0`} aria-label={theme === 'dark' ? t('ui.toLight') : t('ui.toDark')} title={theme === 'dark' ? t('ui.toLight') : t('ui.toDark')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? SUN : MOON}</button>
    </div>
  );
  const social = (
    <a href={X_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-[0.95rem] text-muted hover:bg-surface hover:text-ink">{X_ICON}<span>@Forewitai</span><span className="sr-only">{t('nav.x')}</span></a>
  );
  const brand = (
    <a href="#/" className="flex min-h-11 items-center gap-2 font-semibold">
      {MARK}
      <span className="sr-only">{t('brand')}</span>
      {t('brandLocal') && <span lang="zh-CN" className="font-normal text-muted">{t('brandLocal')}</span>}
    </a>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-bg px-3 py-4 min-[60rem]:flex">
        <div className="px-2">{brand}</div>
        <nav aria-label={t('nav.main')} className="flex-1">{links}</nav>
        <div className="space-y-2 border-t border-line pt-3">{social}<div className="px-2">{toggles}</div></div>
      </aside>
      <header className="border-b border-line min-[60rem]:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">{brand}{toggles}</div>
        <details ref={menu} className="border-t border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm">{t('nav.menu')}</summary>
          <nav aria-label={t('nav.main')} className="px-2 pb-2">{links}<div className="mt-3 border-t border-line pt-2">{social}</div></nav>
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
      <div className="flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-8 sm:flex-row sm:items-center sm:justify-between">
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
  const link = 'inline-flex min-h-9 items-center text-accent hover:underline underline-offset-4';
  return (
    <footer className="mt-10 border-t border-line">
      <div className="grid gap-8 px-4 py-8 text-sm sm:px-8 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="max-w-[72ch] space-y-3">
          <p lang="en" className="font-semibold">{t('risk')}</p>
          {t('riskLocal') && <p>{t('riskLocal')}</p>}
          {data && (
            <div className="rounded-lg border border-line p-3 text-muted">
              {data.manifest.sample && <p className="font-semibold text-ink">{t('ui.sampleData')}</p>}
              <p>{t('ui.builtAt', { date: fmtUtc(new Date(data.snapshot.builtAt), lang) })}</p>
              <p>{t('ui.network', { id: data.snapshot.network })}</p>
            </div>
          )}
        </div>
        <nav aria-label={t('ui.footerNav')} className="grid grid-cols-2 content-start gap-x-6 md:grid-cols-1">
          <a href="#/docs/risk" className={link}>{t('docs.pages.risk.title')}</a>
          <a href="#/docs/owner" className={link}>{t('docs.pages.owner.title')}</a>
          <a href="#/docs/privacy" className={link}>{t('docs.pages.privacy.title')}</a>
          <a href="#/docs/terms" className={link}>{t('docs.pages.terms.title')}</a>
          <a href="https://github.com/owaisahmad870/forewit" rel="noopener noreferrer" className={link}>{t('ui.source')}</a>
          <a href="https://x.com/forewitai" rel="noopener noreferrer" className={link}>{t('ui.onX')}</a>
        </nav>
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
  if (head === 'profile') return arg ? <ProfilePage data={data} addr={arg} /> : <Profiles data={data} />;
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
  useEffect(() => {
    // refresh while the tab stays open (the data is rebuilt from the chain every 20 minutes); a failed refresh keeps the last data
    let first = true;
    const get = () => loadData().then((d) => { setData(d); setError(false); }, () => { if (first) setError(true); }).finally(() => { first = false; });
    get();
    const id = setInterval(get, 5 * 60000);
    const onShow = () => { if (document.visibilityState === 'visible') get(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onShow); };
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang: chooseLang }}>
      <a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded focus:bg-surface focus:p-2">{translate(lang, 'ui.skip')}</a>
      <div className="min-[60rem]:flex">
        <Sidebar route={route} theme={theme} setTheme={setTheme} />
        <div className="min-w-0 flex-1">
          <RiskBanner />
          <main id="main" tabIndex={-1} className={`min-h-svh px-4 py-6 sm:px-8 ${route[0] === 'docs' || route[0] === 'start' || route[0] === 'play' ? 'max-w-7xl' : 'max-w-5xl'}`}>
            <Page route={route} data={data} error={error} />
          </main>
          <Footer data={data} />
        </div>
      </div>
    </LangContext.Provider>
  );
}
