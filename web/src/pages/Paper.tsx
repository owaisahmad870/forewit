// Paper trades on a profile: what each revealed daily forecast would have done as a real Predict.fun taker trade.
// Simulated only; the method lives in indexer/lib/paper.mjs and the docs page "paper".
import { Card, ColHelp, QuestionTitle } from '../components';
import { useT } from '../i18n';
import type { Dataset } from '../lib/data';

const usdt = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}`;
const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(0)}%`;
const tone = (x: number | null | undefined) => (x == null ? '' : x > 0 ? 'text-pos' : x < 0 ? 'text-neg' : '');

export function PaperTrades({ data, addr }: { data: Dataset; addr: string }) {
  const { t } = useT();
  const p = data.snapshot.paper;
  const sum = p?.totals[addr];
  if (!p || !sum) return null;
  const rows = Object.entries(p.rounds).sort(([a], [b]) => Number(b) - Number(a)).flatMap(([rid, byWho]) =>
    (byWho[addr] ?? []).map((tr, i) => ({ rid, i, tr, q: data.rounds.find((r) => String(r.id) === rid)?.questions[i] })).filter((x) => x.tr?.side && x.tr.spent != null));
  const th = 'px-2 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase sm:px-3';
  const num = 'px-2 py-3 text-right tabular-nums whitespace-nowrap sm:px-3';
  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('paper.title')}</h2>
      <p className="mt-1 max-w-[68ch] text-sm text-muted">{t('paper.lead', { s: p.STAKE_USDT, e: Math.round(p.MIN_EDGE * 100) })}</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <li><span className="block text-xs text-muted">{t('paper.pnl')}</span><span className={`text-xl font-semibold tabular-nums ${tone(sum.pnl)}`}>{usdt(sum.pnl)} USDT</span></li>
        <li><span className="block text-xs text-muted">{t('paper.roi')}</span><span className={`text-xl font-semibold tabular-nums ${tone(sum.roi)}`}>{sum.roi == null ? '–' : pct(sum.roi)}</span></li>
        <li><span className="block text-xs text-muted">{t('paper.range')}</span><span className="text-base font-semibold tabular-nums whitespace-nowrap sm:text-xl">{sum.roiLow == null || sum.roiHigh == null ? '–' : t('paper.rangeN', { a: pct(sum.roiLow), b: pct(sum.roiHigh) })}</span></li>
        <li><span className="block text-xs text-muted">{t('paper.trades')}</span><span className="text-base font-semibold sm:text-lg">{t('paper.tradesN', { n: sum.trades, w: sum.wins, o: sum.open })}</span></li>
      </ul>
      {!sum.enough && <p className="mt-3 text-sm text-muted">{t('paper.tooFew', { n: p.MIN_TRADES_TO_JUDGE })}</p>}
      {rows.length > 0 && (
        <div className="-mx-1 mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('paper.title')}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>{t('paper.col.question')}</th>
                <th scope="col" className={th}>{t('paper.col.side')}<ColHelp text={t('paper.tip.side')} /></th>
                <th scope="col" className={`${th} text-right`}>{t('paper.col.edge')}<ColHelp text={t('paper.tip.edge')} /></th>
                <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('paper.col.fill')}<ColHelp text={t('paper.tip.fill')} /></th>
                <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('paper.col.fee')}<ColHelp text={t('paper.tip.fee', { b: p.FEE_BPS })} /></th>
                <th scope="col" className={`${th} text-right`}>{t('paper.col.pnl')}<ColHelp text={t('paper.tip.pnl')} /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ rid, i, tr, q }) => (
                <tr key={`${rid}:${i}`} className="border-b border-line last:border-0 align-top">
                  <th scope="row" className="px-2 py-3 text-left font-normal sm:px-3">
                    <a href={`#/round/${rid}`} className="text-accent underline underline-offset-4">{t('me.round', { n: rid })}</a>{' '}
                    {q?.title ? <QuestionTitle title={q.title} /> : null}
                  </th>
                  <td className="px-2 py-3 whitespace-nowrap sm:px-3">{t('paper.buy', { s: t(`outcome.${tr!.side}`) })}</td>
                  <td className={num}>{t('paper.edgeN', { p: tr!.edgePts ?? 0 })}</td>
                  <td className={`${num} hidden sm:table-cell`}>{tr!.avgPrice!.toFixed(3)}{tr!.partial ? ` ${t('paper.partial')}` : ''}</td>
                  <td className={`${num} hidden text-muted sm:table-cell`} title={tr!.feeBps != null ? `${tr!.feeBps} bps` : undefined}>{tr!.feeUsdt!.toFixed(2)}</td>
                  <td className={`${num} font-semibold ${tone(tr!.pnl)}`}>{tr!.pnl == null ? <span className="font-normal text-muted">{t('paper.open')}</span> : usdt(tr!.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-muted">{t('paper.disclaimer')} <a href="#/docs/paper" className="text-accent underline underline-offset-4">{t('paper.method')}</a></p>
    </Card>
  );
}

// Round page: one row per forecaster with a simulated trade in this round; names only for public profiles.
export function RoundPaper({ data, roundId }: { data: Dataset; roundId: number }) {
  const { t } = useT();
  const p = data.snapshot.paper;
  const byWho = p?.rounds[String(roundId)];
  if (!p || !byWho) return null;
  const profiles = data.snapshot.profiles ?? {};
  const rows = Object.entries(byWho).map(([who, ts]) => {
    const taken = ts.filter((x) => x?.side && x.spent != null);
    const settled = taken.filter((x) => x!.pnl != null);
    return { who, n: taken.length, open: taken.length - settled.length, staked: taken.reduce((s, x) => s + x!.spent!, 0), pnl: settled.length ? settled.reduce((s, x) => s + x!.pnl!, 0) : null };
  }).filter((r) => r.n > 0).sort((a, b) => (b.pnl ?? -1e9) - (a.pnl ?? -1e9));
  if (!rows.length) return null;
  const th = 'px-2 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase sm:px-3';
  const num = 'px-2 py-3 text-right tabular-nums whitespace-nowrap sm:px-3';
  const nameOf = (a: string) => { const pr = Object.entries(profiles).find(([k]) => k.toLowerCase() === a)?.[1]; return pr?.isPublic && pr.name ? pr.name : `${a.slice(0, 6)}…${a.slice(-4)}`; };
  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('paper.roundTitle')}</h2>
      <p className="mt-1 max-w-[68ch] text-sm text-muted">{t('paper.roundLead', { s: p.STAKE_USDT, e: Math.round(p.MIN_EDGE * 100) })}</p>
      <div className="-mx-1 mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('paper.roundTitle')}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={th}>{t('paper.col.who')}</th>
              <th scope="col" className={`${th} text-right`}>{t('paper.trades')}</th>
              <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{t('paper.col.staked')}</th>
              <th scope="col" className={`${th} text-right`}>{t('paper.col.pnl')}<ColHelp text={t('paper.tip.pnl')} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.who} className="border-b border-line last:border-0">
                <th scope="row" className="px-2 py-3 text-left font-normal sm:px-3"><a href={`#/profile/${r.who}`} className="text-accent underline underline-offset-4">{nameOf(r.who)}</a></th>
                <td className={num}>{r.open ? t('paper.roundN', { n: r.n, o: r.open }) : r.n}</td>
                <td className={`${num} hidden sm:table-cell`}>{r.staked.toFixed(2)}</td>
                <td className={`${num} font-semibold ${tone(r.pnl)}`}>{r.pnl == null ? <span className="font-normal text-muted">{t('paper.open')}</span> : usdt(r.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">{t('paper.disclaimer')} <a href="#/docs/paper" className="text-accent underline underline-offset-4">{t('paper.method')}</a></p>
    </Card>
  );
}
