// Event logs from several RPCs at once, merged. A public RPC can answer eth_getLogs with an empty list instead of an
// error (publicnode did on 25 Nov 2026 and missed the first mainnet commit), so one provider's answer is never trusted
// alone. Required providers must all answer (a range error lets the caller halve its span); optional ones are best effort.
import { createPublicClient, http } from 'viem';

export function unionLogs(required, optional = []) {
  if (!required.length) throw new Error('unionLogs needs at least one required RPC');
  return async (params) => {
    const req = await Promise.allSettled(required.map((c) => c.getLogs(params)));
    const bad = req.find((r) => r.status === 'rejected');
    if (bad) throw bad.reason;
    const opt = await Promise.allSettled(optional.map((c) => c.getLogs(params)));
    const byKey = new Map();
    for (const r of [...req, ...opt]) if (r.status === 'fulfilled') for (const l of r.value) byKey.set(`${l.transactionHash}:${l.logIndex}`, l);
    return [...byKey.values()].sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
  };
}

/** A client whose getLogs merges every URL. Keyed URLs are required; public ones are optional unless nothing else is set. */
export function logsClient(chain, keyedUrls, publicUrls) {
  const mk = (u) => createPublicClient({ chain, transport: http(u) });
  const keyed = [...new Set(keyedUrls.filter(Boolean))].map(mk);
  const pub = [...new Set(publicUrls.filter(Boolean))].map(mk);
  const required = keyed.length ? keyed : pub;
  const head = required[0];
  return {
    getBlockNumber: () => head.getBlockNumber(),
    getBlock: (a) => head.getBlock(a),
    readContract: (a) => head.readContract(a),
    getLogs: unionLogs(required, keyed.length ? pub : []),
  };
}
