// Profiles: opted in forecasters by name, or any address typed in (everything shown is public onchain data).
// One page per wallet: record, streak, reliability diagram and every pick.
import { Card, NextLinks, QuestionTitle, useNow } from '../components';
import { useT } from '../i18n';
import { leaderboard, profilePicks, reliability, streak, walletResults, type Dataset } from '../lib/data';
import { Predictions, isAddr, pts, saved } from './MyResults';
import { PaperTrades } from './Paper';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function Profiles({ data }: { data: Dataset }) {
  const { t } = useT();
  const lb = leaderboard(data.snapshot);
  const mine = saved();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
      <p className="max-w-[68ch] text-muted">{t('profile.intro')}</p>
      {isAddr(mine) && <p><a href={`#/profile/${mine}`} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('profile.yours')}</a></p>}
      <Card>
        <h2 className="text-lg font-semibold">{t('profile.listTitle', { n: lb.rows.length })}</h2>
        {!lb.rows.length ? <p className="mt-2 text-muted">{t('profile.none')}</p> : (
          <ul className="mt-2 divide-y divide-line">
            {lb.rows.map((r) => (
              <li key={r.addr}><a href={`#/profile/${r.addr}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 text-accent">
                <span className="font-semibold">{r.name ?? short(r.addr)}</span><span className="font-mono text-sm text-muted">{short(r.addr)}</span>
              </a></li>
            ))}
          </ul>
        )}
      </Card>
      <p className="max-w-[68ch] text-sm text-muted">{t('help.intro.profile')}</p>
      <NextLinks to={['leaderboard', 'start']} />
    </div>
  );
}

// 10 bins of your chance against how often it happened; on the diagonal means your 70% happened 70% of the time.
function Reliability({ pairs }: { pairs: { p: number; yes: boolean }[] }) {
  const { t } = useT();
  const bins = reliability(pairs);
  const S = 240, P = 28, W = S - 2 * P;
  const x = (v: number) => P + v * W, y = (v: number) => S - P - v * W;
  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('profile.diagramTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('profile.diagramNote', { n: pairs.length })}</p>
      {!pairs.length ? <p className="mt-2 text-muted">{t('profile.diagramEmpty')}</p> : (
        <svg viewBox={`0 0 ${S} ${S}`} className="mt-3 w-full max-w-xs" role="img" aria-label={t('profile.diagramAria', { n: pairs.length })}>
          <rect x={P} y={P} width={W} height={W} fill="none" className="stroke-line" />
          <g className="stroke-line" strokeDasharray="2 3">
            <line x1={x(0.5)} y1={y(0)} x2={x(0.5)} y2={y(1)} />
            <line x1={x(0)} y1={y(0.5)} x2={x(1)} y2={y(0.5)} />
          </g>
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="stroke-muted" />
          {bins.map((b) => (
            <circle key={b.bin} cx={x(b.chance)} cy={y(b.freq)} r={3 + Math.min(8, Math.sqrt(b.n) * 1.5)} className="fill-accent" fillOpacity="0.8">
              <title>{t('profile.binTip', { c: Math.round(b.chance * 100), f: Math.round(b.freq * 100), n: b.n })}</title>
            </circle>
          ))}
          <g className="fill-muted" fontSize="10">
            <text x={x(0)} y={S - 8}>0%</text>
            <text x={x(1)} y={S - 8} textAnchor="end">100%</text>
            <text x={x(0.5)} y={S - 8} textAnchor="middle">{t('profile.axisChance')}</text>
            <text x={10} y={y(0.5)} textAnchor="middle" transform={`rotate(-90 10 ${y(0.5)})`}>{t('profile.axisHappened')}</text>
          </g>
        </svg>
      )}
    </Card>
  );
}

export function ProfilePage({ data, addr }: { data: Dataset; addr: string }) {
  const { t } = useT();
  const now = useNow(60_000);
  if (!isAddr(addr)) return <p className="text-muted">{t('me.badAddr')} <a href="#/profile" className="text-accent underline">{t('profile.title')}</a></p>;
  const a = addr.toLowerCase();
  const row = leaderboard(data.snapshot).all.find((r) => r.addr === a);
  const w = walletResults(data.snapshot, a);
  const name = row?.isPublic ? row.name : null;
  const picks = profilePicks(data, a);
  const days = streak(data.rounds, data.snapshot, a, now);
  const scored = w.beat + w.behind;
  const tone = w.avgSkill === null ? '' : w.avgSkill > 0 ? 'text-pos' : w.avgSkill < 0 ? 'text-neg' : '';
  return (
    <div className="space-y-4">
      <p><a href="#/profile" className="inline-flex min-h-11 items-center text-accent">{t('profile.back')}</a></p>
      <h1 className="break-all text-2xl font-semibold">{name ?? short(a)}</h1>
      <p className="break-all font-mono text-sm text-muted">{a}</p>
      {!row?.isPublic && <p className="max-w-[68ch] text-sm text-muted">{t('profile.notPublic')}</p>}
      <Card>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <li><span className="block text-xs text-muted">{t('profile.rank')}</span><span className="text-xl font-semibold">{w.rank ? `#${w.rank}` : t('profile.unranked')}</span></li>
          <li><span className="block text-xs text-muted">{t('profile.streak')}</span><span className="text-xl font-semibold">{t('profile.streakN', { n: days })}</span></li>
          <li><span className="block text-xs text-muted">{t('profile.beat')}</span><span className="text-xl font-semibold">{`${w.beat} / ${scored}`}</span></li>
          <li><span className="block text-xs text-muted">{t('profile.avg')}</span><span className={`text-xl font-semibold ${tone}`}>{w.avgSkill === null ? t('profile.noScore') : t('profile.pts', { p: pts(w.avgSkill) })}</span></li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          {t('profile.counts', { r: w.committed, o: w.predictions.length, q: row?.questions ?? 0 })}
          {row?.calibrationError != null ? ` ${t('profile.calError', { p: (row.calibrationError * 100).toFixed(1) })}` : ''}
        </p>
        {!w.ranked && <p className="mt-1 text-sm text-muted">{t('profile.rankRule')}</p>}
      </Card>
      <Reliability pairs={row?.cal ?? []} />
      <PaperTrades data={data} addr={a} />
      {picks.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold">{t('profile.picksTitle')}</h2>
          <ul className="mt-2 divide-y divide-line">
            {picks.map((p) => (
              <li key={`${p.roundId}:${p.index}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <a href={`#/round/${p.roundId}`} className="text-accent underline underline-offset-4">{t('me.round', { n: p.roundId })}</a>{' '}
                  {p.title ? <QuestionTitle title={p.title} /> : t('profile.market', { m: p.marketId })}
                </span>
                <span>{p.chance === null ? t('me.sealed') : t('profile.yesChance', { p: Math.round(p.chance * 1000) / 10 })} · {t(`outcome.${p.outcome}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {w.predictions.length > 0 && <Predictions list={w.predictions} />}
      <p><a href={`https://bscscan.com/address/${a}`} rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('profile.allTx')}</a></p>
      <NextLinks to={['leaderboard', 'me']} />
    </div>
  );
}
