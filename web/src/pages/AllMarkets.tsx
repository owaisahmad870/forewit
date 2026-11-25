import { useEffect, useState } from 'react';
import { CopyBlock } from '../components';
import { useT } from '../i18n';
import { MARKET_SEARCH } from '../commands';

type View = { fetchedAt: string; total: number; groups: Record<string, { count: number; why: string }> };
const GROUPS = ['other', 'crypto_daily', 'crypto_short', 'sports', 'esports', 'tweets'] as const;
const KEY = 'forewit.extended';
const on0 = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

// Market groups: how many Predict.fun markets are open per group and why each group is or is not in a Forewit round.
// Counts only: Predict.fun's terms forbid redistributing their data, so users browse markets with their own key.
export function AllMarkets() {
  const { t } = useT();
  const [on, setOn] = useState(on0);
  const [view, setView] = useState<View | null>(null);
  useEffect(() => {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (on && !view) fetch(`${import.meta.env.BASE_URL}data/markets.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then(setView, () => setView(null));
  }, [on, view]);
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
          <ul className="mt-2 divide-y divide-line text-sm">
            {GROUPS.map((k) => (
              <li key={k} className="py-2">
                <span className="font-semibold">{t(`markets.g.${k}`)} ({view.groups[k]?.count.toLocaleString() ?? 0})</span>
                <span className="block text-muted">{t('markets.status')} {t(`markets.why.${k}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">{t('markets.note', { t: new Date(view.fetchedAt).toISOString().slice(0, 16).replace('T', ' ') })}</p>
        </>
      )}
      {on && (
        <>
          <p className="mt-3 max-w-[68ch] text-sm">{t('markets.browse')}</p>
          <CopyBlock text={MARKET_SEARCH} />
        </>
      )}
    </section>
  );
}
