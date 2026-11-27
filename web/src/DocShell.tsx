import { useEffect, useState, type ReactNode } from 'react';
import { useT } from './i18n';

// Docs layout: breadcrumbs, the article, and a sticky "On this page" rail that follows the
// reader. Hash routes carry the page, so the rail scrolls to headings instead of linking to them.
export const DOC_NAV = [['start', '#/start', 'start.title'], ['how', '#/docs/how', 'docs.pages.how.title'], ['scoring', '#/docs/scoring', 'docs.pages.scoring.title'], ['paper', '#/docs/paper', 'docs.pages.paper.title'], ['owner', '#/docs/owner', 'docs.pages.owner.title'], ['risk', '#/docs/risk', 'docs.pages.risk.title'], ['faq', '#/docs/faq', 'docs.pages.faq.title']] as const;
const ISSUE_URL = 'https://github.com/owaisahmad870/forewit/issues/new';

export type TocItem = { id: string; label: string };

function useActive(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !ids.length) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = ids.find((id) => seen.get(id));
      if (first) setActive(first);
    }, { rootMargin: '0px 0px -65% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ids.join('|')]);
  return active;
}

const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function Toc({ items, active }: { items: TocItem[]; active?: string }) {
  const { t } = useT();
  return (
    <nav aria-label={t('ui.onThisPage')}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{t('ui.onThisPage')}</p>
      <ul className="space-y-0.5 text-sm">
        {items.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => go(x.id)} aria-current={active === x.id ? 'location' : undefined}
              className={`flex min-h-9 w-full items-center border-l-2 py-1 pl-3 text-left ${active === x.id ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
              {x.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DocShell({ current, title, lead, meta, toc, children, footer = true }: { current: string; title: string; lead?: ReactNode; meta?: ReactNode; toc: TocItem[]; children: ReactNode; footer?: boolean }) {
  const { t } = useT();
  const active = useActive(toc.map((x) => x.id));
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_13rem]">
      <article className="min-w-0">
        <nav aria-label={t('ui.breadcrumbs')} className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-3 text-sm text-muted backdrop-blur sm:-mx-8 sm:px-8">
          <ol className="flex flex-wrap items-center gap-x-2">
            <li><a href="#/" className="hover:text-ink hover:underline">{t('nav.home')}</a></li>
            <li aria-hidden="true">/</li>
            <li><a href="#/docs" className="hover:text-ink hover:underline">{t('docs.title')}</a></li>
            {current !== 'index' && <><li aria-hidden="true">/</li><li aria-current="page" className="text-ink">{title}</li></>}
          </ol>
        </nav>
        <header className="max-w-[72ch] border-b border-line pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {lead && <div className="mt-3 text-lg text-muted">{lead}</div>}
          {meta && <div className="mt-3 text-sm text-muted">{meta}</div>}
        </header>
        {toc.length > 1 && <div className="mt-6 lg:hidden"><Toc items={toc} /></div>}
        <div className="doc mt-8 max-w-[72ch]">{children}</div>
        {footer && (
          <footer className="mt-12 flex max-w-[72ch] flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
            <a href={`${ISSUE_URL}?title=${encodeURIComponent(`Docs: ${title}`)}`} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">{t('ui.suggest')}</a>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 font-semibold hover:border-accent">{t('ui.backToTop')} <span aria-hidden="true">↑</span></button>
          </footer>
        )}
      </article>
      {toc.length > 1 && <aside className="hidden lg:block"><div className="sticky top-16"><Toc items={toc} active={active} /></div></aside>}
    </div>
  );
}

// Procedure list: numbered badges, generous spacing, content of any shape inside each step
export function Steps({ children }: { children: ReactNode[] }) {
  return (
    <ol className="space-y-6">
      {children.map((c, i) => (
        <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-semibold tabular-nums">{i + 1}</span>
          <div className="pt-0.5">{c}</div>
        </li>
      ))}
    </ol>
  );
}

export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-16 pt-10 first:pt-0">
      <h2 id={`${id}-t`} className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
