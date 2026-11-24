import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { encodeAbiParameters, keccak256, toHex } from 'viem';
import { skillOf, buildLeaves, buildTree, leavesFile, fetchLogs, LEAF_TYPES } from '../scores.mjs';

// Same golden sets and roots as contracts/test/ForewitScores.t.sol (ROOT_1, ROOT_2, ROOT_3, ROOT_100)
const golden = (count) => Array.from({ length: count }, (_, k) => {
  const i = BigInt(k + 1);
  return { tokenId: BigInt(keccak256(encodeAbiParameters([{ type: 'uint256' }], [i]))), skill: (i % 2n ? -1n : 1n) * i * 1000003n, n: 3n * i };
});
const LOGS_FIXTURE_ROOT = '0xe31d80ac145c1d9963216ef18ad1eee1f666b2845b5195afe97ffc137c533775';
const ROOTS = {
  1: '0xa8aefe4bd595ae3c040fd6d9c34ebf42b8e465827b98a79cbd660163542f75e2',
  2: '0x7659df4db5c75db32c8ab9e29af22988aa64667eaff0e2958f1d8fe5ef082651',
  3: '0x0737fee60ad24766fbfe596e102c393f6263d76634c0ea7feba333b5c5562d54',
  100: '0x14c757f3523cdd50dc9f40aa75cd142fa50e43eba19dc0d9108a605275453e49',
};

test('golden trees: roots equal the Solidity constants, every proof verifies, order does not matter', () => {
  for (const [count, root] of Object.entries(ROOTS)) {
    const leaves = golden(Number(count));
    const tree = buildTree(leaves);
    assert.equal(tree.root, root);
    assert.equal(buildTree([...leaves].reverse()).root, root);
    for (const l of leaves) assert.ok(StandardMerkleTree.verify(root, LEAF_TYPES, [l.tokenId, l.skill, l.n], tree.getProof([l.tokenId, l.skill, l.n])));
  }
  assert.deepEqual(buildTree(golden(3)).getProof([golden(3)[1].tokenId, golden(3)[1].skill, golden(3)[1].n]), ['0x5f629575d2ba974d11fee90831abbbf11b6860f2744a5cf1bd223ddc3ccf78bf']);
});

test('leaf hash: double keccak of the 96 byte abi encoding, as ForewitScores.leafHash', () => {
  const [l] = golden(1);
  const inner = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'int256' }, { type: 'uint256' }], [l.tokenId, l.skill, l.n]));
  assert.equal(keccak256(inner), ROOTS[1]); // single leaf tree: root is the leaf hash
});

test('skill golden vectors (docs/SCORES.md 1.2), truncated toward zero', () => {
  assert.equal(skillOf(24_750_000n, 3n), 1_076_086n);
  assert.equal(skillOf(-250_000_000n, 3n), -10_869_565n);
  assert.equal(skillOf(0n, 0n), 0n);
  assert.equal(skillOf(-1n, 0n), 0n);
});

test('empty set: no tree; repeated tokenId refuses to build', () => {
  assert.equal(buildTree([]), null);
  const [l] = golden(1);
  assert.throws(() => buildTree([l, { ...l, skill: 1n }]), /tokenId repeats/);
});

// Log fixtures
const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const C = '0x00000000000000000000000000000000000000cc';
const K = '0x00000000000000000000000000000000000000ee'; // keeper
const id = (label) => BigInt(keccak256(toHex(label)));
let li = 0;
const log = (eventName, blockNumber, args) => ({ eventName, blockNumber: BigInt(blockNumber), logIndex: li++, args });
const scored = (b, f, questions, skillSum, baselineUsed = true, ev = 'Scored') => log(ev, b, { roundId: 1n, forecaster: f, questions: BigInt(questions), skillSum: BigInt(skillSum), baselineUsed });
const profile = (b, f, isPublic, label) => log('ProfileUpdated', b, { forecaster: f, isPublic, labelId: label ? id(label) : 0n });
const role = (b, account, ev = 'RoleGranted') => log(ev, b, { role: '0x' + '11'.repeat(32), account, sender: K });
const transfer = (b, from, to, label) => log('Transfer', b, { from, to, tokenId: id(label) });

test('option B membership: public label only, operators and moved tokens excluded, no tokenId for the excluded', () => {
  const logs = [
    role(1, K),
    profile(2, A, true, 'alice'),
    profile(2, B, true, 'bob'),
    profile(3, K, true, 'keeper'),
    scored(10, A, 3, 24_750_000),
    scored(10, B, 3, 100),
    scored(10, C, 3, 100), // never opted in
    scored(10, K, 3, 100), // operator
    scored(11, A, 4, 5, false, 'Forfeited'), // no baseline: counts nothing
    transfer(12, B, C, 'bob'), // bob's token left after opt in
  ];
  const { leaves, excluded, scored: total } = buildLeaves(logs, 20);
  assert.equal(total, 4);
  assert.deepEqual(leaves, [{ tokenId: id('alice'), forecaster: A, skill: 1_076_086n, n: 3n }]);
  assert.deepEqual(excluded, [{ forecaster: B, reason: 'moved' }, { forecaster: C, reason: 'not_public' }, { forecaster: K, reason: 'operator' }]);
  assert.ok(excluded.every((e) => Object.keys(e).join() === 'forecaster,reason'));
});

test('snapshot: logs above snapshotBlock are ignored, opt out and role revoke follow log order', () => {
  const logs = [
    role(1, K),
    profile(2, A, true, 'alice'),
    scored(10, A, 3, 300),
    profile(15, A, false, null), // opts out after the snapshot below
    scored(16, A, 3, 300),
    role(17, K, 'RoleRevoked'),
    profile(17, K, true, 'keeper'),
    scored(18, K, 1, 21),
  ];
  assert.deepEqual(buildLeaves(logs, 14).leaves, [{ tokenId: id('alice'), forecaster: A, skill: 300n / 23n, n: 3n }]);
  const late = buildLeaves(logs, 18);
  assert.deepEqual(late.leaves, [{ tokenId: id('keeper'), forecaster: K, skill: 1n, n: 1n }]);
  assert.deepEqual(late.excluded, [{ forecaster: A, reason: 'not_public' }]);
});

test('a transfer before the opt in does not exclude; one tokenId on two wallets keeps the later opt in', () => {
  const logs = [
    transfer(1, B, A, 'alice'), // reissue before A proved ownership
    profile(2, B, true, 'alice'), // stale binding, older
    profile(3, A, true, 'alice'),
    scored(10, A, 1, 21),
    scored(10, B, 1, 21),
  ];
  const r = buildLeaves(logs, 10);
  assert.deepEqual(r.leaves.map((l) => l.forecaster), [A]);
  assert.deepEqual(r.excluded, [{ forecaster: B, reason: 'moved' }]);
  assert.equal(buildTree(r.leaves).root, StandardMerkleTree.of([[id('alice'), 1n, 1n]], LEAF_TYPES).root);
});

test('leaves file carries proofs that verify against its root', () => {
  const leaves = golden(5).map((l, i) => ({ ...l, forecaster: `0x${String(i).padStart(40, '0')}` }));
  const f = leavesFile({ chainId: 97, ledger: A, agentId: B, snapshotBlock: 99n, roundId: 4n, leaves, excluded: [] });
  assert.equal(f.leafCount, 5);
  assert.equal(f.snapshotBlock, '99');
  for (const l of f.leaves) assert.ok(StandardMerkleTree.verify(f.root, LEAF_TYPES, [BigInt(l.tokenId), BigInt(l.skill), BigInt(l.n)], l.proof));
  assert.equal(leavesFile({ chainId: 97, ledger: A, agentId: B, snapshotBlock: 1n, leaves: [], excluded: [] }).root, null);
});

test('a reissue mint from zero to another wallet, with no burn log, drops the old leaf (review delta D1)', () => {
  const ZERO = '0x0000000000000000000000000000000000000000';
  const logs = [profile(2, A, true, 'alice'), scored(10, A, 1, 21), transfer(11, ZERO, C, 'alice')];
  assert.deepEqual(buildLeaves(logs, 12).excluded, [{ forecaster: A, reason: 'moved' }]);
  assert.equal(buildLeaves(logs, 10).leaves.length, 1);
});

test('a later public binding by an unscored wallet supersedes a scored one', () => {
  const logs = [profile(2, A, true, 'alice'), scored(10, A, 1, 21), profile(11, C, true, 'alice')];
  assert.deepEqual(buildLeaves(logs, 12).excluded, [{ forecaster: A, reason: 'moved' }]);
  assert.equal(buildLeaves(logs, 10).leaves.length, 1);
});

// Logs to leaves to root, end to end; contracts/test/ForewitScores.t.sol test_golden_logsFixtureRoot asserts the same root
test('logs fixture root equals the Solidity constant', () => {
  const logs = [profile(1, A, true, 'alice'), profile(1, B, true, 'bob'), scored(5, A, 3, 24_750_000), scored(5, B, 3, -250_000_000, true, 'Forfeited')];
  const { leaves } = buildLeaves(logs, 5);
  assert.deepEqual(leaves.map((l) => [l.skill, l.n]).sort((x, y) => (x[0] < y[0] ? -1 : 1)), [[-10_869_565n, 3n], [1_076_086n, 3n]]);
  assert.equal(buildTree(leaves).root, LOGS_FIXTURE_ROOT);
});

test('fetchLogs refuses a scan without the constructor RoleGranted (wrong from block or a pruning RPC)', async () => {
  const pub = { getLogs: async () => [] };
  await assert.rejects(fetchLogs({ pub, ledger: A, agentId: B, fromBlock: 1n, snapshotBlock: 10n }), /no RoleGranted/);
});
