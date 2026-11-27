// Paper trading v1: what a revealed daily forecast would have done as a real Predict.fun taker trade.
// Simulated only. Pure functions; the rules below are pre registered in docs and never change for a past round.
//  * Entry: the keeper's order book snapshot, taken in the 5 minutes before the commit deadline (full depth).
//  * Signal: buy Yes when your chance beats the best Yes ask by MIN_EDGE or more; buy No when your No chance
//    beats the best No ask (1 minus the best Yes bid) by MIN_EDGE or more; otherwise no trade.
//  * Fill: a STAKE_USDT market buy walks the book level by level (average price and price impact are real);
//    a thin book fills partly; under MIN_ORDER_USDT filled means no trade.
//  * Fee: Predict.fun taker fee, FEE_BPS / 10000 x min(p, 1 minus p) x shares, taken in shares (dev.predict.fun/trading/fees).
//    FEE_BPS is the highest published schedule, so the estimate is conservative; referral discounts are ignored.
//  * Settle: the onchain outcome. A winning share pays 1 USDT, less REDEEM_GAS_USDT once per winning trade.
export const PAPER = {
  method: 'paper v1',
  STAKE_USDT: 10,
  MIN_EDGE: 0.05,
  FEE_BPS: 200,
  MIN_ORDER_USDT: 1,
  REDEEM_GAS_USDT: 0.01,
  MIN_TRADES_TO_JUDGE: 20,
};

/** Walks ascending ask levels [[price, shares], ...] with a USDT budget. */
export function walkBuy(levels, usdt) {
  let left = usdt, shares = 0;
  for (const [price, size] of levels) {
    if (left <= 1e-9) break;
    if (!(price > 0 && price < 1) || !(size > 0)) continue;
    const take = Math.min(size, left / price);
    shares += take;
    left -= take * price;
  }
  const spent = usdt - left;
  return { spent, shares, avgPrice: shares > 0 ? spent / shares : null };
}

/** Asks for one side. Book prices refer to the Yes outcome; a No buy takes the Yes bids at 1 minus their price. */
export function sideAsks(book, side) {
  const num = (l) => [Number(l[0]), Number(l[1])];
  if (side === 'Yes') return (book.asks ?? []).map(num).sort((a, b) => a[0] - b[0]);
  return (book.bids ?? []).map(num).map(([p, s]) => [1 - p, s]).sort((a, b) => a[0] - b[0]);
}

/**
 * One paper trade. youBps: your revealed chance of Yes in bps. outcome: 'Yes' | 'No' | 'Void' | 'Unresolved'.
 * Returns null when there is no trade, otherwise the fill and, once resolved, the result.
 */
export function paperTrade({ youBps, book, outcome, p = PAPER }) {
  if (!book || youBps == null) return null;
  const you = youBps / 10000;
  const yesAsks = sideAsks(book, 'Yes'), noAsks = sideAsks(book, 'No');
  const edgeYes = yesAsks.length ? you - yesAsks[0][0] : -1;
  const edgeNo = noAsks.length ? (1 - you) - noAsks[0][0] : -1;
  const side = edgeYes >= p.MIN_EDGE - 1e-9 && edgeYes >= edgeNo ? 'Yes' : edgeNo >= p.MIN_EDGE - 1e-9 ? 'No' : null;
  if (!side) return { side: null, reason: 'no_edge' };
  const fill = walkBuy(side === 'Yes' ? yesAsks : noAsks, p.STAKE_USDT);
  if (fill.spent < p.MIN_ORDER_USDT) return { side, reason: 'too_thin' };
  const feeShares = (p.FEE_BPS / 10000) * Math.min(fill.avgPrice, 1 - fill.avgPrice) * fill.shares / fill.avgPrice;
  const netShares = fill.shares - feeShares;
  const t = {
    side,
    edgePts: round2((side === 'Yes' ? edgeYes : edgeNo) * 100),
    spent: round2(fill.spent),
    avgPrice: round4(fill.avgPrice),
    bestPrice: round4((side === 'Yes' ? yesAsks : noAsks)[0][0]),
    shares: round2(netShares),
    feeUsdt: round2(feeShares * fill.avgPrice),
    partial: fill.spent < p.STAKE_USDT - 1e-6,
  };
  if (outcome === 'Yes' || outcome === 'No') {
    const won = outcome === side;
    t.payout = round2(won ? netShares - p.REDEEM_GAS_USDT : 0);
    t.pnl = round2(t.payout - t.spent);
  } else if (outcome === 'Void') {
    t.pnl = 0; // a void market refunds at cost in this model
    t.payout = t.spent;
  }
  return t;
}

/** Totals for one forecaster with a 90% bootstrap range of ROI (seeded, so every rebuild shows the same range). */
export function summarize(trades, p = PAPER) {
  const done = trades.filter((t) => t && t.side && typeof t.pnl === 'number');
  const staked = done.reduce((s, t) => s + t.spent, 0);
  const pnl = done.reduce((s, t) => s + t.pnl, 0);
  const out = { trades: done.length, open: trades.filter((t) => t && t.side && typeof t.pnl !== 'number' && t.reason == null).length, staked: round2(staked), pnl: round2(pnl), roi: staked ? round4(pnl / staked) : null, wins: done.filter((t) => t.pnl > 0).length, roiLow: null, roiHigh: null, enough: done.length >= p.MIN_TRADES_TO_JUDGE };
  if (done.length >= 2) {
    const rnd = mulberry32(done.length * 7919 + Math.round(staked * 100));
    const rois = [];
    for (let b = 0; b < 2000; b++) {
      let s = 0, n = 0;
      for (let i = 0; i < done.length; i++) { const t = done[Math.floor(rnd() * done.length)]; s += t.pnl; n += t.spent; }
      rois.push(n ? s / n : 0);
    }
    rois.sort((a, b) => a - b);
    out.roiLow = round4(rois[Math.floor(0.05 * rois.length)]);
    out.roiHigh = round4(rois[Math.floor(0.95 * rois.length) - 1]);
  }
  return out;
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const round2 = (x) => Math.round(x * 100) / 100;
const round4 = (x) => Math.round(x * 10000) / 10000;
