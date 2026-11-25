// Forewit indexer v2: open forecasts (docs/OPEN_FORECASTS.md) from OpenForecasts events only. Same merged multi RPC
// log reader as v1; logs are cached per ledger under indexer/out/open/<ledger>/ and the cache only grows.
//   node indexer/build_open.mjs --ledger <address> --from-block <n> [--rpc <url>] [--network mainnet|testnet]
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { logsClient } from './lib/logs.mjs';
import { roleHolders, operators } from './lib/flags.mjs';

const big = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
const OUTCOME = ['Unresolved', 'Yes', 'No', 'Void'];
const TIMED = new Set(['Committed', 'MarketFinalized']);

/** Pure: cached logs (chain order, bigints as strings) and {block: unix seconds} to the open section of the snapshot. */
export function openFromLogs(logs, blockTimes) {
  const byId = new Map();
  const finals = {};
  const id = (a) => `${a.key}:${a.forecaster.toLowerCase()}`;
  for (const l of logs) {
    const a = l.args;
    if (l.eventName === 'Committed') {
      byId.set(id(a), {
        key: a.key, marketId: String(a.marketId), forecaster: a.forecaster.toLowerCase(), slot: Number(a.slot),
        committedAt: Number(blockTimes[l.blockNumber] ?? 0), baselineBps: null, voided: false, revealedBps: null, scored: null, finalized: null,
      }); // the sealed copy stays out of the snapshot
      continue;
    }
    if (l.eventName === 'MarketFinalized') { finals[a.key] = { slot0Outcome: OUTCOME[Number(a.slot0)], split: !!a.split, at: Number(blockTimes[l.blockNumber] ?? 0) }; continue; }
    const f = a.forecaster && byId.get(id(a));
    if (!f) continue;
    if (l.eventName === 'BaselineSet') f.baselineBps = Number(a.bps);
    if (l.eventName === 'ForecastVoided') f.voided = true;
    if (l.eventName === 'Revealed') f.revealedBps = Number(a.bps);
    if (l.eventName === 'Scored') f.scored = { brier: String(a.brier), baselineBrier: String(a.baselineBrier), skill: String(a.skill), baselineUsed: !!a.baselineUsed, forfeited: !!a.forfeited };
  }
  const forecasts = [...byId.values()].map((f) => ({ ...f, finalized: finals[f.key] ?? null }));
  // review L4: v2 role holders (keeper, admin, pauser) are operators too and are never ranked
  const ops = operators(roleHolders(logs.filter((l) => l.eventName === 'RoleGranted' || l.eventName === 'RoleRevoked').map((l) => ({ eventName: l.eventName, role: l.args.role, account: l.args.account }))));
  return { forecasts, committers: [...new Set(forecasts.map((f) => f.forecaster))], operators: ops };
}

export async function buildOpenSnapshot({ ledger, fromBlock, rpc, network = 'mainnet' }) {
  if (!ledger || fromBlock === undefined || fromBlock === '') throw new Error('ledger and fromBlock are required');
  const chain = network === 'testnet' ? bscTestnet : bsc;
  const pub = logsClient(chain, [rpc].flat(), [chain.id === 56 ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com']);
  const events = JSON.parse(readFileSync('keeper/abi/OpenForecasts_v1.json', 'utf8')).filter((x) => x.type === 'event');
  const dir = `indexer/out/open/${ledger}`;
  mkdirSync(dir, { recursive: true });
  const cacheFile = `${dir}/logs_cache.json`;
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : { lastBlock: String(BigInt(fromBlock) - 1n), logs: [], blockTimes: {} };
  const seen = new Set(cache.logs.map((l) => `${l.transactionHash}:${l.logIndex}`));
  const head = await pub.getBlockNumber();
  let span = 5000n;
  for (let from = BigInt(cache.lastBlock) + 1n; from <= head; ) {
    const to = from + span - 1n > head ? head : from + span - 1n;
    let got;
    try {
      got = await pub.getLogs({ address: ledger, events, fromBlock: from, toBlock: to });
    } catch (e) {
      if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
      throw e;
    }
    for (const l of got) {
      const k = `${l.transactionHash}:${l.logIndex}`;
      if (seen.has(k)) continue;
      seen.add(k);
      cache.logs.push(JSON.parse(JSON.stringify({ eventName: l.eventName, blockNumber: l.blockNumber, logIndex: l.logIndex, transactionHash: l.transactionHash, args: l.args }, big)));
    }
    cache.lastBlock = String(to);
    from = to + 1n;
  }
  cache.logs.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || a.logIndex - b.logIndex);
  for (const l of cache.logs) if (TIMED.has(l.eventName)) cache.blockTimes[l.blockNumber] ??= String((await pub.getBlock({ blockNumber: BigInt(l.blockNumber) })).timestamp);
  writeFileSync(cacheFile, JSON.stringify(cache));
  return { ledger, headBlock: String(head), ...openFromLogs(cache.logs, cache.blockTimes) };
}

if (import.meta.filename === process.argv[1]) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
  const out = await buildOpenSnapshot({ ledger: a.ledger, fromBlock: a['from-block'], rpc: a.rpc, network: a.network });
  console.log(`${out.forecasts.length} open forecasts from ${out.committers.length} forecasters`);
}
