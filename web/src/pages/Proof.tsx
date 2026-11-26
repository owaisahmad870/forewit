import { Badge, Card, Explain, NextLinks } from '../components';
import { useT } from '../i18n';
import type { Dataset, Snapshot } from '../lib/data';
import { fmtUtc } from '../lib/format';

// Fields written by indexer/publish.mjs that data.ts does not type yet. scoresRoots: ForewitScores roots the keeper posted.
type ProofSnapshot = Snapshot & {
  agentId?: string | null;
  start?: { contract: string; count: number; players: { player: string; number: number; at: number; tx: string }[] } | null;
  firstCommits?: Record<string, { tx: string | null; roundId: string; block: string }>;
  scoresRoots?: { roundId?: string | number; root: string; tx?: string | null }[];
  adminLog?: { event: string; block: string; tx: string | null; role?: string; account?: string; by?: string; newAdmin?: string }[];
};

// Network label and explorer come from the dataset's chain id only, so the page switches to mainnet with the data.
const EXPLORERS: Record<number, { url: string; key: 'mainnet' | 'testnet' }> = {
  56: { url: 'https://bscscan.com', key: 'mainnet' },
  97: { url: 'https://testnet.bscscan.com', key: 'testnet' },
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const link = 'text-accent underline underline-offset-4';

// The other submitted Forewit contracts on BSC mainnet (agent/config.mjs and gitbook/reference/addresses.md list the same).
const MAINNET_EXTRA: [string, string][] = [
  ['OpenForecasts', '0xa034D7B62d04c8c4ac57a8C62047015C00DD6404'],
  ['ForewitScores', '0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc'],
  ['ForewitStart', '0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A'],
];

export function proofFacts(snap: ProofSnapshot) {
  const seen = new Set<string>();
  const holders: { addr: string; tx: string | null; roundId: string }[] = [];
  for (const r of [...snap.rounds].sort((a, b) => Number(a.roundId) - Number(b.roundId))) {
    for (const a of r.committers.map((x) => x.toLowerCase())) {
      if (seen.has(a)) continue;
      seen.add(a);
      const first = snap.firstCommits?.[a];
      holders.push({ addr: a, tx: first?.tx ?? null, roundId: first?.roundId ?? r.roundId });
    }
  }
  // v2 open forecasts: holders who only forecast there count too (no round, so the row links the address)
  for (const a of snap.open?.committers ?? []) if (!seen.has(a)) { seen.add(a); holders.push({ addr: a, tx: null, roundId: '' }); }
  const questions = snap.rounds.reduce((s, r) => s + r.questions.length, 0);
  const outcomes = snap.rounds.flatMap((r) => Object.values(r.outcomes));
  const resolved = outcomes.filter((o) => o !== 'Unresolved').length;
  const voided = outcomes.filter((o) => o === 'Void').length;
  const ctfs = [...new Set(snap.rounds.flatMap((r) => r.questions.map((q) => q.ctf.toLowerCase())))];
  return { holders, rounds: snap.rounds.length, questions, resolved, voided, ctfs };
}

export function Proof({ data }: { data: Dataset }) {
  const { t, lang } = useT();
  const snap = data.snapshot as ProofSnapshot;
  const net = EXPLORERS[Number(snap.network)];
  const f = proofFacts(snap);
  const addr = (a: string) => (net ? `${net.url}/address/${a}` : null);
  const Addr = ({ a, label }: { a: string; label: string }) => {
    const href = addr(a);
    return (
      <div className="py-2">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="break-all font-mono text-sm">{href ? <a href={href} rel="noopener noreferrer" className={link}>{a}</a> : a}</dd>
      </div>
    );
  };
  const stat = (n: number | string, label: string) => (
    <div className="flex flex-col-reverse rounded-xl border border-line bg-surface p-4">
      <dt className="mt-1 text-sm text-muted">{label}</dt>
      <dd className="text-3xl font-semibold">{n}</dd>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t('proof.title')}</h1>
        <Badge tone={net?.key === 'mainnet' ? 'pos' : 'accent'}>{net ? t(`proof.net.${net.key}`) : t('ui.network', { id: snap.network })}</Badge>
      </div>
      <p className="max-w-[68ch]">{t('proof.intro')}</p>
      {net?.key !== 'mainnet' && <p className="max-w-[68ch] rounded-lg border border-accent bg-surface-2 p-3 font-semibold">{t('proof.testnetNote')}</p>}

      <section aria-labelledby="proof-numbers">
        <h2 id="proof-numbers" className="sr-only">{t('proof.numbers')}</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stat(f.holders.length, t('proof.holders'))}
          {snap.start && stat(snap.start.count, t('proof.started'))}
          {snap.start && stat(new Set([...f.holders.map((h) => h.addr), ...snap.start.players.map((p) => p.player)]).size, t('proof.anyContract'))}
          {stat(f.rounds, t('proof.rounds'))}
          {stat(`${f.resolved} / ${f.questions}`, t('proof.resolved', { void: f.voided }))}
        </dl>
        {snap.start && <p className="mt-2 max-w-[68ch] text-sm text-muted">{t('proof.startNote')}</p>}
        <div className="mt-2"><Explain terms={['holders', 'resolvedCount', 'void']} /></div>
      </section>

      <Card>
        <h2 className="text-lg font-semibold">{t('proof.contracts')}</h2>
        <dl className="mt-2 divide-y divide-line">
          <Addr a={snap.ledger} label="ForecastLedger" />
          {net?.key === 'mainnet' && MAINNET_EXTRA.map(([label, a]) => <Addr key={a} a={a} label={label} />)}
          {snap.agentId && <Addr a={snap.agentId} label={t('proof.agentId')} />}
          {f.ctfs.map((c) => <Addr key={c} a={c} label={t('proof.ctf')} />)}
        </dl>
        <Explain terms={['ledger', 'openForecasts', 'scores', 'startContract', 'agentId', 'ctf']} summary="help.whatTerms" />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">{t('proof.holdersTitle', { n: f.holders.length })}</h2>
        <p className="mt-1 text-sm text-muted">{t('proof.holdersNote')}</p>
        {!f.holders.length ? <p className="mt-3 text-muted">{t('proof.none')}</p> : (
          <ol className="mt-3 grid gap-x-6 sm:grid-cols-2">
            {f.holders.map((h, i) => {
              const href = h.tx && net ? `${net.url}/tx/${h.tx}` : addr(h.addr);
              const text = h.tx ? t('proof.firstCommit', { n: h.roundId }) : t('proof.addressOnly');
              return (
                <li key={h.addr} className="flex min-h-11 items-center gap-3 border-t border-line text-sm">
                  <span className="w-8 text-right text-muted">{i + 1}</span>
                  <span className="font-mono">{short(h.addr)}</span>
                  {href ? <a href={href} rel="noopener noreferrer" className={link}>{text}</a> : <span className="text-muted">{text}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {Array.isArray(snap.scoresRoots) && (
        <Card>
          <h2 className="text-lg font-semibold">{t('proof.scoresTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('proof.scoresNote')}</p>
          <ol className="mt-3 space-y-2 text-sm">
            {snap.scoresRoots.map((s, i) => (
              <li key={`${s.root}${i}`} className="break-all">
                {s.roundId != null && <span className="text-muted">{t('round.title', { n: s.roundId })} </span>}
                <span className="font-mono">{s.root}</span>
                {s.tx && net && <> <a href={`${net.url}/tx/${s.tx}`} rel="noopener noreferrer" className={link}>{t('proof.tx')}</a></>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {Array.isArray(snap.adminLog) && (
        <Card>
          <h2 className="text-lg font-semibold">{t('proof.adminTitle', { n: snap.adminLog.length })}</h2>
          <p className="mt-1 text-sm text-muted">{t('proof.adminNote')}</p>
          <ol className="mt-3 space-y-1 text-sm">
            {snap.adminLog.map((e, i) => (
              <li key={`${e.tx}${i}`} className="flex min-h-11 flex-wrap items-center gap-x-2 border-t border-line">
                <span className="font-semibold">{e.event}</span>
                {e.role && <span>{e.role}</span>}
                {(e.account ?? e.newAdmin) && <span className="font-mono">{short((e.account ?? e.newAdmin)!)}</span>}
                <span className="text-muted">{t('proof.adminBlock', { n: e.block })}</span>
                {e.tx && net && <a href={`${net.url}/tx/${e.tx}`} rel="noopener noreferrer" className={link}>{t('proof.tx')}</a>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <p className="text-sm text-muted">{t('ui.builtAt', { date: fmtUtc(new Date(snap.builtAt), lang) })}. {t('proof.rebuild')}</p>
      <NextLinks to={['start', 'rounds', 'docs']} />
    </div>
  );
}
