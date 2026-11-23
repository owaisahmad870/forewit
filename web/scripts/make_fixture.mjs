// Writes the clearly labelled SAMPLE dataset the site renders until real indexer output exists.
// Shapes follow indexer/build.mjs (snapshot) and keeper/keeper.mjs open (public round files).
// Fields the real pipeline does not produce yet are marked in index.json ("sampleOnlyFields").
// Round 7 uses the real mainnet daily selection archived on 23 Nov 2026 (titles from markets_raw.json categories);
// every forecast, price, outcome and score in this file is invented. Deterministic: rerun gives the same bytes.
// Run from web/: node scripts/make_fixture.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

let seed = 20261123;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
const hex = (n) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pack = (bps) => bps.reduce((acc, p, i) => acc | (BigInt(p) << BigInt(16 * i)), 0n).toString();

const NETWORK = 97;
const LEDGER = '0x5a3e00000000000000000000000000000000beef';
const CTF = '0x0d0e2a08B8eA739DD6053854837CA6E7cC271cC4';
const DAY = 86400;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Real selection, mainnet daily, commit deadline 2026-11-23T23:00Z (QUESTION_SELECTION v3)
const LIVE = [
  { marketId: '4725838', eventQuestion: 'Bitcoin Up or Down on November 24?', label: 'Bitcoin Up or Down on November 24?', endsAt: '2026-11-24T17:00:00.000Z', tags: ['Crypto', 'BTC', 'Up/Down', 'Daily'] },
  { marketId: '4725839', eventQuestion: 'Ethereum Up or Down on November 24?', label: 'Ethereum Up or Down on November 24?', endsAt: '2026-11-24T17:00:00.000Z', tags: ['Crypto', 'ETH', 'Up/Down', 'Daily'] },
  { marketId: '4725840', eventQuestion: 'BNB Up or Down on November 24?', label: 'BNB Up or Down on November 24?', endsAt: '2026-11-24T17:00:00.000Z', tags: ['Crypto', 'Up/Down', 'Daily', 'BNB'] },
  { marketId: '4746945', eventQuestion: 'SSE Composite Index (上证指数) Up or Down on November 24, 2026?', label: 'SSE Composite Index (上证指数) Up or Down on November 24, 2026?', endsAt: '2026-11-24T07:00:00.000Z', tags: ['Finance', 'Stocks', 'Daily Up/Down'] },
  { marketId: '4713046', eventQuestion: 'Highest temperature in Shenzhen on November 24?', label: '24°C', endsAt: '2026-11-24T12:00:00.000Z', tags: ['Weather'] },
  { marketId: '4746944', eventQuestion: 'UNITREE (宇树科技) Up or Down on November 24, 2026?', label: 'UNITREE (宇树科技) Up or Down on November 24, 2026?', endsAt: '2026-11-24T07:00:00.000Z', tags: ['Finance', 'Stocks', 'Daily Up/Down'] },
  { marketId: '4670592', eventQuestion: 'Miss Universe 2026 Winner?', label: 'Philippines', endsAt: '2026-11-25T04:59:00.000Z', tags: ['Culture', 'Awards'] },
  { marketId: '4713066', eventQuestion: 'Highest temperature in Shanghai on November 24?', label: '13°C', endsAt: '2026-11-24T12:00:00.000Z', tags: ['Weather'] },
];

function pastQuestions(d) {
  const md = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const end = (h) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h)).toISOString();
  return [
    { eventQuestion: `Bitcoin Up or Down on ${md}?`, label: `Bitcoin Up or Down on ${md}?`, endsAt: end(17), tags: ['Crypto', 'BTC', 'Up/Down', 'Daily'], q: [0.4, 0.6] },
    { eventQuestion: `Ethereum Up or Down on ${md}?`, label: `Ethereum Up or Down on ${md}?`, endsAt: end(17), tags: ['Crypto', 'ETH', 'Up/Down', 'Daily'], q: [0.4, 0.6] },
    { eventQuestion: `BNB Up or Down on ${md}?`, label: `BNB Up or Down on ${md}?`, endsAt: end(17), tags: ['Crypto', 'Up/Down', 'Daily', 'BNB'], q: [0.4, 0.6] },
    { eventQuestion: `SSE Composite Index (上证指数) Up or Down on ${md}, 2026?`, label: `SSE Composite Index (上证指数) Up or Down on ${md}, 2026?`, endsAt: end(7), tags: ['Finance', 'Stocks', 'Daily Up/Down'], q: [0.3, 0.7] },
    { eventQuestion: `Highest temperature in Shenzhen on ${md}?`, label: `${22 + Math.floor(rnd() * 4)}°C`, endsAt: end(12), tags: ['Weather'], q: [0.1, 0.6] },
    { eventQuestion: `Highest temperature in Shanghai on ${md}?`, label: `${11 + Math.floor(rnd() * 4)}°C`, endsAt: end(12), tags: ['Weather'], q: [0.1, 0.6] },
  ];
}

const forecasters = Array.from({ length: 36 }, (_, i) => ({ addr: `0x${hex(40)}`, skill: clamp(rnd() * 0.9 + (i < 4 ? 0.3 : 0), 0, 1), turnout: 0.3 + rnd() * 0.65 }));
const PUBLIC_NAMES = ['Sample Alpha', 'Sample Bravo', 'Sample Charlie', 'Sample Delta', 'Sample Echo', 'Sample Foxtrot', 'Sample Golf'];
forecasters.slice(0, 7).forEach((f) => (f.turnout = Math.max(f.turnout, 0.8)));
forecasters[6].turnout = 0.4; // an opted in forecaster below the ranking minimum
const profiles = Object.fromEntries(forecasters.slice(0, 7).map((f, i) => [f.addr, { isPublic: true, name: PUBLIC_NAMES[i] }]));

const rounds = [];
const roundFiles = {};
const perDay = {};
const bump = (ts, k) => { const d = new Date(ts * 1000).toISOString().slice(0, 10); (perDay[d] ??= { commits: 0, reveals: 0 })[k]++; };

for (let r = 1; r <= 7; r++) {
  const live = r === 7;
  const cd = Date.UTC(2026, 10, live ? 23 : 10 + r, 23) / 1000; // past rounds 11 to 16 Nov, fully scored; round 7 open on 23 Nov
  const rd = cd + DAY;
  const qs = live ? LIVE.map((q) => ({ ...q, q: q.tags.includes('Crypto') ? [0.42, 0.58] : [0.2, 0.8] })) : pastQuestions(new Date((cd + DAY) * 1000));
  const truth = qs.map((q) => q.q[0] + rnd() * (q.q[1] - q.q[0]));
  const market = truth.map((t) => Math.round(clamp(t + gauss() * 0.08, 0.02, 0.98) * 10000));
  const outcomes = live ? {} : Object.fromEntries(truth.map((t, i) => [String(i), r === 4 && i === 4 ? 'Void' : rnd() < t ? 'Yes' : 'No']));
  const onchainQs = qs.map((q, i) => ({ conditionId: `0x${hex(64)}`, ctf: CTF, yesSlot: 0, marketId: q.marketId ?? String(4600000 + r * 100 + i) }));
  const committers = [], revealed = [], scored = {}, forfeited = {}, forecasts = {};
  for (const f of forecasters) {
    if (rnd() > f.turnout) continue;
    committers.push(f.addr);
    bump(cd - 3600, 'commits');
    if (live) continue;
    const isRevealed = rnd() < 0.88;
    const bps = truth.map((t, i) => Math.round(clamp(market[i] / 10000 + f.skill * (t - market[i] / 10000) + gauss() * 0.12 * (1 - 0.5 * f.skill), 0.01, 0.99) * 100) * 100);
    let n = 0, brier = 0, base = 0;
    bps.forEach((p, i) => {
      const out = outcomes[i];
      if (out === 'Void') return;
      const o = out === 'Yes' ? 10000 : 0;
      n++;
      brier += isRevealed ? (p - o) ** 2 : 1e8;
      base += (market[i] - o) ** 2;
    });
    const rec = { questions: String(n), brier: String(brier), skill: String(base - brier) };
    if (isRevealed) { revealed.push(f.addr); forecasts[f.addr] = pack(bps); scored[f.addr] = rec; bump(cd + 7200, 'reveals'); } else forfeited[f.addr] = rec;
  }
  // sample crowd: equal weight mean in log odds of revealed forecasts (the real method is pending pre registration)
  const crowd = live ? null : qs.map((_, i) => {
    const xs = Object.values(forecasts).map((pk) => Number((BigInt(pk) >> BigInt(16 * i)) & 0xffffn) / 10000);
    if (!xs.length) return null;
    const m = xs.reduce((a, p) => a + Math.log(p / (1 - p)), 0) / xs.length;
    return Math.round(10000 / (1 + Math.exp(-m)));
  });
  rounds.push({
    roundId: String(r), questions: onchainQs, committers, revealed, scored, forfeited, outcomes,
    baseline: live ? null : pack(market), commitDeadline: String(cd), revealDeadline: String(rd), resolutionWait: String(7 * DAY),
    createdBlock: String(144000000 + r * 28800), commitCount: committers.length, revealRate: committers.length ? revealed.length / committers.length : null,
    forecasts, crowd: crowd && { method: 'sample: equal weight mean in log odds', bps: crowd },
  });
  if (r === 1) continue; // round 1 has no public round file: its questions must stay hidden in the UI
  roundFiles[r] = {
    network: NETWORK, ledger: LEDGER, roundId: String(r), kind: 'daily', rule: 'QUESTION_SELECTION v3',
    commitDeadline: new Date(cd * 1000).toISOString(), revealDeadline: new Date(rd * 1000).toISOString(), resolutionWaitSeconds: String(7 * DAY),
    questions: qs.map((q, i) => ({
      index: i, marketId: onchainQs[i].marketId, conditionId: onchainQs[i].conditionId, ctf: CTF, eventQuestion: q.eventQuestion, label: q.label,
      marketQuestion: null, endsAt: q.endsAt, tags: q.tags, ...(live ? { marketPrice: market[i] / 10000 } : {}),
    })),
    ...(live ? { marketPriceAt: '2026-11-23T12:00:00.000Z' } : {}),
  };
}

const all = new Set(rounds.flatMap((r) => r.committers));
const snapshot = { network: NETWORK, ledger: LEDGER, builtAt: '2026-11-23T12:00:00.000Z', headBlock: '144300000', metrics: { distinctCommitters: all.size, rounds: rounds.length, perDay }, rounds, profiles };
mkdirSync('public/data/rounds', { recursive: true });
writeFileSync('public/data/snapshot.json', JSON.stringify(snapshot, null, 1));
for (const [id, f] of Object.entries(roundFiles)) writeFileSync(`public/data/rounds/${id}.json`, JSON.stringify(f, null, 1));
writeFileSync('public/data/index.json', JSON.stringify({
  sample: true,
  note: 'Sample data for layout and tests. Round 7 titles are a real Predict.fun selection from 23 Nov 2026; all forecasts, prices, outcomes and scores are invented.',
  sampleOnlyFields: ['rounds[].forecasts', 'rounds[].crowd', 'profiles', 'round file questions[].marketPrice', 'round file marketPriceAt'],
  snapshot: 'snapshot.json',
  rounds: Object.keys(roundFiles).map((id) => `rounds/${id}.json`),
}, null, 1));
console.log(`sample: ${rounds.length} rounds, ${all.size} forecasters, ${Object.keys(roundFiles).length} round files`);
