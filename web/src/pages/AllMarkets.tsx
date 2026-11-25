import { useEffect, useState } from 'react';
import { Badge } from '../components';
import { useT } from '../i18n';

type M = { id: string; title: string; question: string; category: string | null; yesPct: number | null; vol24hUsd: number; inRound: boolean };
type View = { fetchedAt: string; total: number; groups: Record<string, { count: number; why: string; top: M[] }> };
const GROUPS = ['other', 'crypto_daily', 'crypto_short', 'sports', 'esports', 'tweets'] as const;
const KEY = 'forewit.extended';
const on0 = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

// Extended view: every open Predict.fun market, grouped, with why each group is or is not in a Forewit round.
// Market text is third party: rendered only as React text nodes.
export function AllMarkets() {
  const { t } = useT();
  const [on, setOn] = useState(on0);
  const [view, setView] = useState<View | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('other');
  const [q, setQ] = useState('');
  useEffect(() => {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (on && !view) fetch(`${import.meta.env.BASE_URL}data/markets.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then(setView, () => setView(null));
  }, [on, view]);
  const g = view?.groups[group];
  const list = (g?.top ?? []).filter((m) => !q || `${m.title} ${m.question}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section aria-labelledby="all-h" className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="all-h" className="font-semibold">{t('markets.title')}</h2>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          {t('markets.toggle')}
        </label>
      </div>
      <p className="max-w-[68ch] text-sm text-muted">{t('markets.intro')}</p>
      {on && !view && <p className="mt-2 text-sm text-muted">{t('ui.loading')}</p>}
      {on && view && (
        <>
          <p className="mt-2 text-sm">{t('markets.total', { n: view.total.toLocaleString() })}</p>
          <div role="tablist" className="mt-2 flex flex-wrap gap-2">
            {GROUPS.map((k) => (
              <button key={k} role="tab" aria-selected={group === k} onClick={() => setGroup(k)}
                className={`min-h-11 rounded-md border px-3 text-sm ${group === k ? 'border-accent text-accent' : 'border-line'}`}>
                {t(`markets.g.${k}`)} ({view.groups[k]?.count.toLocaleString() ?? 0})
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm"><span className="font-semibold">{t('markets.status')}</span> {t(`markets.why.${group}`)}</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('markets.search')} aria-label={t('markets.search')} className="mt-2 min-h-11 w-full rounded-md border border-line bg-bg px-3 text-sm" />
          <ul className="mt-2 divide-y divide-line text-sm">
            {list.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">{m.question || m.title}</span>
                <span className="flex items-center gap-2 text-muted">
                  {m.yesPct !== null && <span>{t('markets.yes', { p: m.yesPct })}</span>}
                  {m.inRound && <Badge tone="accent">{t('markets.inRound')}</Badge>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t('markets.note', { t: new Date(view.fetchedAt).toISOString().slice(0, 16).replace('T', ' ') })}</p>
        </>
      )}
    </section>
  );
}
