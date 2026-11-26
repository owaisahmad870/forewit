import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from './i18n';
import { CLAUDE_CODE_URL, INSTALL_SNIPPETS, TEMPLATE_NEW_URL } from './commands';
import { bannerRounds, bins10, phase, type Question, type Round } from './lib/data';
import { fmtCountdown, fmtDay, fmtLocal, fmtPct, fmtUtc } from './lib/format';

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
// one row per question: figures in rows, never tiles (Hallmark critique); the close date hides on phones to keep rows calm
export function QuestionTable({ questions, crowdSealed, showResult }: { questions: Question[]; crowdSealed: boolean; showResult: boolean }) {
  const { t, lang } = useT();
  const th = 'px-2 py-2 text-left text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase sm:px-3';
  const num = 'px-2 py-3 text-right tabular-nums whitespace-nowrap sm:px-3';
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t('table.caption')}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={`${th} hidden w-8 sm:table-cell`}>#</th>
            <th scope="col" className={th}>{t('table.question')}<ColHelp text={t('tips.q.question')} /></th>
            <th scope="col" className={`${th} hidden sm:table-cell`}>{t('table.closes')}<ColHelp text={t('tips.q.closes')} /></th>
            <th scope="col" className={`${th} text-right`}>{t('table.market')}<ColHelp text={t('tips.q.market')} /></th>
            <th scope="col" className={`${th} text-right`}>{t('table.crowd')}<ColHelp text={t('tips.q.crowd')} /></th>
            {showResult && <th scope="col" className={`${th} text-right`}>{t('table.result')}<ColHelp text={t('tips.q.result')} /></th>}
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const market = q.baseline ?? (q.marketPrice != null ? Math.round(q.marketPrice * 10000) : null);
            return (
              <tr key={q.index} className="border-b border-line last:border-0 align-top">
                <td className="hidden px-3 py-3 text-muted tabular-nums sm:table-cell">{q.index + 1}</td>
                <th scope="row" className="px-2 py-3 text-left font-normal sm:px-3"><QuestionTitle title={q.title} /></th>
                <td className="hidden px-3 py-3 whitespace-nowrap text-muted sm:table-cell">{q.endsAt ? <span title={fmtUtc(q.endsAt, lang)}>{fmtDay(q.endsAt, lang)}</span> : ''}</td>
                <td className={`${num} text-market`}>{market != null ? fmtPct(market) : <span className="text-muted">{t('table.pending')}</span>}</td>
                <td className={`${num} font-semibold`}>{q.crowd != null ? fmtPct(q.crowd) : <span className="font-normal text-muted">{crowdSealed ? t('table.sealed') : t('table.pending')}</span>}</td>
                {showResult && <td className="px-3 py-3 text-right"><OutcomeBadge outcome={q.outcome} /></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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

const GO: Record<string, string> = { start: '#/start', rounds: '#/rounds', docs: '#/docs', scoring: '#/docs/scoring', leaderboard: '#/leaderboard', proof: '#/proof', me: '#/me' };
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

// Microsoft Learn style helpers: labelled callouts and an "In this article" jump list (hash routes, so it scrolls instead of linking)
export function Callout({ kind, children }: { kind: 'note' | 'tip' | 'important'; children: ReactNode }) {
  const { t } = useT();
  const bar = kind === 'important' ? 'border-l-neg' : kind === 'tip' ? 'border-l-pos' : 'border-l-accent';
  return (
    <div role="note" className={`max-w-[68ch] rounded-r-lg border border-l-4 border-line ${bar} bg-surface-2 p-3`}>
      <p className="text-xs font-semibold tracking-wide uppercase">{t(`ui.callout.${kind}`)}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
export const slugId = (x: string) => 'h-' + x.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '_').slice(0, 40);
export function OnThisPage({ items }: { items: { id: string; label: string }[] }) {
  const { t } = useT();
  if (items.length < 2) return null;
  return (
    <nav aria-label={t('ui.onThisPage')} className="max-w-[68ch] border-l-2 border-line pl-4">
      <p className="text-sm font-semibold">{t('ui.onThisPage')}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {items.map((x) => <li key={x.id}><button type="button" onClick={() => document.getElementById(x.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="min-h-9 text-left text-accent hover:underline">{x.label}</button></li>)}
      </ul>
    </nav>
  );
}

type Block = string | { h: string } | { list: string[] } | { ol: string[] } | { strong: string } | { code: string } | { note: string } | { tip: string } | { important: string };
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4 leading-relaxed">
      {blocks.map((b, i) =>
        typeof b === 'string' ? <p key={i}>{b}</p>
        : 'h' in b ? <h2 key={i} id={slugId(b.h)} className="scroll-mt-16 pt-6 text-xl font-semibold tracking-tight">{b.h}</h2>
        : 'strong' in b ? <Callout key={i} kind="note"><p className="font-semibold">{b.strong}</p></Callout>
        : 'note' in b ? <Callout key={i} kind="note"><p>{b.note}</p></Callout>
        : 'tip' in b ? <Callout key={i} kind="tip"><p>{b.tip}</p></Callout>
        : 'important' in b ? <Callout key={i} kind="important"><p>{b.important}</p></Callout>
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
  const revealText = (r: Round) => t('banner.reveal', { n: r.id });
  const timer = (ms: number) => <span role="timer" aria-live="off" className="font-semibold tabular-nums">{fmtCountdown(ms, t('ui.dayUnit'))}</span>;
  return (
    <>
      <p aria-live="polite" className="sr-only">{[...reveal.map(revealText), c ? t('banner.commit', { n: c.id }) : ''].join(' ')}</p>
      {(reveal.length > 0 || c) && (
        <div className="mb-5 space-y-2">
          {reveal.map((r) => (
            <p key={r.id} className="flex min-h-11 flex-wrap items-center gap-x-2 rounded-lg border-2 border-accent bg-surface-2 px-3 text-sm">
              <span className="font-semibold">{revealText(r)}</span> {timer(r.revealDeadline.getTime() - now)}
              <a href="#/start" className="ml-auto text-accent underline underline-offset-4">{t('banner.how')}</a>
            </p>
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

// "Forecast in Claude": one menu with every way in. Pick a method, copy one line, or jump straight to Claude Code.
const CLAUDE_METHODS = [
  { key: 'plugin', text: '/plugin marketplace add owaisahmad870/forewit\n/plugin install forewit@forewit' },
  { key: 'connector', text: 'https://forewit.xyz/mcp' },
  { key: 'cli', text: 'npx forewit@latest start' },
] as const;
const ico = { viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const TERMINAL = <svg {...ico}><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M4.5 6l2 2-2 2M8.5 10.5h3" /></svg>;
const PHONE = <svg {...ico}><rect x="4" y="1.5" width="8" height="13" rx="1.5" /><path d="M7 12.5h2" /></svg>;
const COPYDOC = <svg {...ico}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>;
const BOOK = <svg {...ico}><path d="M2 3h4a2 2 0 0 1 2 2v8.5A1.5 1.5 0 0 0 6.5 12H2zM14 3h-4a2 2 0 0 0-2 2v8.5A1.5 1.5 0 0 1 9.5 12H14z" /></svg>;
const CHECK = <svg {...ico}><path d="M3 8.5l3 3 7-7" /></svg>;

export function PlayInClaude() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<(typeof CLAUDE_METHODS)[number]['key']>('plugin');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const text = CLAUDE_METHODS.find((m) => m.key === method)!.text;
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  const row = 'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-surface-2';
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((x) => !x)} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[var(--claude)] px-3 text-sm font-semibold text-white hover:brightness-110">
        {TERMINAL}<span>{t('claude.button')}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label={t('claude.title')} className="fixed inset-x-4 top-16 z-30 max-h-[80vh] overflow-y-auto rounded-lg border border-line bg-surface text-left shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[28rem]">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold">{TERMINAL}{t('claude.setup')}</p>
              <a href="#/start" onClick={() => setOpen(false)} aria-label={t('claude.guide')} title={t('claude.guide')} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                <svg {...ico}><circle cx="8" cy="8" r="6.5" /><path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.3v.1" /></svg>
              </a>
            </div>
            <div role="tablist" aria-label={t('claude.setup')} className="mt-3 inline-flex rounded-md border border-line p-0.5">
              {CLAUDE_METHODS.map((m) => (
                <button key={m.key} type="button" role="tab" aria-selected={method === m.key} onClick={() => { setMethod(m.key); setCopied(false); }}
                  className={`min-h-8 rounded px-3 text-sm ${method === m.key ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:text-ink'}`}>
                  {t(`claude.m.${m.key}`)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-stretch gap-2">
              <pre className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap break-words">{text}</pre>
              <button type="button" onClick={copy} aria-label={copied ? t('ui.copied') : t('ui.copy')} title={copied ? t('ui.copied') : t('ui.copy')} className="flex w-10 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:border-[var(--claude)] hover:text-ink">{copied ? CHECK : COPYDOC}</button>
            </div>
            <p className="mt-2 text-xs text-muted">{t(`claude.hint.${method}`)}</p>
          </div>
          <div className="border-t border-line p-2">
            <a href={CLAUDE_CODE_URL} target="_blank" rel="noopener noreferrer" className={row}>{PHONE}<span>{t('claude.open')}</span></a>
            <a href={TEMPLATE_NEW_URL} target="_blank" rel="noopener noreferrer" className={row}>{COPYDOC}<span>{t('claude.template')}</span></a>
            <a href="#/start" onClick={() => setOpen(false)} className={row}>{BOOK}<span>{t('claude.guide')}</span></a>
          </div>
        </div>
      )}
    </div>
  );
}

// "?" next to a column name: hover, focus or tap shows a short explanation. The tip is fixed to the viewport so a
// scrolling table container never clips it.
export function ColHelp({ text }: { text: string }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left + r.width / 2 - 128, window.innerWidth - 264)) });
  };
  const hide = () => setAt(null);
  useEffect(() => {
    if (!at) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [at]);
  return (
    <span className="relative inline-flex align-middle" onMouseEnter={show} onMouseLeave={hide}>
      <button ref={ref} type="button" aria-label={text} aria-expanded={!!at} onClick={() => (at ? hide() : show())} onFocus={show} onBlur={hide}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] leading-none font-semibold text-muted normal-case hover:border-accent hover:text-ink">?</button>
      {at && <span role="tooltip" style={{ top: at.top, left: at.left }} className="fixed z-50 w-64 rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-[0.8rem] leading-snug font-normal tracking-normal whitespace-normal text-ink normal-case shadow-xl">{text}</span>}
    </span>
  );
}
