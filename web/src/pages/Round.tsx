import { AllMarkets } from './AllMarkets';
import { Badge, Card, DateLine, Explain, Histogram, NextLinks, OutcomeBadge, ProbRule, QuestionTitle, useNow } from '../components';
import { useT } from '../i18n';
import { phase, type Dataset, type Round } from '../lib/data';
import { fmtShare, fmtUtc } from '../lib/format';

export function Rounds({ data }: { data: Dataset }) {
  const { t, lang } = useT();
  const now = useNow(30000);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('round.all')}</h1>
      <p className="max-w-[68ch]">{t('help.intro.rounds')}</p>
      <Explain terms={['commitsOpen', 'revealWindow', 'resolving', 'scored', 'commits']} summary="help.whatTerms" />
      <section aria-labelledby="boards-h" className="max-w-[68ch] rounded-lg border border-line bg-surface p-3 text-sm">
        <h2 id="boards-h" className="mb-2 font-semibold">{t('round.boards.title')}</h2>
        <ul className="space-y-2">
          {(['featured', 'topics', 'open', 'sports', 'elections'] as const).map((k) => (
            <li key={k} className="flex flex-wrap items-start justify-between gap-2">
              <span><span className="font-semibold">{t(`round.boards.${k}.name`)}</span> <span className="text-muted">{t(`round.boards.${k}.what`)}</span></span>
              <Badge tone={k === 'featured' ? 'accent' : 'neutral'}>{t(`round.boards.status.${k === 'featured' ? 'live' : k === 'topics' || k === 'open' ? 'rolling' : 'planned'}`)}</Badge>
            </li>
          ))}
        </ul>
      </section>
      {!data.rounds.length && <p className="text-muted">{t('round.noRounds')} {t('home.noRound')}</p>}
      <AllMarkets />
      <ul className="space-y-2">
        {data.rounds.map((r) => (
          <li key={r.id}>
            <a href={`#/round/${r.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-4 hover:border-accent">
              <span>
                <span className="block font-semibold">{t('round.title', { n: r.id })}</span>
                <span className="block text-sm text-muted">{fmtUtc(r.commitDeadline, lang)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted">{t('round.commits')} <span className="text-ink">{r.commitCount}</span></span>
                <Badge tone={phase(r, now) === 'commit' ? 'accent' : 'neutral'}>{t(`phase.${phase(r, now)}`)}</Badge>
              </span>
            </a>
          </li>
        ))}
      </ul>
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
      <p className="max-w-[68ch]">{t('help.intro.round')}</p>
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
      <ol className="space-y-3">
        {visible.map((q) => (
          <li key={q.index}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <QuestionTitle title={q.title} />
                <OutcomeBadge outcome={q.outcome} />
              </div>
              {q.endsAt && <p className="mt-1 text-sm text-muted">{t('round.endsAt', { t: fmtUtc(q.endsAt, lang) })}</p>}
              <ProbRule market={q.baseline ?? (q.marketPrice != null ? Math.round(q.marketPrice * 10000) : null)} crowd={q.crowd} marketLabel={q.baseline != null ? t('home.marketAtDeadline') : t('home.marketPrice')} />
              {ph !== 'commit' && <Histogram q={q} />}
            </Card>
          </li>
        ))}
      </ol>
      <Explain terms={['forecast', 'market', 'baseline', 'crowd', 'histogram', 'void']} summary="help.whatTerms" />
      <NextLinks to={['start', 'scoring', 'rounds']} />
    </div>
  );
}
