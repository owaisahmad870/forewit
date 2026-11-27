import { Blocks, Card, Explain, NextLinks, ScoresWhen, slugId } from '../components';
import { DOC_NAV, DocSection, DocShell } from '../DocShell';
import { useT } from '../i18n';
import { crowdVsMarket, type Dataset } from '../lib/data';
import { fmtBrier } from '../lib/format';
import { Headline } from './Home';

type Block = Parameters<typeof Blocks>[0]['blocks'][number];
export const DOC_SLUGS = ['how', 'scoring', 'paper', 'owner', 'risk', 'faq'] as const;
// old slugs keep working: security merged into owner; selection stays reachable from the round page
const ALIAS: Record<string, string> = { security: 'owner' };


export function DocsIndex() {
  const { t } = useT();
  return (
    <DocShell current="index" title={t('docs.title')} lead={t('docs.intro')} toc={[]} footer={false}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {DOC_NAV.map(([k, href, label]) => (
          <li key={k}>
            <a href={href} className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 hover:border-accent">
              <span className="font-semibold text-accent">{t(label)}</span>
              <span className="mt-1 text-sm text-muted">{t(`docs.cards.${k}`)}</span>
            </a>
          </li>
        ))}
      </ul>
      <DocSection id="glossary" title={t('help.glossary')}>
        <p className="mb-3 text-sm text-muted">{t('help.glossaryIntro')}</p>
        <Explain open terms={['agentId', 'forecast', 'commit', 'reveal', 'forfeit', 'market', 'baseline', 'brier', 'skill', 'crowd', 'void']} />
      </DocSection>
    </DocShell>
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
  const navLink = 'flex min-h-11 flex-1 flex-col justify-center rounded-lg border border-line p-4 hover:border-accent';
  const toc = blocks.flatMap((b) => (typeof b === 'object' && 'h' in b ? [{ id: slugId(b.h), label: b.h }] : []));
  return (
    <DocShell current={slug} title={t(`docs.pages.${slug}.title`)} toc={toc}>
      <Blocks blocks={blocks} />
      {i >= 0 && (
        <nav aria-label={t('help.docNav')} className="mt-10 flex flex-col gap-3 sm:flex-row">
          {prev && <a href={`#/docs/${prev}`} rel="prev" className={navLink}><span className="text-xs text-muted">{t('ui.previous')}</span><span className="font-semibold text-accent">{t(`docs.pages.${prev}.title`)}</span></a>}
          {next && <a href={`#/docs/${next}`} rel="next" className={`${navLink} sm:items-end sm:text-right`}><span className="text-xs text-muted">{t('ui.next')}</span><span className="font-semibold text-accent">{t(`docs.pages.${next}.title`)}</span></a>}
        </nav>
      )}
    </DocShell>
  );
}

export function Crowd({ data }: { data: Dataset }) {
  const { t, raw } = useT();
  // every round whose commits closed: scored ones show both Briers, the rest say they wait for onchain outcomes
  const now = Date.now();
  const rows = data.rounds
    .filter((r) => r.commitDeadline.getTime() <= now)
    .map((r) => ({ id: r.id, ...crowdVsMarket([r]) }))
    .sort((a, b) => b.id - a.id);
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
                  {r.crowd === null || r.market === null ? <td colSpan={3} className="px-3 py-3 text-right text-muted">{t('crowd.waiting')}</td> : <>
                    <td className="px-3 py-3 text-right">{r.n}</td>
                    <td className={`px-3 py-3 text-right ${r.crowd < r.market ? 'font-semibold' : ''}`}>{fmtBrier(r.crowd)}</td>
                    <td className={`px-3 py-3 text-right ${r.market < r.crowd ? 'font-semibold' : ''}`}>{fmtBrier(r.market)}</td>
                  </>}
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
