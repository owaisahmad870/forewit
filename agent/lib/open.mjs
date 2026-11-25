// Forewit v2 open forecasts (contracts/src/OpenForecasts.sol, rules docs/OPEN_FORECASTS.md): any binary Predict.fun
// market, any time. Shared by the CLI, the MCP server and the keeper. Market data comes from the Predict.fun API with
// the user's own key (PREDICT_API_KEY, free at https://developers.predict.fun): Forewit never redistributes it.
import { randomBytes } from 'node:crypto';
import {
  keccakText, keccakWords, encodeCall, wordUint, wordAddress, wordBytes32, bytesToHex, isAddress, isBytes32,
} from './keccak.mjs';
import { sealForDeadline, AR_MARGIN_S } from './autoreveal.mjs';
import { cleanText } from './question.mjs';

export const OPEN_SIG = Object.freeze({
  commit: 'commit(address,bytes32,uint8,uint256,bytes32,uint64,bytes)',
  reveal: 'reveal(bytes32,uint16,bytes32,address,bytes32)',
  revealFor: 'revealFor(bytes32,address,uint16,bytes32,address,bytes32)',
  forecasts: 'forecasts(bytes32,address)',
  markets: 'markets(bytes32)',
  computeCommitHash: 'computeCommitHash(address,bytes32,uint8,address,uint16,bytes32)',
  getStats: 'getStats(address)',
});
export const OPEN_TYPEHASH = keccakText(
  'ForewitOpenCommit(uint256 chainId,address ledger,address ctf,bytes32 conditionId,uint8 slot,address forecaster,uint16 bps,bytes32 salt)',
);
// Predict.fun Conditional Tokens on BSC mainnet (dev.predict.fun deployed contracts, read 25 Nov 2026)
export const CTFS = Object.freeze({
  56: { std: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', yb: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', ybnr: '0xF64b0b318AAf83BD9071110af24D24445719A07F' },
  97: { std: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743', yb: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f', ybnr: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5' },
});
export const API = Object.freeze({ 56: 'https://api.predict.fun', 97: 'https://api-testnet.predict.fun' });
export const KEY_HELP = 'needs your own Predict.fun API key: create one free at https://developers.predict.fun, then set PREDICT_API_KEY in your environment (Forewit never sees or stores it).';

export const marketKey = (ctf, conditionId) => keccakWords([wordAddress(ctf), wordBytes32(conditionId)]);

export function openCommitHash({ chainId, ledger, ctf, conditionId, slot, forecaster, bps, salt }) {
  return keccakWords([wordBytes32(OPEN_TYPEHASH), wordUint(chainId), wordAddress(ledger), wordAddress(ctf), wordBytes32(conditionId),
    wordUint(slot), wordAddress(forecaster), wordUint(bps), wordBytes32(salt)]);
}

/** commit(address,bytes32,uint8,uint256,bytes32,uint64,bytes): seven head words, then the sealed bytes (may be empty). */
export function openCommitCalldata({ ctf, conditionId, slot, marketId, commitHash, revealNotBefore = 0, sealedHex = '' }) {
  const data = sealedHex.replace(/^0x/, '');
  if (!/^([0-9a-f]{2})*$/i.test(data)) throw new Error('sealed copy is not hex');
  const len = data.length / 2;
  return encodeCall(OPEN_SIG.commit, [wordAddress(ctf), wordBytes32(conditionId), wordUint(slot), wordUint(marketId), wordBytes32(commitHash), wordUint(revealNotBefore), wordUint(224), wordUint(len)])
    + data.padEnd(Math.ceil(len / 32) * 64, '0');
}

export const openRevealCalldata = ({ key, bps, salt, ctf, conditionId }) =>
  encodeCall(OPEN_SIG.reveal, [wordBytes32(key), wordUint(bps), wordBytes32(salt), wordAddress(ctf), wordBytes32(conditionId)]);
export const openRevealForCalldata = ({ key, forecaster, bps, salt, ctf, conditionId }) =>
  encodeCall(OPEN_SIG.revealFor, [wordBytes32(key), wordAddress(forecaster), wordUint(bps), wordBytes32(salt), wordAddress(ctf), wordBytes32(conditionId)]);

/** Predict.fun REST with the user's own key (mainnet requires one; testnet does not). */
export async function predictApi(chainId, path, { key = process.env.PREDICT_API_KEY, fetchImpl = fetch } = {}) {
  if (chainId === 56 && !key) throw new Error(`browsing Predict.fun markets ${KEY_HELP}`);
  const res = await fetchImpl(((chainId !== 56 && process.env.FOREWIT_PREDICT_API) || API[chainId]) + path, { headers: chainId === 56 ? { 'x-api-key': key } : {}, signal: AbortSignal.timeout(15000) });
  if (res.status === 401 || res.status === 403) throw new Error(`Predict.fun refused the API key (HTTP ${res.status}); ${KEY_HELP}`);
  if (res.status === 429) throw new Error('Predict.fun rate limit reached for your key; wait a minute and try again');
  if (!res.ok) throw new Error(`Predict.fun API ${path.split('?')[0]}: HTTP ${res.status}`);
  return res.json();
}

export const ctfFor = (chainId, m) => {
  if (chainId === 97 && process.env.FOREWIT_TEST_CTF) return process.env.FOREWIT_TEST_CTF; // local and testnet runs only
  return !m.isYieldBearing ? CTFS[chainId].std : m.isNegRisk ? CTFS[chainId].ybnr : CTFS[chainId].yb;
};
const clean = cleanText; // one cleaner everywhere: strips controls, zero width and bidi characters

/** One market by id, with what a forecast needs: chain identifiers, the two outcomes, status and the end time. */
export async function marketInfo(chainId, marketId, opts) {
  if (!/^\d{1,18}$/.test(String(marketId))) throw new Error('market id must be a number (as shown by forewit markets)');
  const m = (await predictApi(chainId, `/v1/markets/${marketId}`, opts)).data;
  if (!m || m.outcomes?.length !== 2) throw new Error(`market ${marketId} is not a binary market; Forewit forecasts two outcome markets only`);
  // outcome i must be Conditional Tokens slot i (index sets 1 and 2), the same check the v1 selection uses
  if (m.outcomes[0]?.indexSet !== 1 || m.outcomes[1]?.indexSet !== 2) throw new Error(`market ${marketId} has an unexpected outcome layout; refusing`);
  if (!isBytes32(m.conditionId)) throw new Error(`market ${marketId} has no onchain condition yet`);
  let cat = null;
  try { cat = m.categorySlug ? (await predictApi(chainId, `/v1/categories/${m.categorySlug}`, opts)).data : null; } catch { /* end time unknown */ }
  const endsAt = Date.parse(cat?.tradingSession?.closesAt ?? cat?.endsAt ?? '') || null;
  return {
    marketId: String(m.id), conditionId: m.conditionId, ctf: ctfFor(chainId, m),
    // untrusted third party text: shown, never followed
    untrustedQuestion: clean(m.question || m.title), untrustedEvent: clean(cat?.title ?? ''),
    outcomes: m.outcomes.map((o) => clean(o.name)),
    tradingStatus: m.tradingStatus, status: m.status, endsAtMs: endsAt,
    yesPct: m.outcomes[0]?.bestBid && m.outcomes[0]?.bestAsk ? Math.round(((Number(m.outcomes[0].bestBid.price) + Number(m.outcomes[0].bestAsk.price)) / 2) * 1000) / 10 : null,
  };
}

/** Plain word search across Predict.fun markets (user's own key). */
export async function searchMarkets(chainId, query, opts) {
  const q = String(query ?? '').trim();
  if (!q || q.length > 120) throw new Error('give a search of 1 to 120 characters, for example "bitcoin 15 minute"');
  const j = await predictApi(chainId, `/v1/search?query=${encodeURIComponent(q)}&limit=20`, opts);
  return (j.data?.markets ?? []).filter((m) => m.outcomes?.length === 2 && m.status !== 'RESOLVED').map((m) => ({
    marketId: String(m.id), untrustedQuestion: clean(m.question || m.title), tradingStatus: m.tradingStatus, categorySlug: m.categorySlug,
  }));
}

/**
 * Builds an open forecast: salt, hash, optional sealed copy (drand time lock to the market's end plus a margin) and
 * calldata. Returns the receipt to save before anything is sent. `bps` is the chance for outcome `slot`.
 */
export async function prepareOpen({ chainId, ledger, forecaster, market, slot, bps, autoReveal, nowMs = Date.now() }) {
  if (!isAddress(ledger)) throw new Error('the open forecasts contract is not pinned for this network yet');
  if (!isAddress(forecaster)) throw new Error('give the wallet address with --from');
  if (slot !== 0 && slot !== 1) throw new Error('outcome must be 1 or 2');
  if (!Number.isInteger(bps) || bps < 100 || bps > 9900) throw new Error('chance must be from 1 to 99 percent');
  if (market.tradingStatus && market.tradingStatus !== 'OPEN') throw new Error(`market ${market.marketId} is not open for trading (${market.tradingStatus}); a forecast now would be void`);
  if (market.endsAtMs && market.endsAtMs <= nowMs) throw new Error(`market ${market.marketId} already ended; a forecast now would be void`);
  const salt = bytesToHex(randomBytes(32));
  const commitHash = openCommitHash({ chainId, ledger, ctf: market.ctf, conditionId: market.conditionId, slot, forecaster, bps, salt });
  let sealedHex = '';
  let revealNotBefore = 0;
  if (autoReveal) {
    // the copy opens just after the market ends; without a published end time it could open while the market still
    // trades, so auto reveal is refused then (review M3)
    if (!market.endsAtMs) throw new Error(`market ${market.marketId} publishes no end time, so auto reveal is off for it: commit without --auto-reveal and reveal yourself after it resolves`);
    const deadline = Math.floor(market.endsAtMs / 1000);
    sealedHex = (await sealForDeadline({ packed: BigInt(bps), salt, commitDeadline: deadline })).tail;
    revealNotBefore = deadline + AR_MARGIN_S;
  }
  const data = openCommitCalldata({ ctf: market.ctf, conditionId: market.conditionId, slot, marketId: market.marketId, commitHash, revealNotBefore, sealedHex });
  const key = marketKey(market.ctf, market.conditionId);
  const receipt = {
    version: 2, kind: 'open', chainId, ledger, key, marketId: market.marketId, ctf: market.ctf, conditionId: market.conditionId,
    slot, outcome: market.outcomes[slot] ?? null, bps, salt, commitHash, forecaster, autoReveal: !!autoReveal,
    endsAt: market.endsAtMs ? new Date(market.endsAtMs).toISOString() : null, opensAfter: autoReveal ? new Date(revealNotBefore * 1000).toISOString() : null,
    createdAt: new Date(nowMs).toISOString(),
  };
  return { receipt, data, key };
}

// the commit hash is in the name (as in v1), so a retry never overwrites the salt of a commit that may still land
export const openReceiptName = (r) => `open_${r.chainId}_${r.ledger.toLowerCase()}_${r.key.slice(2, 14)}_${r.forecaster.toLowerCase()}_${r.commitHash.slice(2, 14)}.json`;
