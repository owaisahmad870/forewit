// Agent ID Crowd method v1 (docs/CROWD.md, pre registered 23 Nov 2026). Pure; tests in indexer/test/crowd.test.mjs.
export const METHOD = 'crowd v1: log odds pooling, equal weight below 3 resolved rounds, then 0.1 + skill/mean skill, no extremizing';
export const SHRINK_K = 20, ESTABLISHED_ROUNDS = 3, FLOOR = 0.1;

const clampBps = (p) => Math.min(9900, Math.max(100, p));
const logit = (bps) => { const p = clampBps(bps) / 10000; return Math.log(p / (1 - p)); };
const toBps = (l) => Math.round(10000 / (1 + Math.exp(-l)));

/** Shrunk mean skill per question, the leaderboard score (bps squared). */
export const shrunkSkill = (rec) => Number(rec.sumSkill) / (Number(rec.baselineQuestions) + SHRINK_K);

/**
 * @param {number[][]} reveals one array of question probabilities (bps) per forecaster, same order as `records`
 * @param {{rounds:number, sumSkill:number, baselineQuestions:number}[]} records prior record per forecaster, built only from
 *   rounds resolved before this round's commit deadline
 * @param {number} n question count
 * @returns {{ bps: (number|null)[], simpleBps: (number|null)[], weights: number[] }}
 */
export function crowdV1(reveals, records, n) {
  const established = records.map((r) => Number(r.rounds) >= ESTABLISHED_ROUNDS);
  const pos = records.map(shrunkSkill).filter((s, i) => established[i] && s > 0);
  const sRef = pos.length ? pos.reduce((a, b) => a + b, 0) / pos.length : 0;
  const weights = records.map((r, i) => (!established[i] ? 1 : FLOOR + (sRef > 0 ? Math.max(0, shrunkSkill(r)) / sRef : 0)));
  const pool = (w) => Array.from({ length: n }, (_, q) => {
    let num = 0, den = 0;
    reveals.forEach((v, i) => { num += w[i] * logit(v[q]); den += w[i]; });
    return reveals.length && den > 0 ? toBps(num / den) : null;
  });
  return { bps: pool(weights), simpleBps: pool(weights.map(() => 1)), weights };
}
