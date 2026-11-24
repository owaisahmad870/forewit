// ForewitScores v1 (docs/SCORES.md): leaves and Merkle root from ForecastLedger and Agent ID logs only, option B membership
// (only forecasters whose last ProfileUpdated is public with a label). Anyone can rerun it:
//   build:     node indexer/scores.mjs build --network testnet|mainnet --ledger <address> [--from-block <n>] [--snapshot-block <n>] [--round-id <n>] [--out <file>] [--rpc <url>]
//   recompute: node indexer/scores.mjs recompute --network testnet|mainnet --scores <address> [--from-block <n>] [--epoch <n>] [--file <leaves.json>] [--rpc <url>]
// recompute reads the epoch onchain, rebuilds every leaf from logs up to its snapshotBlock and exits 0 only on an exact root match.
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { createPublicClient, http, parseAbi } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { roleHolders, operators } from './lib/flags.mjs';

export const SHRINK_K = 20n;
export const LEAF_TYPES = ['uint256', 'int256', 'uint256'];
export const METHOD = 'forewit scores v1: skill = sumSkill / (baselineQuestions + 20), truncated toward zero';
// ForecastLedger deploy blocks: scans start here so the constructor's RoleGranted logs are seen (operators get no leaf)
export const FROM_BLOCK = { mainnet: 135450390n };
export const LEDGER_EVENTS = parseAbi([
  'event Scored(uint256 indexed roundId, address indexed forecaster, uint256 questions, uint256 brierSum, uint256 baselineBrierSum, int256 skillSum, bool baselineUsed)',
  'event Forfeited(uint256 indexed roundId, address indexed forecaster, uint256 questions, uint256 brierSum, uint256 baselineBrierSum, int256 skillSum, bool baselineUsed)',
  'event ProfileUpdated(address indexed forecaster, bool isPublic, uint256 labelId)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
]);
const TRANSFER = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'])[0];
const SCORES_ABI = parseAbi([
  'function LEDGER() view returns (address)',
  'function AGENT_ID() view returns (address)',
  'function latestEpoch() view returns (uint256)',
  'function getEpoch(uint256) view returns ((bytes32 root, uint64 snapshotBlock, uint64 roundId, uint32 leafCount, uint48 postedAt, bool revoked))',
]);
const LEDGER_ABI = parseAbi(['function AGENT_ID() view returns (address)']);

/** skill = sumSkill / (n + 20); BigInt division truncates toward zero exactly like Solidity int256 division. */
export const skillOf = (sumSkill, n) => BigInt(sumSkill) / (BigInt(n) + SHRINK_K);

const pos = (l) => [BigInt(l.blockNumber), BigInt(l.logIndex ?? 0)];
const before = (a, b) => { const [x, y] = [pos(a), pos(b)]; return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]); };

/**
 * Pure: logs [{eventName, blockNumber, logIndex, args}] (ledger events plus Agent ID Transfer) to leaves and exclusions.
 * Every log above snapshotBlock is ignored. Reasons: operator, not_public, moved. No tokenId is ever written for an
 * excluded forecaster. One tokenId bound by several wallets (scored or not): the latest ProfileUpdated proved ownerOf,
 * so only that wallet can hold the leaf; earlier binders are excluded as moved.
 */
export function buildLeaves(logs, snapshotBlock) {
  const snap = BigInt(snapshotBlock);
  const L = logs.filter((l) => BigInt(l.blockNumber) <= snap).sort((a, b) => (before(a, b) ? -1 : before(b, a) ? 1 : 0));
  const ops = new Set(operators(roleHolders(L.filter((l) => l.eventName === 'RoleGranted' || l.eventName === 'RoleRevoked').map((l) => ({ eventName: l.eventName, role: l.args.role, account: l.args.account })))));
  const stats = {}; // forecaster to {sumSkill, n}
  const profile = {}; // forecaster to its last ProfileUpdated log
  const transfers = [];
  for (const l of L) {
    if (l.eventName === 'Scored' || l.eventName === 'Forfeited') {
      const s = (stats[l.args.forecaster.toLowerCase()] ??= { sumSkill: 0n, n: 0n });
      if (l.args.baselineUsed) { s.sumSkill += BigInt(l.args.skillSum); s.n += BigInt(l.args.questions); }
    } else if (l.eventName === 'ProfileUpdated') profile[l.args.forecaster.toLowerCase()] = l;
    else if (l.eventName === 'Transfer') transfers.push(l);
  }
  // latest live binding per labelId over every wallet, scored or not: a later proven ownerOf supersedes an earlier one
  const binder = {};
  for (const [f, p] of Object.entries(profile)) {
    if (!p.args.isPublic || BigInt(p.args.labelId) === 0n) continue;
    const key = BigInt(p.args.labelId).toString();
    if (!binder[key] || before(binder[key].p, p)) binder[key] = { f, p };
  }
  const excluded = [];
  const byToken = {}; // tokenId to forecaster
  for (const f of Object.keys(stats).sort()) {
    const p = profile[f];
    if (ops.has(f)) { excluded.push({ forecaster: f, reason: 'operator' }); continue; }
    if (!p || !p.args.isPublic || BigInt(p.args.labelId) === 0n) { excluded.push({ forecaster: f, reason: 'not_public' }); continue; }
    const tokenId = BigInt(p.args.labelId);
    const moved = binder[tokenId.toString()].f !== f || transfers.some((t) => BigInt(t.args.tokenId) === tokenId && t.args.from.toLowerCase() === f && before(p, t));
    if (moved) { excluded.push({ forecaster: f, reason: 'moved' }); continue; }
    byToken[tokenId.toString()] = { f };
  }
  const leaves = Object.entries(byToken).map(([tokenId, { f }]) => ({ tokenId: BigInt(tokenId), forecaster: f, skill: skillOf(stats[f].sumSkill, stats[f].n), n: stats[f].n }));
  leaves.sort((a, b) => (a.tokenId < b.tokenId ? -1 : 1));
  excluded.sort((a, b) => (a.forecaster < b.forecaster ? -1 : 1));
  return { leaves, excluded, scored: Object.keys(stats).length };
}

/** StandardMerkleTree over [tokenId, skill, n]; null for an empty set (the keeper then skips the post). */
export function buildTree(leaves) {
  if (!leaves.length) return null;
  const seen = new Set();
  for (const l of leaves) {
    if (seen.has(l.tokenId)) throw new Error(`tokenId repeats: ${l.tokenId}`);
    seen.add(l.tokenId);
  }
  return StandardMerkleTree.of(leaves.map((l) => [l.tokenId, l.skill, l.n]), LEAF_TYPES);
}

/** Leaves file (docs/SCORES.md section 5); epoch is null until the keeper has posted. */
export function leavesFile({ chainId, ledger, scores = null, agentId, epoch = null, roundId = null, snapshotBlock, leaves, excluded }) {
  const tree = buildTree(leaves);
  const s = (v) => (v === null || v === undefined ? null : v.toString());
  return {
    chainId, ledger, scores, agentId, epoch: s(epoch), roundId: s(roundId), snapshotBlock: s(snapshotBlock), method: METHOD,
    root: tree ? tree.root : null,
    leafCount: leaves.length,
    leaves: leaves.map((l) => ({ tokenId: l.tokenId.toString(), forecaster: l.forecaster, skill: l.skill.toString(), n: l.n.toString(), proof: tree.getProof([l.tokenId, l.skill, l.n]) })),
    excluded,
  };
}

// Chain access (thin): logs in chunks that halve on range errors, like indexer/build.mjs

async function chunkedLogs(pub, query, from, to) {
  const out = [];
  let span = 5000n;
  for (let a = from; a <= to; ) {
    const b = a + span - 1n > to ? to : a + span - 1n;
    try {
      out.push(...(await pub.getLogs({ ...query, fromBlock: a, toBlock: b })));
    } catch (e) {
      if (span > 50n && /limit|range|exceed/i.test(e.shortMessage || e.message)) { span /= 2n; continue; }
      throw e;
    }
    a = b + 1n;
  }
  return out;
}

export async function fetchLogs({ pub, ledger, agentId, fromBlock, snapshotBlock }) {
  const from = BigInt(fromBlock), to = BigInt(snapshotBlock);
  const ledgerLogs = await chunkedLogs(pub, { address: ledger, events: LEDGER_EVENTS }, from, to);
  // the constructor grants roles, so a scan from the deploy block always sees RoleGranted; none means a wrong
  // from block or an RPC that silently drops old logs (bsc-testnet-rpc.publicnode.com did, 24 Nov 2026)
  if (!ledgerLogs.some((l) => l.eventName === 'RoleGranted')) throw new Error('no RoleGranted log from the from block: start at the ledger deploy block, or the RPC is pruning old logs');
  const tokenIds = [...new Set(ledgerLogs.filter((l) => l.eventName === 'ProfileUpdated' && l.args.labelId !== 0n).map((l) => l.args.labelId))];
  const transfers = tokenIds.length ? await chunkedLogs(pub, { address: agentId, event: TRANSFER, args: { tokenId: tokenIds } }, from, to) : [];
  return [...ledgerLogs, ...transfers.map((t) => ({ ...t, eventName: 'Transfer' }))];
}

export function client(network, rpc) {
  const chain = network === 'mainnet' ? bsc : bscTestnet;
  return createPublicClient({ chain, transport: http(rpc || (chain.id === 56 ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com')) });
}

/** Latest finalized block; fallback head minus 15 when the RPC lacks the tag (docs/SCORES.md 2.1, hypothesis). */
export async function finalizedBlock(pub) {
  try {
    return (await pub.getBlock({ blockTag: 'finalized' })).number;
  } catch {
    return (await pub.getBlockNumber()) - 15n;
  }
}

export async function build({ network = 'testnet', ledger, fromBlock, snapshotBlock, roundId, rpc }) {
  const pub = client(network, rpc);
  const from = fromBlock ?? FROM_BLOCK[network];
  if (!ledger || from === undefined) throw new Error('ledger and from-block are required');
  const agentId = await pub.readContract({ address: ledger, abi: LEDGER_ABI, functionName: 'AGENT_ID' });
  const snap = snapshotBlock !== undefined ? BigInt(snapshotBlock) : await finalizedBlock(pub);
  const logs = await fetchLogs({ pub, ledger, agentId, fromBlock: from, snapshotBlock: snap });
  const { leaves, excluded } = buildLeaves(logs, snap);
  return leavesFile({ chainId: pub.chain.id, ledger, agentId, roundId, snapshotBlock: snap, leaves, excluded });
}

export async function recompute({ network = 'testnet', scores, fromBlock, epoch, file, rpc }) {
  const pub = client(network, rpc);
  const read = (functionName, args = []) => pub.readContract({ address: scores, abi: SCORES_ABI, functionName, args });
  const ledger = await read('LEDGER');
  const agentId = await read('AGENT_ID');
  const id = epoch !== undefined ? BigInt(epoch) : await read('latestEpoch');
  if (id === 0n) throw new Error('no epoch posted yet');
  const e = await read('getEpoch', [id]);
  const from = fromBlock ?? FROM_BLOCK[network];
  if (from === undefined) throw new Error('from-block is required on this network');
  const logs = await fetchLogs({ pub, ledger, agentId, fromBlock: from, snapshotBlock: e.snapshotBlock });
  const { leaves, excluded, scored } = buildLeaves(logs, e.snapshotBlock);
  const tree = buildTree(leaves);
  const root = tree ? tree.root : null;
  const checks = {
    rootMatches: root === e.root,
    leafCountMatches: leaves.length === Number(e.leafCount),
    accounted: scored === leaves.length + excluded.length,
  };
  if (file) checks.fileMatches = JSON.parse(readFileSync(file, 'utf8')).root === e.root;
  return { epoch: id, onchain: e, root, leafCount: leaves.length, excluded: excluded.length, checks, ok: Object.values(checks).every(Boolean) };
}

if (import.meta.filename === process.argv[1]) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = Object.fromEntries(rest.reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
  const opt = { network: args.network, rpc: args.rpc, fromBlock: args['from-block'] };
  if (cmd === 'build') {
    const out = await build({ ...opt, ledger: args.ledger, snapshotBlock: args['snapshot-block'], roundId: args['round-id'] });
    const path = args.out || `indexer/out/${args.network || 'testnet'}/${args.ledger}/scores_${out.snapshotBlock}.json`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(out, null, 2));
    console.log(`snapshot ${out.snapshotBlock}: ${out.leafCount} leaves, ${out.excluded.length} excluded, root ${out.root ?? 'none (empty set, do not post)'} -> ${path}`);
  } else if (cmd === 'recompute') {
    const r = await recompute({ ...opt, scores: args.scores, epoch: args.epoch, file: args.file });
    console.log(JSON.stringify({ epoch: r.epoch.toString(), onchainRoot: r.onchain.root, root: r.root, snapshotBlock: r.onchain.snapshotBlock.toString(), revoked: r.onchain.revoked, leafCount: r.leafCount, excluded: r.excluded, checks: r.checks }, null, 2));
    console.log(r.ok ? 'RECOMPUTE OK' : 'RECOMPUTE MISMATCH');
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error('usage: node indexer/scores.mjs build|recompute (see the header)');
    process.exit(2);
  }
}
