import { useState } from 'react';
import { Card, DateLine, NextLinks, useNow } from '../components';
import { useT } from '../i18n';
import { upcoming, walletResults, type Dataset, type WalletRound } from '../lib/data';

const KEY = 'forewit.wallet';
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
const saved = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
// skill is in Brier units (0 to 1); shown as points out of 100 so a layman reads "+8.3 points"
const pts = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)}`;
const TONE: Record<WalletRound['verdict'], string> = { beat: 'text-pos', behind: 'text-neg', forfeited: 'text-neg', missed: 'text-neg', level: '', scored: '', waiting: 'text-muted', reveal: 'text-accent' };

export function NextRound({ data }: { data: Dataset }) {
  const { t } = useT();
  const now = useNow(60000);
  const { open, nextOpen } = upcoming(data.rounds, now);
  return (
    <Card>
      <h2 className="text-lg font-semibold">{t('me.nextTitle')}</h2>
      {open.length ? (
        <ul className="mt-2 space-y-1">
          {open.map((r) => <li key={r.id}><a href={`#/round/${r.id}`} className="text-accent underline underline-offset-4">{t('me.openRound', { n: r.id, q: r.questions.length })}</a> {t('me.closes')} <DateLine d={r.commitDeadline} /></li>)}
        </ul>
      ) : <p className="mt-2">{t('me.nextOpens')} <DateLine d={nextOpen} /></p>}
    </Card>
  );
}

export function MyResults({ data }: { data: Dataset }) {
  const { t } = useT();
  const [input, setInput] = useState(saved);
  const [addr, setAddr] = useState(() => (isAddr(saved()) ? saved() : ''));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = input.trim();
    if (!isAddr(a)) return;
    try { localStorage.setItem(KEY, a); } catch { /* private mode: still works for this visit */ }
    setAddr(a);
  };
  const w = addr ? walletResults(data.snapshot, addr) : null;
  const scored = w ? w.beat + w.behind : 0;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('me.title')}</h1>
      <p className="max-w-[68ch] text-muted">{t('me.intro')}</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          {t('me.walletLabel')}
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off"
            aria-invalid={input !== '' && !isAddr(input.trim())} className="min-h-11 rounded-md border border-line bg-bg px-3 font-mono text-sm" />
        </label>
        <button type="submit" className="min-h-11 rounded-md bg-accent px-4 font-semibold text-accent-ink">{t('me.show')}</button>
      </form>
      {input !== '' && !isAddr(input.trim()) && <p className="text-sm text-neg">{t('me.badAddr')}</p>}
      {w && (
        <Card>
          <h2 className="text-lg font-semibold">{t('me.overall')}</h2>
          {!w.committed ? <p className="mt-2 text-muted">{t('me.none')}</p> : (
            <>
              <p className="mt-2 text-xl font-semibold">{scored ? t('me.beatOf', { b: w.beat, n: scored }) : t('me.noneScored')}</p>
              {w.avgSkill !== null && <p className={w.avgSkill > 0 ? 'text-pos' : w.avgSkill < 0 ? 'text-neg' : ''}>{t('me.avg', { p: pts(w.avgSkill) })}</p>}
              <p className="mt-1 text-sm text-muted">{t('me.counts', { c: w.committed, r: w.revealed, f: w.forfeited })}{w.rank ? ` ${t('me.rank', { n: w.rank })}` : ''}</p>
              <ul className="mt-4 divide-y divide-line">
                {w.rounds.map((r) => (
                  <li key={r.roundId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <a href={`#/round/${r.roundId}`} className="text-accent underline underline-offset-4">{t('me.round', { n: r.roundId })}</a>
                    <span className={TONE[r.verdict]}>{t(`me.v.${r.verdict}`, { p: r.skill === null ? '' : Math.abs(r.skill * 100).toFixed(1), y: r.brier === null ? '' : (r.brier * 100).toFixed(1), m: r.marketBrier === null ? '' : (r.marketBrier * 100).toFixed(1) })}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {scored > 0 && <p className="mt-3 text-sm text-muted">{t('me.miss')}</p>}
          <p className="mt-3 text-sm text-muted">{t('me.noMoney')}</p>
        </Card>
      )}
      <NextRound data={data} />
      <NextLinks to={['start', 'scoring', 'rounds']} />
    </div>
  );
}
