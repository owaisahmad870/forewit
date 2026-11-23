// Publish real data to the site: indexer snapshot + public round files (with deadline market prices from the baseline
// archive) + manifest, into web/public/data. Called by keeper.mjs after every state changing job, or by hand:
//   node indexer/publish.mjs --network testnet --ledger <address> --from-block <n> [--abi <file>] [--out web/public/data]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { buildSnapshot } from './build.mjs';
import { presentQuestion } from '../agent/lib/question.mjs';
import { meanMovePts } from './lib/flags.mjs';

export async function publish({ network = 'testnet', ledger, fromBlock, abiPath, rpc, outDir = 'web/public/data' }) {
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
  writeFileSync(`${outDir}/snapshot.json`, JSON.stringify(out, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  writeFileSync(`${outDir}/index.json`, JSON.stringify({ sample: false, network: out.network, ledger, publishedAt: out.builtAt, note: network === 'mainnet' ? 'Live data from BSC mainnet.' : 'Real BSC testnet data (test forecasters and mock markets where noted), not mainnet.', snapshot: 'snapshot.json', rounds: files }, null, 2));
  return { rounds: out.rounds.length, files: files.length };
}

if (import.meta.filename === process.argv[1]) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
  const r = await publish({ network: a.network, ledger: a.ledger, fromBlock: a['from-block'], abiPath: a.abi, rpc: a.rpc, outDir: a.out });
  console.log(`published ${r.rounds} rounds, ${r.files} round files`);
}
