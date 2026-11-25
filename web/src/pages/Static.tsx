import { Blocks, Card, Explain, NextLinks, ScoresWhen } from '../components';
import { useT } from '../i18n';
import { crowdVsMarket, type Dataset } from '../lib/data';
import { fmtBrier } from '../lib/format';
import { Headline } from './Home';

type Block = Parameters<typeof Blocks>[0]['blocks'][number];
export const DOC_SLUGS = ['how', 'scoring', 'owner', 'risk', 'faq'] as const;
// old slugs keep working: security merged into owner; selection stays reachable from the round page
const ALIAS: Record<string, string> = { security: 'owner' };

export function DocsIndex() {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('docs.title')}</h1>
      <p className="text-muted">{t('docs.intro')}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {DOC_SLUGS.map((s) => (
          <li key={s}><a href={`#/docs/${s}`} className="flex min-h-11 items-center rounded-xl border border-line bg-surface p-4 font-semibold hover:border-accent">{t(`docs.pages.${s}.title`)}</a></li>
        ))}
      </ul>
      <section aria-labelledby="glossary" className="space-y-2 pt-2">
        <h2 id="glossary" className="text-lg font-semibold">{t('help.glossary')}</h2>
        <p className="text-sm text-muted">{t('help.glossaryIntro')}</p>
        <Explain open terms={['agentId', 'forecast', 'commit', 'reveal', 'forfeit', 'market', 'baseline', 'brier', 'skill', 'crowd', 'void']} />
      </section>
      <NextLinks to={['start', 'rounds']} />
    </div>
  );
}

export function DocPage({ slug: asked }: { slug: string }) {
  const { t, raw } = useT();
  const slug = ALIAS[asked] ?? asked;
  const blocks = raw<Block[] | undefined>(`docs.pages.${slug}.blocks`);
  if (!blocks) return <><p className="text-muted">{t('ui.notFound')}</p><NextLinks to={['docs']} /></>;
  // guided path: previous and next follow DOC_SLUGS, the order of the docs index
  const i = (DOC_SLUGS as readonly string[]).indexOf(slug);
  const prev = DOC_SLUGS[i - 1], next = DOC_SLUGS[i + 1];
  const navLink = 'flex min-h-11 flex-1 items-center rounded-xl border border-line bg-surface p-4 hover:border-accent';
  return (
    <article className="space-y-4">
      <a href="#/docs" className="inline-flex min-h-11 items-center text-sm text-accent">{t('docs.title')}</a>
      <h1 className="text-2xl font-semibold">{t(`docs.pages.${slug}.title`)}</h1>
      <Blocks blocks={blocks} />
      {i >= 0 && (
        <nav aria-label={t('help.docNav')} className="flex flex-col gap-2 pt-4 sm:flex-row">
          {prev && <a href={`#/docs/${prev}`} rel="prev" className={navLink}>{t('help.prev', { t: t(`docs.pages.${prev}.title`) })}</a>}
          {next && <a href={`#/docs/${next}`} rel="next" className={`${navLink} sm:justify-end sm:text-right`}>{t('help.next', { t: t(`docs.pages.${next}.title`) })}</a>}
        </nav>
      )}
      <NextLinks to={['start', 'docs']} />
    </article>
  );
}

export function Profile() {
  const { t, raw } = useT();
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
      <Blocks blocks={raw<string[]>('profile.body')} />
      <p className="max-w-[68ch]">{t('help.intro.profile')}</p>
      <NextLinks to={['leaderboard', 'start']} />
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
      {!rows.length ? <div><p className="text-muted">{t('crowd.none')}</p><ScoresWhen rounds={data.rounds} /></div> : (
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
      <Explain terms={['crowd', 'baseline', 'brier']} summary="help.whatTerms" />
      <NextLinks to={['start', 'rounds', 'scoring']} />
    </div>
  );
}
