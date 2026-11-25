import { useEffect, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { INSTALL_SNIPPETS } from './commands';
import { bannerRounds, bins10, phase, type Question, type Round } from './lib/data';
import { fmtCountdown, fmtLocal, fmtPct, fmtUtc } from './lib/format';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// Untrusted market text: rendered only as React text nodes. A question without an event question renders nothing.
export function QuestionTitle({ title }: { title: Question['title'] }) {
  if (!title) return null;
  return (
    <span className="block">
      <span className="block font-semibold leading-snug">{title.event}</span>
      {title.label !== title.event && <span className="mt-0.5 block text-muted">{title.label}</span>}
    </span>
  );
}

export function DateLine({ d }: { d: Date }) {
  const { t, lang } = useT();
  return (
    <span>
      <span className="font-semibold">{fmtUtc(d, lang)}</span>{' '}
      <span className="text-muted">({t('ui.yourTime', { t: fmtLocal(d, lang) })})</span>
    </span>
  );
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>
);

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'pos' | 'neg' }) {
  const c = { neutral: 'border-line text-muted', accent: 'border-accent text-accent', pos: 'border-pos text-pos', neg: 'border-neg text-neg' }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm ${c}`}>{children}</span>;
}

export function SampleBadge({ show }: { show?: boolean }) {
  const { t } = useT();
  return show ? <Badge tone="accent">{t('ui.sampleBadge')}</Badge> : null;
}

export function OutcomeBadge({ outcome }: { outcome: Question['outcome'] }) {
  const { t } = useT();
  return <Badge tone={outcome === 'Unresolved' ? 'neutral' : 'accent'}>{t(`outcome.${outcome}`)}</Badge>;
}

// The probability rule: one 0 to 100% track per question with the market and crowd marked and labelled.
export function ProbRule({ market, crowd, marketLabel }: { market: number | null; crowd: number | null; marketLabel: string }) {
  const { t } = useT();
  const marks = [
    market != null && { key: 'm', at: market, cls: 'bg-market', shape: 'h-3 w-3 rounded-sm', label: `${marketLabel} ${fmtPct(market)}`, tcls: 'text-market' },
    crowd != null && { key: 'c', at: crowd, cls: 'bg-ink', shape: 'h-3 w-3 rotate-45', label: `${t('home.crowd')} ${fmtPct(crowd)}`, tcls: 'font-semibold text-ink' },
  ].filter(Boolean) as { key: string; at: number; cls: string; shape: string; label: string; tcls: string }[];
  if (!marks.length) return null;
  return (
    <div className="mt-3">
      <div className="relative mx-1.5 h-4" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
        {[0, 50, 100].map((x) => <div key={x} className="absolute top-1 h-2 w-px bg-line" style={{ left: `${x}%` }} />)}
        {marks.map((m) => <div key={m.key} className={`absolute top-1/2 ${m.shape} ${m.cls} -translate-x-1/2 -translate-y-1/2 ring-2 ring-surface`} style={{ left: `${m.at / 100}%` }} />)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
        {marks.map((m) => <span key={m.key} className={m.tcls}>{m.label}</span>)}
      </div>
    </div>
  );
}

// One histogram per question of revealed forecasts in 10 bins, with the market and crowd marked; always shows n and a table twin.
export function Histogram({ q }: { q: Question }) {
  const { t } = useT();
  const counts = bins10(q.forecasts);
  const n = q.forecasts.length;
  if (!n) return <p className="mt-3 text-sm text-muted">{t('round.histNone')}</p>;
  const W = 320, H = 150, L = 8, R = 312, top = 26, base = 124;
  const max = Math.max(...counts);
  const x = (bps: number) => L + ((R - L) * bps) / 10000;
  const bw = (R - L) / 10;
  const range = (i: number) => t('ui.range', { a: i * 10, b: i * 10 + 10 });
  const lines = [
    q.baseline != null && { key: 'm', at: q.baseline, cls: 'stroke-market', tcls: 'fill-market', label: `${t('home.marketAtDeadline')} ${fmtPct(q.baseline)}` },
    q.crowd != null && { key: 'c', at: q.crowd, cls: 'stroke-ink', tcls: 'fill-ink', label: `${t('home.crowd')} ${fmtPct(q.crowd)}` },
  ].filter(Boolean) as { key: string; at: number; cls: string; tcls: string; label: string }[];
  return (
    <figure className="mt-3 max-w-md">
      <figcaption className="flex justify-between text-sm text-muted">
        <span>{t('round.histogram')}</span>
        <span>{t('round.n', { n })}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${t('round.histogram')}, ${t('round.n', { n })}`}>
        <line x1={L} x2={R} y1={base} y2={base} className="stroke-line" strokeWidth={1} />
        {counts.map((c, i) => {
          const h = max ? ((base - top) * c) / max : 0;
          const x0 = L + i * bw + 1, w = bw - 2, r = Math.min(4, h);
          return (
            <g key={i}>
              <title>{`${range(i)}: ${c}`}</title>
              {c > 0 && <path className="fill-accent-mark" d={`M${x0},${base} V${base - h + r} Q${x0},${base - h} ${x0 + r},${base - h} H${x0 + w - r} Q${x0 + w},${base - h} ${x0 + w},${base - h + r} V${base} Z`} />}
              <rect x={L + i * bw} y={top} width={bw} height={base - top} fill="transparent" />
            </g>
          );
        })}
        {/* same marker shapes as the labelled ProbRule above, which serves as this chart's legend */}
        {lines.map((l) => (
          <g key={l.key}>
            <title>{l.label}</title>
            <line x1={x(l.at)} x2={x(l.at)} y1={top - 8} y2={base} className="stroke-surface" strokeWidth={5} />
            <line x1={x(l.at)} x2={x(l.at)} y1={top - 8} y2={base} className={l.cls} strokeWidth={2} />
            <rect x={x(l.at) - 5} y={top - 18} width={10} height={10} rx={1.5} className={`${l.tcls} stroke-surface`} strokeWidth={2} transform={l.key === 'c' ? `rotate(45 ${x(l.at)} ${top - 13})` : undefined} />
          </g>
        ))}
        {[0, 50, 100].map((p) => <text key={p} x={x(p * 100)} y={base + 18} textAnchor={p === 0 ? 'start' : p === 100 ? 'end' : 'middle'} className="fill-muted text-[12px]">{p}%</text>)}
      </svg>
      <details className="mt-1 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-accent">{t('round.histTable')}</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-muted"><tr><th className="py-1 font-normal">{t('round.bin')}</th><th className="py-1 text-right font-normal">{t('round.count')}</th></tr></thead>
          <tbody>{counts.map((c, i) => <tr key={i} className="border-t border-line"><td className="py-1">{range(i)}</td><td className="py-1 text-right">{c}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

// Plain language help: native details/summary, so it opens from the keyboard and reads well in screen readers without script.
export function Explain({ terms, summary = 'help.what', open }: { terms: string[]; summary?: string; open?: boolean }) {
  const { t } = useT();
  const list = (
    <dl className="max-w-[68ch] space-y-2">
      {terms.map((k) => <div key={k}><dt className="font-semibold">{t(`help.terms.${k}.t`)}</dt><dd className="text-muted">{t(`help.terms.${k}.d`)}</dd></div>)}
    </dl>
  );
  if (open) return <div className="text-sm">{list}</div>;
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-accent">{t(summary)}</summary>
      <div className="mt-1">{list}</div>
    </details>
  );
}

const GO: Record<string, string> = { start: '#/start', rounds: '#/rounds', docs: '#/docs', scoring: '#/docs/scoring', leaderboard: '#/leaderboard', proof: '#/proof' };
export function NextLinks({ to }: { to: string[] }) {
  const { t } = useT();
  return (
    <nav aria-label={t('help.nextSteps')} className="flex flex-wrap gap-x-4 pt-2">
      {to.map((k) => <a key={k} href={GO[k]} className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t(`help.go.${k}`)}</a>)}
    </nav>
  );
}

// Empty state timing: the earliest round not yet scored, and when its scores can appear (after its reveal deadline, once its markets settle).
export function ScoresWhen({ rounds }: { rounds: Round[] }) {
  const { t, lang } = useT();
  const now = useNow(60000);
  const r = [...rounds].sort((a, b) => a.id - b.id).find((x) => phase(x, now) !== 'scored');
  return r ? <p className="mt-2 text-sm text-muted">{t('help.scoresWhen', { n: r.id, t: fmtUtc(r.revealDeadline, lang) })}</p> : null;
}

type Block = string | { h: string } | { list: string[] } | { ol: string[] } | { strong: string } | { code: string };
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="max-w-[68ch] space-y-4 leading-relaxed">
      {blocks.map((b, i) =>
        typeof b === 'string' ? <p key={i}>{b}</p>
        : 'h' in b ? <h2 key={i} className="pt-2 text-lg font-semibold">{b.h}</h2>
        : 'strong' in b ? <p key={i} className="rounded-lg border border-line bg-surface-2 p-3 font-semibold">{b.strong}</p>
        : 'code' in b ? <CopyBlock key={i} text={INSTALL_SNIPPETS[b.code] ?? b.code} />
        : 'list' in b ? <ul key={i} className="list-disc space-y-2 pl-5">{b.list.map((x, j) => <li key={j}>{x}</li>)}</ul>
        : <ol key={i} className="list-decimal space-y-2 pl-5">{b.ol.map((x, j) => <li key={j}>{x}</li>)}</ol>,
      )}
    </div>
  );
}

export function CopyBlock({ text }: { text: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="mt-3 rounded-lg bg-surface-2">
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</pre>
      <div className="flex justify-end border-t border-line p-1">
        <button
          type="button"
          className="min-h-11 rounded-md px-4 text-sm text-accent hover:bg-surface"
          onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => {})}
        >
          {done ? t('ui.copied') : t('ui.copy')}
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs }: { tabs: { id: string; label: string; body: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const move = (d: number) => {
    const i = (active + d + tabs.length) % tabs.length;
    setActive(i);
    document.getElementById(`tab-${tabs[i].id}`)?.focus();
  };
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line" onKeyDown={(e) => { if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1); }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`-mb-px min-h-11 border-b-2 px-3 text-sm ${i === active ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.id} id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} hidden={i !== active} className="pt-4">
          {tab.body}
        </div>
      ))}
    </div>
  );
}

// C5: reveal due and commit countdowns for every live round. Screen readers hear only the phase text (it changes when a
// window opens or closes); the per second timers stay silent. Rendered once data is loaded, so it never pushes content down.
export function RoundBanner({ rounds, showCommit = true }: { rounds: Round[]; showCommit?: boolean }) {
  const { t, lang } = useT();
  const now = useNow();
  const { reveal, commit } = bannerRounds(rounds, now);
  const c = showCommit ? commit : null;
  const revealText = (r: Round) => t('banner.reveal', { n: r.id, t: fmtUtc(r.revealDeadline, lang) });
  const timer = (ms: number) => <span role="timer" aria-live="off" className="font-semibold tabular-nums">{fmtCountdown(ms, t('ui.dayUnit'))}</span>;
  return (
    <>
      <p aria-live="polite" className="sr-only">{[...reveal.map(revealText), c ? t('banner.commit', { n: c.id }) : ''].join(' ')}</p>
      {(reveal.length > 0 || c) && (
        <div className="mb-5 space-y-2">
          {reveal.map((r) => (
            <div key={r.id} className="rounded-lg border-2 border-accent bg-surface-2 p-3">
              <p className="font-semibold">{revealText(r)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                <span><span className="text-muted">{t('banner.revealIn')}</span> {timer(r.revealDeadline.getTime() - now)}</span>
                <a href="#/start" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4">{t('banner.how')}</a>
              </p>
            </div>
          ))}
          {c && (
            <p className="flex min-h-11 flex-wrap items-center gap-x-2 rounded-lg border border-line px-3 text-sm">
              <a href={`#/round/${c.id}`} className="text-accent underline underline-offset-4">{t('banner.commit', { n: c.id })}</a> {timer(c.commitDeadline.getTime() - now)}
            </p>
          )}
        </div>
      )}
    </>
  );
}
