import { CopyBlock, DateLine, Card, Badge, ProbRule, QuestionTitle, SampleBadge, Tabs, useNow } from '../components';
import { useT } from '../i18n';
import { crowdVsMarket, liveRound, phase, type Dataset } from '../lib/data';
import { fmtBrier, fmtCountdown, fmtUtc } from '../lib/format';
import { CLI_COMMANDS, SKILL_COMMANDS } from '../commands';

export function Headline({ data }: { data: Dataset }) {
  const { t } = useT();
  const s = crowdVsMarket(data.rounds);
  if (s.crowd == null || s.market == null) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">{t('home.headline')}</h2>
        <p className="mt-2 text-muted">{t('home.headlineEmpty')}</p>
      </Card>
    );
  }
  const max = Math.max(s.crowd, s.market) || 1;
  const verdict = s.crowd < s.market ? 'home.crowdAhead' : s.crowd > s.market ? 'home.crowdBehind' : 'home.crowdEven';
  const bars = [
    { label: t('home.crowd'), v: s.crowd, cls: 'bg-ink' },
    { label: t('home.marketAtDeadline'), v: s.market, cls: 'bg-market' },
  ];
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t('home.headline')}</h2><SampleBadge show={data.manifest.sample} /></div>
      <p className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">{t('home.headlineStat', { crowd: fmtBrier(s.crowd), market: fmtBrier(s.market), n: s.n })}</p>
      <div className="mt-4 space-y-2" role="img" aria-label={t('home.headlineStat', { crowd: fmtBrier(s.crowd), market: fmtBrier(s.market), n: s.n })}>
        {bars.map((b) => (
          <div key={b.label} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-2 text-sm">
            <span className="text-muted">{b.label}</span>
            <span className="h-2.5 rounded-r bg-surface-2"><span className={`block h-full rounded-r ${b.cls}`} style={{ width: `${(b.v / max) * 100}%` }} /></span>
            <span className="text-right">{fmtBrier(b.v)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{t(verdict)} Brier: {t('ui.lowerBetter')}.</p>
    </Card>
  );
}

export function Home({ data }: { data: Dataset }) {
  const { t, lang } = useT();
  const now = useNow();
  const r = liveRound(data.rounds, now);
  const ph = r && phase(r, now);
  const visible = r ? r.questions.filter((q) => q.title) : [];
  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('brand')}</h1>
        <p className="mt-2 max-w-[40ch] text-lg text-muted">{t('tagline')}</p>
      </header>

      <Headline data={data} />

      <Card>
        {!r ? <p className="text-muted">{t('home.noRound')}</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t('home.liveRound')}: {t('round.title', { n: r.id })}</h2>
              <span className="flex gap-2"><SampleBadge show={data.manifest.sample} /><Badge tone={ph === 'commit' ? 'accent' : 'neutral'}>{t(`phase.${ph}`)}</Badge></span>
            </div>
            {(ph === 'commit' || ph === 'reveal') && (
              <p className="mt-3">
                <span className="block text-sm text-muted">{t(ph === 'commit' ? 'home.commitCloses' : 'home.revealCloses')}</span>
                <span className="text-4xl font-semibold" role="timer" aria-live="off">{fmtCountdown((ph === 'commit' ? r.commitDeadline : r.revealDeadline).getTime() - now, t('ui.dayUnit'))}</span>
              </p>
            )}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">{t('home.commitDeadline')}</dt><dd><DateLine d={r.commitDeadline} /></dd></div>
              <div><dt className="text-muted">{t('home.revealDeadline')}</dt><dd><DateLine d={r.revealDeadline} /></dd></div>
            </dl>
            <ol className="mt-4 divide-y divide-line border-t border-line">
              {visible.map((q) => (
                <li key={q.index} className="py-3">
                  <QuestionTitle title={q.title} />
                  <ProbRule market={q.baseline ?? (q.marketPrice != null ? Math.round(q.marketPrice * 10000) : null)} crowd={q.crowd} marketLabel={q.baseline != null ? t('home.marketAtDeadline') : t('home.marketPrice')} />
                </li>
              ))}
            </ol>
            {r.questions.length > visible.length && <p className="mt-2 text-sm text-muted">{t('round.hidden', { n: r.questions.length - visible.length })}</p>}
            <p className="mt-3 text-sm text-muted">
              {r.hasBaseline ? null : r.marketPriceAt ? t('home.priceAt', { t: fmtUtc(r.marketPriceAt, lang) }) : t('home.noPrice')}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted">{t('home.statCommits')}: <span className="text-ink">{r.commitCount}</span></span>
              <a href={`#/round/${r.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-accent-ink">{t('home.openRound', { n: r.id })}</a>
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t('home.stats')}</h2><SampleBadge show={data.manifest.sample} /></div>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt className="text-sm text-muted">{t('home.statCommitters')}</dt><dd className="text-2xl font-semibold">{data.snapshot.metrics.distinctCommitters}</dd></div>
          <div><dt className="text-sm text-muted">{t('home.statRounds')}</dt><dd className="text-2xl font-semibold">{data.snapshot.metrics.rounds}</dd></div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('home.howTo')}</h2>
        <div className="mt-3">
          <Tabs
            tabs={[
              { id: 'aipro', label: t('home.tabAiPro'), body: <><p className="text-muted">{t('home.aiProIntro')}</p><CopyBlock text={t('home.aiProPrompt')} /></> },
              { id: 'skill', label: t('home.tabSkill'), body: <><p className="text-muted">{t('home.skillIntro')}</p><CopyBlock text={SKILL_COMMANDS} /><p className="mt-2 text-sm text-muted">{t('home.repoPending')}</p></> },
              { id: 'cli', label: t('home.tabCli'), body: <><p className="text-muted">{t('home.cliIntro')}</p><CopyBlock text={CLI_COMMANDS} /></> },
            ]}
          />
        </div>
        <a href="#/play" className="mt-3 inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('home.morePlay')}</a>
      </Card>
    </div>
  );
}
