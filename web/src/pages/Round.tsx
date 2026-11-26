import { Badge, Card, ColHelp, DateLine, Explain, Histogram, NextLinks, QuestionTable, QuestionTitle, useNow } from '../components';
import { useT } from '../i18n';
import { phase, type Dataset, type Round } from '../lib/data';
import { fmtShare, fmtUtc } from '../lib/format';

export function Rounds({ data }: { data: Dataset }) {
  const { t, lang } = useT();
  const now = useNow(30000);
  const th = 'px-3 py-2 text-left text-xs font-medium tracking-wide text-muted uppercase whitespace-nowrap';
  const num = 'px-3 py-3 text-right tabular-nums';
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('round.all')}</h1>
      {!data.rounds.length && <p className="text-muted">{t('round.noRounds')} {t('home.noRound')}</p>}
      {data.rounds.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>{t('round.col.round')}<ColHelp text={t('tips.r.round')} /></th>
                <th scope="col" className={`${th} hidden sm:table-cell`}>{t('round.col.closes')}<ColHelp text={t('tips.r.closes')} /></th>
                <th scope="col" className={`${th} text-right`}>{t('round.col.questions')}<ColHelp text={t('tips.r.questions')} /></th>
                <th scope="col" className={`${th} text-right`}>{t('round.commits')}<ColHelp text={t('tips.r.commits')} /></th>
                <th scope="col" className={`${th} text-right`}>{t('round.col.status')}<ColHelp text={t('tips.r.status')} /></th>
              </tr>
            </thead>
            <tbody>
              {data.rounds.map((r) => {
                const ph = phase(r, now);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <th scope="row" className="px-3 py-3 text-left font-normal">
                      <a href={`#/round/${r.id}`} className="font-semibold text-accent underline-offset-4 hover:underline">{t('round.title', { n: r.id })}</a>
                      <span className="block text-xs text-muted sm:hidden">{fmtUtc(r.commitDeadline, lang)}</span>
                    </th>
                    <td className="hidden px-3 py-3 whitespace-nowrap text-muted sm:table-cell">{fmtUtc(r.commitDeadline, lang)}</td>
                    <td className={num}>{r.questions.filter((q) => q.title).length}</td>
                    <td className={num}>{r.commitCount}</td>
                    <td className="px-3 py-3 text-right"><Badge tone={ph === 'commit' ? 'accent' : 'neutral'}>{t(`phase.${ph}`)}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <section className="space-y-2 border-t border-line pt-4 text-sm text-muted">
        <p className="max-w-[68ch]">{t('help.intro.rounds')}</p>
        <Explain terms={['commitsOpen', 'revealWindow', 'resolving', 'scored', 'commits']} summary="help.whatTerms" />
      </section>
      <NextLinks to={['start', 'leaderboard', 'docs']} />
    </div>
  );
}

export function RoundPage({ data, id }: { data: Dataset; id: number }) {
  const { t, lang } = useT();
  const now = useNow();
  const r: Round | undefined = data.rounds.find((x) => x.id === id);
  if (!r) return <><p className="text-muted">{t('round.notFound', { n: id })}</p><NextLinks to={['rounds']} /></>;
  const visible = r.questions.filter((q) => q.title);
  const ph = phase(r, now);
  const kind = r.kind === 'long' ? 'long' : 'daily';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('round.title', { n: r.id })}</h1>
        <div className="flex flex-wrap gap-2">
          {r.featured && <Badge tone="accent">{t('round.featured')}</Badge>}
          {r.board === 'open' && <Badge tone="neutral">{t('round.openBoard')}</Badge>}
          <Badge tone={ph === 'commit' ? 'accent' : 'neutral'}>{t(`phase.${ph}`)}</Badge>
        </div>
      </div>
      <p className="max-w-[68ch]">{t(ph === 'commit' ? 'help.intro.round' : 'help.intro.roundClosed')}</p>
      {ph === 'commit' && <p className="max-w-[68ch] text-sm text-muted">{t('help.intro.roundHidden')}</p>}
      {r.funnel && (
        <details className="max-w-[68ch] rounded-lg border border-line bg-surface p-3 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-accent">{t('round.why.title', { n: r.funnel.chosen })}</summary>
          <p className="mt-2 text-muted">{t('round.why.intro')}</p>
          <ol className="mt-2 space-y-1">
            {(['open', 'binary', 'notSports', 'liquid', 'notPolitics', 'inWindow', 'events', 'chosen'] as const).map((k) => (
              <li key={k} className="flex justify-between gap-3 border-t border-line py-1"><span>{t(`round.why.${k}`)}</span><span className="font-semibold tabular-nums">{r.funnel![k].toLocaleString()}</span></li>
            ))}
          </ol>
          <a href="#/docs/selection" className="mt-2 inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('round.why.rule')}</a>
        </details>
      )}
      <Card>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">{t('home.commitDeadline')}</dt><dd><DateLine d={r.commitDeadline} /></dd></div>
          <div><dt className="text-muted">{t('home.revealDeadline')}</dt><dd><DateLine d={r.revealDeadline} /></dd></div>
          <div><dt className="text-muted">{t('round.commits')}</dt><dd className="text-xl font-semibold">{r.commitCount}</dd></div>
          <div>
            <dt className="text-muted">{t('round.reveals')}</dt>
            <dd>
              <span className="text-xl font-semibold">{t('round.revealedOf', { r: r.revealedCount, c: r.commitCount })}</span>
              {r.revealRate != null && <span className="ml-2 text-muted">{fmtShare(r.revealRate)}</span>}
              <span className="mt-1 block h-1.5 rounded bg-surface-2"><span className="block h-full rounded bg-accent-mark" style={{ width: `${(r.revealRate ?? 0) * 100}%` }} /></span>
            </dd>
          </div>
          <div><dt className="text-muted">{t('round.forfeits')}</dt><dd>{r.forfeitCount}</dd></div>
          {r.resolutionWaitDays != null && <div><dt className="text-muted">{t('round.resolutionWait')}</dt><dd>{t(r.resolutionWaitDays === 1 ? 'round.day' : 'round.days', { n: r.resolutionWaitDays })}</dd></div>}
          <div><dt className="text-muted">{t('round.rule')}</dt><dd>{t(`round.kinds.${kind}`)}{r.rule && <span className="block text-muted">{r.rule}</span>}</dd></div>
        </dl>
        {r.crowdMethod && <p className="mt-3 text-sm text-muted">{t('round.crowdMethod', { m: r.crowdMethod })}</p>}
        <div className="mt-2"><Explain terms={[ph === 'commit' ? 'commitsOpen' : ph === 'reveal' ? 'revealWindow' : ph, 'commits', 'revealProgress', 'forfeit', 'resolutionWait', 'selectionRule']} /></div>
      </Card>

      <h2 className="pt-2 text-lg font-semibold">{t('round.questions')}</h2>
      {r.questions.length > visible.length && <p className="text-sm text-muted">{t('round.hidden', { n: r.questions.length - visible.length })}</p>}
      <Card><QuestionTable questions={visible} crowdSealed={ph === 'commit' || ph === 'reveal'} showResult={ph !== 'commit'} /></Card>
      {ph !== 'commit' && visible.some((q) => q.forecasts.length) && (
        <details className="rounded-xl border border-line bg-surface p-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-accent">{t('table.spread')}</summary>
          <ol className="mt-2 divide-y divide-line">
            {visible.map((q) => <li key={q.index} className="py-3"><QuestionTitle title={q.title} /><Histogram q={q} /></li>)}
          </ol>
        </details>
      )}
      <Explain terms={['forecast', 'market', 'baseline', 'crowd', 'histogram', 'void']} summary="help.whatTerms" />
      <NextLinks to={['start', 'scoring', 'rounds']} />
    </div>
  );
}
