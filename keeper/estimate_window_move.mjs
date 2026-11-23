// Read only pre launch estimate of the market move inside the baseline posting window (no transactions).
// Snapshots the order book mids of a selection's markets at T minus 5 minutes and at T, then reports the mean absolute
// move in probability points. Run: node --env-file=.env keeper/estimate_window_move.mjs <selection.json> <deadline iso>
import { readFileSync } from 'node:fs';
import { midBps } from './lib/baseline.mjs';
import { meanMovePts } from '../indexer/lib/flags.mjs';

const [selFile, deadlineIso] = process.argv.slice(2);
const ids = JSON.parse(readFileSync(selFile, 'utf8')).chosen.map((c) => c.marketId);
const T = Date.parse(deadlineIso);
const book = async (id) => {
  const r = await fetch(`https://api.predict.fun/v1/markets/${id}/orderbook`, { headers: { 'x-api-key': process.env.PREDICT_API_KEY } });
  return r.ok ? midBps((await r.json()).data)?.bps ?? null : null;
};
const at = async (ms) => { const wait = ms - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); return Promise.all(ids.map(book)); };
const before = await at(T - 5 * 60 * 1000);
const after = await at(T);
const per = ids.map((id, i) => ({ id, before: before[i], after: after[i], movePts: before[i] !== null && after[i] !== null ? Math.abs(after[i] - before[i]) / 100 : null }));
console.log(JSON.stringify({ deadline: deadlineIso, markets: per.length, meanMovePts: meanMovePts(before, after), per }, null, 1));
