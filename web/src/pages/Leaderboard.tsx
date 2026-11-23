import { Card, SampleBadge } from '../components';
import { useT } from '../i18n';
import { leaderboard, MIN_BASELINE_QUESTIONS, MIN_ROUNDS, type Dataset, type Row } from '../lib/data';
import { fmtBrier, fmtShare, fmtSkill } from '../lib/format';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function Table({ rows, ranked }: { rows: Row[]; ranked: boolean }) {
  const { t } = useT();
  const th = 'px-3 py-2 font-normal whitespace-nowrap';
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-muted">
          <tr>
            {ranked && <th className={th}>{t('leaderboard.rank')}</th>}
            <th className={th}>{t('leaderboard.forecaster')}</th>
            <th className={`${th} text-right`}>{t('leaderboard.skill')}</th>
            <th className={`${th} text-right`}>{t('leaderboard.brier')}</th>
            <th className={`${th} text-right`}>{t('leaderboard.calibration')}</th>
            <th className={`${th} text-right`}>{t('leaderboard.questions')}</th>
            <th className={`${th} text-right`}>{t('leaderboard.rounds')}</th>
            <th className={`${th} text-right`}>{t('leaderboard.participation')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.addr} className="border-t border-line">
              {ranked && <td className="px-3 py-3">{i + 1}</td>}
              <td className="px-3 py-3 whitespace-nowrap">
                <span className="block font-semibold">{r.name ?? short(r.addr)}</span>
                {r.name && <span className="block text-xs text-muted">{short(r.addr)}</span>}
              </td>
              <td className={`px-3 py-3 text-right font-semibold ${r.shrunkSkill > 0 ? 'text-pos' : r.shrunkSkill < 0 ? 'text-neg' : ''}`}>{fmtSkill(r.shrunkSkill)}</td>
              <td className="px-3 py-3 text-right">{fmtBrier(r.meanBrier)}</td>
              <td className="px-3 py-3 text-right">{fmtBrier(r.calibrationError)}</td>
              <td className="px-3 py-3 text-right">{r.baselineQuestions}</td>
              <td className="px-3 py-3 text-right">{r.rounds}</td>
              <td className="px-3 py-3 text-right">{fmtShare(r.participation)}</td>
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
      <p className="max-w-[68ch] text-muted">{t('leaderboard.intro')}</p>
      <p className="text-sm">{t('leaderboard.totals', { n: lb.forecasters, p: lb.publicCount })}</p>
      {!lb.rows.length && <Card><p className="text-muted">{t('leaderboard.empty')}</p></Card>}
      {ranked.length > 0 && <Table rows={ranked} ranked />}
      <p className="text-sm text-muted">{t('leaderboard.formula')}</p>
      {unranked.length > 0 && (
        <>
          <h2 className="pt-2 text-lg font-semibold">{t('leaderboard.unranked')}</h2>
          <p className="text-sm text-muted">{t('leaderboard.unrankedNote', { r: MIN_ROUNDS, q: MIN_BASELINE_QUESTIONS })}</p>
          <Table rows={unranked} ranked={false} />
        </>
      )}
    </div>
  );
}
