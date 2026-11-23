import { Blocks, Card } from '../components';
import { useT } from '../i18n';
import { crowdVsMarket, type Dataset } from '../lib/data';
import { fmtBrier } from '../lib/format';
import { Headline } from './Home';

type Block = Parameters<typeof Blocks>[0]['blocks'][number];
export const DOC_SLUGS = ['how', 'scoring', 'selection', 'owner', 'security', 'agents', 'prior', 'risk', 'faq'] as const;

export function DocsIndex() {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('docs.title')}</h1>
      <p className="text-muted">{t('docs.intro')}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        <li><a href="#/play" className="flex min-h-11 items-center rounded-xl border border-line bg-surface p-4 font-semibold hover:border-accent">{t('play.title')}</a></li>
        {DOC_SLUGS.map((s) => (
          <li key={s}><a href={`#/docs/${s}`} className="flex min-h-11 items-center rounded-xl border border-line bg-surface p-4 font-semibold hover:border-accent">{t(`docs.pages.${s}.title`)}</a></li>
        ))}
      </ul>
    </div>
  );
}

export function DocPage({ slug }: { slug: string }) {
  const { t, raw } = useT();
  const blocks = raw<Block[] | undefined>(`docs.pages.${slug}.blocks`);
  if (!blocks) return <p className="text-muted">{t('ui.notFound')}</p>;
  return (
    <article className="space-y-4">
      <a href="#/docs" className="inline-flex min-h-11 items-center text-sm text-accent">{t('docs.title')}</a>
      <h1 className="text-2xl font-semibold">{t(`docs.pages.${slug}.title`)}</h1>
      <Blocks blocks={blocks} />
    </article>
  );
}

export function Play() {
  const { t, raw } = useT();
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('play.title')}</h1>
      <Blocks blocks={raw<Block[]>('play.blocks')} />
    </article>
  );
}

export function Profile() {
  const { t, raw } = useT();
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
      <Blocks blocks={raw<string[]>('profile.body')} />
    </article>
  );
}

export function Crowd({ data }: { data: Dataset }) {
  const { t, raw } = useT();
  const rows = data.rounds
    .map((r) => ({ id: r.id, ...crowdVsMarket([r]) }))
    .filter((r): r is { id: number; crowd: number; market: number; n: number } => r.n > 0);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('crowd.title')}</h1>
      <p className="max-w-[68ch]">{t('crowd.intro')}</p>
      <Headline data={data} />
      <Card>
        <h2 className="text-lg font-semibold">{t('crowd.methodTitle')}</h2>
        <div className="mt-3"><Blocks blocks={[{ list: raw<string[]>('crowd.method') }]} /></div>
        <p className="mt-3 text-sm text-muted">{t('crowd.honesty')}</p>
      </Card>
      <h2 className="pt-2 text-lg font-semibold">{t('crowd.perRound')}</h2>
      {!rows.length ? <p className="text-muted">{t('crowd.none')}</p> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr>
              <th className="px-3 py-2 font-normal">{t('crowd.round')}</th>
              <th className="px-3 py-2 text-right font-normal">{t('crowd.n')}</th>
              <th className="px-3 py-2 text-right font-normal">{t('crowd.crowdBrier')}</th>
              <th className="px-3 py-2 text-right font-normal">{t('crowd.marketBrier')}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-1"><a href={`#/round/${r.id}`} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('round.title', { n: r.id })}</a></td>
                  <td className="px-3 py-3 text-right">{r.n}</td>
                  <td className={`px-3 py-3 text-right ${r.crowd < r.market ? 'font-semibold' : ''}`}>{fmtBrier(r.crowd)}</td>
                  <td className={`px-3 py-3 text-right ${r.market < r.crowd ? 'font-semibold' : ''}`}>{fmtBrier(r.market)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
