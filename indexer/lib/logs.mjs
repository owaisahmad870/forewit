// Event logs from several RPCs at once, merged. A public RPC can answer eth_getLogs with an empty list instead of an
// error (publicnode did on 25 Nov 2026 and the site counted 0 committers), so one provider's answer is never trusted
// alone. Every provider is asked; a range error is thrown so the caller halves its span; otherwise the merge stands
// if at least one keyed provider answered (or, with no keyed provider configured, any provider).
import { createPublicClient, http } from 'viem';

const RANGE = /limit|range|exceed/i;

export function unionLogs(keyed, open = []) {
  const all = [...keyed, ...open];
  if (!all.length) throw new Error('unionLogs needs at least one RPC');
  return async (params) => {
    const res = await Promise.allSettled(all.map((c) => c.getLogs(params)));
    const ranged = res.find((r) => r.status === 'rejected' && RANGE.test(r.reason?.shortMessage || r.reason?.message || ''));
    if (ranged) throw ranged.reason;
    const trusted = keyed.length ? res.slice(0, keyed.length) : res;
    if (!trusted.some((r) => r.status === 'fulfilled')) throw trusted.find((r) => r.status === 'rejected').reason;
    const byKey = new Map();
    for (const r of res) if (r.status === 'fulfilled') for (const l of r.value) byKey.set(`${l.transactionHash}:${l.logIndex}`, l);
    return [...byKey.values()].sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
  };
}

/** First answer wins, in order. */
const firstOk = async (clients, fn) => {
  let err;
  for (const c of clients) {
    try { return await fn(c); } catch (e) { err = e; }
  }
  throw err;
};

/** A client whose getLogs merges every URL; other reads fall through the URLs in order. */
export function logsClient(chain, keyedUrls, publicUrls) {
  const mk = (u) => createPublicClient({ chain, transport: http(u) });
  const keyed = [...new Set(keyedUrls.filter(Boolean))].map(mk);
  const open = [...new Set(publicUrls.filter(Boolean))].map(mk);
  const all = [...keyed, ...open];
  return {
    getBlockNumber: () => firstOk(all, (c) => c.getBlockNumber()),
    getBlock: (a) => firstOk(all, (c) => c.getBlock(a)),
    readContract: (a) => firstOk(all, (c) => c.readContract(a)),
    getLogs: unionLogs(keyed, open),
  };
}
