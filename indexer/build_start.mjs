// Forewit indexer: free starts (ForewitStart, start() and mint(), once per wallet). Counted apart from forecasts: a start
// is not a forecast. Logs are cached under indexer/out/start/<contract>/ and the cache only grows.
//   node indexer/build_start.mjs [--network mainnet|testnet] [--rpc <url>]
import { bsc, bscTestnet } from 'viem/chains';
import { parseAbiItem } from 'viem';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { logsClient } from './lib/logs.mjs';
import { NETWORKS } from '../agent/config.mjs';

export const START_FROM_BLOCK = { mainnet: '135826721' }; // ForewitStart deploy block (agent/config.mjs pins the address)
const STARTED = parseAbiItem('event Started(address indexed player, uint256 indexed number, uint64 at)');

/** Pure: cached Started logs to the start section of the snapshot (oldest first). */
export function startFromLogs(contract, logs) {
  const seen = new Set();
  const players = [];
  for (const l of logs) {
    const p = l.args.player.toLowerCase();
    if (seen.has(p)) continue; // the contract allows one start per wallet; never count a duplicate log twice
    seen.add(p);
    players.push({ player: p, number: Number(l.args.number), at: Number(l.args.at), tx: l.transactionHash });
  }
  return { contract, count: players.length, players };
}

export async function buildStartSnapshot({ network = 'mainnet', rpc } = {}) {
  const contract = NETWORKS[network]?.start, fromBlock = START_FROM_BLOCK[network];
  if (!contract || !fromBlock) return null;
  const chain = network === 'testnet' ? bscTestnet : bsc;
  const pub = logsClient(chain, [rpc].flat(), [chain.id === 56 ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com']);
  const dir = `indexer/out/start/${contract}`;
  mkdirSync(dir, { recursive: true });
  const cacheFile = `${dir}/logs_cache.json`;
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : { lastBlock: String(BigInt(fromBlock) - 1n), logs: [] };
  const seen = new Set(cache.logs.map((l) => `${l.transactionHash}:${l.logIndex}`));
  const head = await pub.getBlockNumber();
  let span = 5000n;
  for (let from = BigInt(cache.lastBlock) + 1n; from <= head; ) {
    const to = from + span - 1n > head ? head : from + span - 1n;
    let got;
    try {
      got = await pub.getLogs({ address: contract, event: STARTED, fromBlock: from, toBlock: to });
    } catch (e) {
      if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
      throw e;
    }
    for (const l of got) {
      const k = `${l.transactionHash}:${l.logIndex}`;
      if (seen.has(k)) continue;
      seen.add(k);
      cache.logs.push({ blockNumber: String(l.blockNumber), logIndex: l.logIndex, transactionHash: l.transactionHash, args: { player: l.args.player, number: String(l.args.number), at: String(l.args.at) } });
    }
    cache.lastBlock = String(to);
    from = to + 1n;
  }
  cache.logs.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || a.logIndex - b.logIndex);
  writeFileSync(cacheFile, JSON.stringify(cache));
  return { headBlock: String(head), ...startFromLogs(contract, cache.logs) };
}

if (import.meta.filename === process.argv[1]) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
  const out = await buildStartSnapshot({ network: a.network ?? 'mainnet', rpc: a.rpc });
  console.log(out ? `${out.count} starts on ${out.contract}` : 'no ForewitStart pinned for this network');
}
