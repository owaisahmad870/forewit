import { Card, Badge, Explain, NextLinks, PlayInClaude, QuestionTable, SampleBadge, ScoresWhen, useNow } from '../components';
import { useT } from '../i18n';
import { crowdVsMarket, liveRound, phase, type Dataset } from '../lib/data';
import { fmtBrier, fmtCountdown, fmtUtc } from '../lib/format';

export function Headline({ data }: { data: Dataset }) {
  const { t } = useT();
  const s = crowdVsMarket(data.rounds);
  if (s.crowd == null || s.market == null) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">{t('home.headline')}</h2>
        <p className="mt-2 text-muted">{t('home.headlineEmpty')}</p>
        <ScoresWhen rounds={data.rounds} />
        <div className="mt-2"><Explain terms={['crowd', 'baseline', 'brier']} summary="help.whatTerms" /></div>
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
      <div className="mt-2"><Explain terms={['crowd', 'baseline', 'brier']} /></div>
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
        <p className="text-sm font-semibold text-muted">{t('brand')}{t('brandLocal') && <span lang="zh-CN" className="ml-2 font-normal">{t('brandLocal')}</span>}</p>
        <h1 className="mt-1 max-w-[20ch] text-3xl font-semibold tracking-tight sm:text-4xl">{t('tagline')}</h1>
        <p className="mt-3 max-w-[68ch]">{t('help.intro.home')}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href="#/start" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-accent-ink">{t('help.go.start')}</a>
          <a href="#/docs" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('help.go.docs')}</a>
        </p>
      </header>

      <Card>
        {!r ? <p className="text-muted">{t('home.noRound')}</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t('home.liveRound')}</h2>
              <span className="flex flex-wrap items-center gap-2"><SampleBadge show={data.manifest.sample} />{ph !== 'commit' && <Badge tone="neutral">{t(`phase.${ph}`)}</Badge>}<PlayInClaude /></span>
            </div>
            {(ph === 'commit' || ph === 'reveal') && (
              <p className="mt-3">
                <span className="block text-sm text-muted">{t(ph === 'commit' ? 'home.commitCloses' : 'home.revealCloses')}</span>
                <span className="text-4xl font-semibold" role="timer" aria-live="off">{fmtCountdown((ph === 'commit' ? r.commitDeadline : r.revealDeadline).getTime() - now, t('ui.dayUnit'))}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-muted">{t('home.picksNote')}</p>
            <div className="mt-4"><QuestionTable questions={visible} crowdSealed={ph === 'commit' || ph === 'reveal'} showResult={false} /></div>
            {r.questions.length > visible.length && <p className="mt-2 text-sm text-muted">{t('round.hidden', { n: r.questions.length - visible.length })}</p>}
            <p className="mt-3 text-sm text-muted">
              {r.hasBaseline ? null : r.marketPriceAt ? t('home.priceAt', { t: fmtUtc(r.marketPriceAt, lang) }) : t('home.noPrice')}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted">{t('home.statCommits')}: <span className="text-ink">{r.commitCount}</span></span>
              <a href={`#/round/${r.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-accent-ink">{t('home.openRound', { n: r.id })}</a>
            </div>
            <div className="mt-2"><Explain terms={['commitsOpen', 'revealWindow', 'market', 'baseline', 'crowd', 'commits']} summary="help.whatTerms" /></div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('home.anyTitle')}</h2>
        <p className="mt-2">{t('home.anyText')}</p>
        <a href="#/start" className="mt-2 inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('home.anyLink')}</a>
      </Card>

      <Headline data={data} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t('home.stats')}</h2><SampleBadge show={data.manifest.sample} /></div>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt className="text-sm text-muted">{t('home.statCommitters')}</dt><dd className="text-2xl font-semibold">{data.snapshot.metrics.distinctCommitters}</dd></div>
          <div><dt className="text-sm text-muted">{t('home.statRounds')}</dt><dd className="text-2xl font-semibold">{data.snapshot.metrics.rounds}</dd></div>
        </dl>
        <div className="mt-2"><Explain terms={['distinct', 'agentId']} /></div>
      </Card>

      <NextLinks to={['start', 'rounds', 'leaderboard']} />
    </div>
  );
}
