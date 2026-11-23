// Baseline snapshot at the commit deadline. Ledger v1.2 accepts setBaseline only in the last 15 minutes before the deadline
// (security review M1 and L4); the keeper targets about 5 minutes before it and retries inside the window.
// Pure logic with an injectable clock and book fetcher, so the timing rule is unit tested (keeper/test/baseline.test.mjs).
import { pack } from '../../scripts/golden_vectors.mjs';

export const MAX_EARLY_MS = 15 * 60 * 1000; // must equal ForecastLedger.BASELINE_WINDOW

/** True when a snapshot taken at takenAtMs is inside [deadline minus 15 minutes, deadline). */
export function snapshotTimeOk(takenAtMs, deadlineMs) {
  return takenAtMs >= deadlineMs - MAX_EARLY_MS && takenAtMs < deadlineMs;
}

/** Mid price in bps from a Predict.fun orderbook (prices refer to indexSet 1, our Yes slot 0).
 *  Fallback when one side is empty: the last settled order price; else null (caller alerts). */
export function midBps(book) {
  const bid = book.bids?.[0]?.[0], ask = book.asks?.[0]?.[0];
  if (bid !== undefined && ask !== undefined) return { bps: Math.round(((bid + ask) / 2) * 10000), source: 'mid' };
  const last = book.lastOrderSettled?.price;
  if (last !== undefined && last !== null) return { bps: Math.round(Number(last) * 10000), source: 'last_trade' };
  return null;
}

/**
 * Take the baseline for a round. Refuses if called more than 15 minutes before the deadline or at/after it,
 * and re checks the clock after the last book so a slow fetch cannot push the snapshot outside the window.
 * @param {{deadlineMs:number, marketIds:(string|number)[], fetchBook:(id)=>Promise<object>, now?:()=>number}} o
 */
export async function takeBaseline({ deadlineMs, marketIds, fetchBook, now = Date.now }) {
  const start = now();
  if (!snapshotTimeOk(start, deadlineMs)) throw new Error(`baseline refused: ${Math.round((deadlineMs - start) / 1000)} s before the deadline (allowed 0 to 900 s)`);
  const books = [];
  for (const id of marketIds) {
    const b = await fetchBook(id);
    const m = midBps(b);
    if (!m) throw new Error(`market ${id}: empty book and no last trade`);
    books.push({ marketId: String(id), ...m, takenAt: now(), updateTimestampMs: b.updateTimestampMs ?? null, raw: b });
  }
  const end = now();
  if (!snapshotTimeOk(end, deadlineMs)) throw new Error('baseline refused: snapshot finished outside the 15 minute window');
  return { packed: pack(books.map((b) => b.bps)), takenAtStart: start, takenAtEnd: end, deadlineMs, books };
}
