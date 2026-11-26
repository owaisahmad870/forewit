// Publish real data to the site: indexer snapshot + public round files (with deadline market prices from the baseline
// archive) + manifest, into web/public/data. Called by keeper.mjs after every state changing job, or by hand:
//   node indexer/publish.mjs --network testnet --ledger <address> --from-block <n> [--abi <file>] [--out web/public/data]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { buildSnapshot } from './build.mjs';
import { buildOpenSnapshot } from './build_open.mjs';
import { buildStartSnapshot } from './build_start.mjs';
import { presentQuestion } from '../agent/lib/question.mjs';
import { meanMovePts } from './lib/flags.mjs';
import { marketsView } from './lib/markets.mjs';

export async function publish({ network = 'testnet', ledger, fromBlock, abiPath, rpc, outDir = 'web/public/data' }) {
  // an older markets.json may still list titles and prices (Predict.fun terms): drop it unless it is counts only
  try {
    const old = JSON.parse(readFileSync(`${outDir}/markets.json`, 'utf8'));
    if (Object.values(old.groups ?? {}).some((g) => 'top' in g) || 'markets' in old) rmSync(`${outDir}/markets.json`, { force: true });
  } catch { rmSync(`${outDir}/markets.json`, { force: true }); }
  const { out } = await buildSnapshot({ network, ledger, fromBlock, abiPath, rpc });
  mkdirSync(`${outDir}/rounds`, { recursive: true });
  const archive = `keeper/archive/${network}`;
  const files = [];
  const moves = [];
  for (const r of out.rounds) {
    const src = `${archive}/rounds/${r.roundId}.json`;
    if (!existsSync(src)) continue; // no public round file (for example harness rounds): the site hides its questions
    const file = JSON.parse(readFileSync(src, 'utf8'));
    if (String(file.ledger).toLowerCase() !== ledger.toLowerCase()) continue; // never join round files from another ledger
    file.questions.forEach((q) => presentQuestion(q)); // titles rule: refuse to publish a question without its event question
    const booksFile = `${archive}/round_${r.roundId}/baseline_books.json`;
    if (existsSync(booksFile)) {
      const books = JSON.parse(readFileSync(booksFile, 'utf8'));
      file.questions.forEach((q, i) => { if (books[i]) q.marketPrice = books[i].bps / 10000; });
      file.marketPriceAt = new Date(Math.max(...books.map((b) => Number(b.takenAt)))).toISOString();
    }
    const deadlineFile = `${archive}/round_${r.roundId}/deadline_books.json`;
    if (existsSync(booksFile) && existsSync(deadlineFile)) {
      const base = JSON.parse(readFileSync(booksFile, 'utf8')).map((b) => b.bps);
      const dl = JSON.parse(readFileSync(deadlineFile, 'utf8')).map((b) => (Number.isFinite(b.bps) ? b.bps : null));
      file.windowMovePts = meanMovePts(base, dl); // market move between the baseline snapshot and the deadline
      moves.push({ roundId: r.roundId, pts: file.windowMovePts });
    }
    writeFileSync(`${outDir}/rounds/${r.roundId}.json`, JSON.stringify(file, null, 2));
    files.push(`rounds/${r.roundId}.json`);
  }
  for (const f of readdirSync(`${outDir}/rounds`)) if (!files.includes(`rounds/${f}`)) rmSync(`${outDir}/rounds/${f}`); // drop stale or sample files
  // pre registered rule: average window move over the first 5 rounds; above 0.5 points the leaderboard flags post baseline skill
  const first5 = moves.filter((m) => m.pts !== null).sort((a, b) => Number(a.roundId) - Number(b.roundId)).slice(0, 5);
  out.metrics.windowMove = { rounds: first5.length, avgPts: first5.length ? first5.reduce((s, m) => s + m.pts, 0) / first5.length : null, thresholdPts: 0.5, active: first5.length === 5 && first5.reduce((s, m) => s + m.pts, 0) / 5 > 0.5 };
  // open forecasts (v2): only once OPEN_LEDGER and OPEN_FROM_BLOCK are set; a v2 failure never blocks the v1 snapshot
  const { OPEN_LEDGER, OPEN_FROM_BLOCK } = process.env;
  if (OPEN_LEDGER && OPEN_FROM_BLOCK) {
    try {
      out.open = await buildOpenSnapshot({ ledger: OPEN_LEDGER, fromBlock: OPEN_FROM_BLOCK, rpc, network });
      out.operators = [...new Set([...(out.operators ?? []), ...(out.open.operators ?? [])])].sort();
    } catch (e) {
      console.error(`open forecasts skipped: ${e.message}`);
    }
  }
  // free starts (ForewitStart): their own number on /proof, never mixed with forecasts; a failure never blocks the snapshot
  try {
    const st = await buildStartSnapshot({ network, rpc });
    if (st) out.start = st;
  } catch (e) {
    console.error(`starts skipped: ${e.message}`);
  }
  // ForewitScores roots the keeper posted (it writes scores/<epoch>.json next to this data): listed on /proof
  try {
    const dir = `${outDir}/scores`;
    if (existsSync(dir)) out.scoresRoots = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')))
      .sort((a, b) => Number(a.epoch) - Number(b.epoch)).map((e) => ({ epoch: String(e.epoch), roundId: String(e.roundId), root: e.root, leafCount: e.leafCount, tx: e.tx ?? null }));
  } catch (e) {
    console.error(`scores roots skipped: ${e.message}`);
  }
  // /proof counts distinct Agent ID holders across both contracts
  out.metrics.distinctCommitters = new Set([...out.rounds.flatMap((r) => r.committers.map((a) => a.toLowerCase())), ...(out.open?.committers ?? [])]).size;
  // market groups from the keeper's newest daily download: aggregate counts only (Predict.fun terms forbid redistribution)
  const days = existsSync(archive) ? readdirSync(archive).filter((d) => /_daily$/.test(d) && existsSync(`${archive}/${d}/markets_raw.json`)).sort() : [];
  // best effort: a bad or huge markets file must never block the snapshot below
  if (days.length) {
    try {
      const raw = JSON.parse(readFileSync(`${archive}/${days.at(-1)}/markets_raw.json`, 'utf8'));
      writeFileSync(`${outDir}/markets.json`, JSON.stringify(marketsView(raw.markets ?? [], { fetchedAt: raw.fetchedAt })));
    } catch (e) {
      console.error(`markets view skipped: ${e.message}`);
    }
  }
  writeFileSync(`${outDir}/snapshot.json`, JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  writeFileSync(`${outDir}/index.json`, JSON.stringify({ sample: false, network: out.network, ledger, publishedAt: out.builtAt, note: network === 'mainnet' ? 'Live data from BSC mainnet.' : 'Real BSC testnet data (test forecasters and mock markets where noted), not mainnet.', snapshot: 'snapshot.json', rounds: files }, null, 2));
  return { rounds: out.rounds.length, files: files.length };
}

if (import.meta.filename === process.argv[1]) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
  const r = await publish({ network: a.network, ledger: a.ledger, fromBlock: a['from-block'], abiPath: a.abi, rpc: a.rpc, outDir: a.out });
  console.log(`published ${r.rounds} rounds, ${r.files} round files`);
}
