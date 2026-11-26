import { Card, Explain, NextLinks, SampleBadge, ScoresWhen } from '../components';
import { useT } from '../i18n';
import { leaderboard, MIN_BASELINE_QUESTIONS, MIN_ROUNDS, type Dataset, type Row } from '../lib/data';
import { fmtSkill } from '../lib/format';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// lean by design: rank, who, edge over the market and sample size; Brier, calibration and participation live on each profile
function Table({ rows, ranked }: { rows: Row[]; ranked: boolean }) {
  const { t } = useT();
  const th = 'px-3 py-2 text-left text-xs font-medium tracking-wide text-muted uppercase whitespace-nowrap';
  const num = 'px-3 py-3 text-right tabular-nums';
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {ranked && <th scope="col" className={`${th} w-12`}>{t('leaderboard.rank')}</th>}
            <th scope="col" className={th}>{t('leaderboard.forecaster')}</th>
            <th scope="col" className={`${th} text-right`}>{t('leaderboard.skill')}</th>
            <th scope="col" className={`${th} text-right`}>{t('leaderboard.questions')}</th>
            <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('leaderboard.rounds')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.addr} className="border-b border-line last:border-0">
              {ranked && <td className="px-3 py-3 text-muted tabular-nums">{i + 1}</td>}
              <th scope="row" className="px-3 py-3 text-left font-normal whitespace-nowrap">
                <a href={`#/profile/${r.addr}`} className="font-semibold text-accent underline-offset-4 hover:underline">{r.name ?? short(r.addr)}{r.postBaselineFlag && <span title={t('leaderboard.postBaselineFlag')} aria-label={t('leaderboard.postBaselineFlag')}> †</span>}</a>
              </th>
              <td className={`${num} font-semibold ${r.shrunkSkill > 0 ? 'text-pos' : r.shrunkSkill < 0 ? 'text-neg' : ''}`}>{fmtSkill(r.shrunkSkill)}</td>
              <td className={num}>{r.baselineQuestions}</td>
              <td className={`${num} hidden sm:table-cell`}>{r.rounds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Leaderboard({ data }: { data: Dataset }) {
  const { t } = useT();
  const lb = leaderboard(data.snapshot);
  const ranked = lb.rows.filter((r) => r.ranked);
  const unranked = lb.rows.filter((r) => !r.ranked);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-semibold">{t('leaderboard.title')}</h1><SampleBadge show={data.manifest.sample} /></div>
      {!lb.rows.length && <Card><p className="text-muted">{t('leaderboard.empty')}</p><p className="mt-2 text-sm text-muted">{t('help.intro.profile')}</p><ScoresWhen rounds={data.rounds} /></Card>}
      {ranked.length > 0 && <Table rows={ranked} ranked />}
      {unranked.length > 0 && (
        <>
          <h2 className="pt-2 text-lg font-semibold">{t('leaderboard.unranked')}</h2>
          <Table rows={unranked} ranked={false} />
          <p className="text-sm text-muted">{t('leaderboard.unrankedNote', { r: MIN_ROUNDS, q: MIN_BASELINE_QUESTIONS })}</p>
        </>
      )}
      <section aria-label={t('leaderboard.aboutTitle')} className="space-y-2 border-t border-line pt-4 text-sm text-muted">
        <p className="text-ink">{t('leaderboard.totals', { n: lb.forecasters, p: lb.publicCount })}</p>
        <p className="max-w-[68ch]">{t('leaderboard.intro')}</p>
        <p className="max-w-[68ch]">{t('leaderboard.formula')}</p>
        <Explain terms={['skill', 'questionsCol', 'ranked', 'dagger']} />
      </section>
      <NextLinks to={['start', 'scoring', 'rounds']} />
    </div>
  );
}
