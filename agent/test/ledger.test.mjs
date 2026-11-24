import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  keccak256, toHex, encodeAbiParameters, encodeFunctionData, encodeFunctionResult, parseAbi, toFunctionSelector, getAddress,
} from 'viem';
import {
  SIG, COMMIT_TYPEHASH, pack, unpack, parseProbabilities, commitHash, commitCalldata, revealCalldata, revealForCalldata,
  decodeRound, decodeQuestions, decodeReveal, outcomeOf, phaseOf, bawPreview, prepareCommit, saveReceipt, findReceipts, matchReceipt,
} from '../forewit.mjs';
import { NETWORKS } from '../config.mjs';
import { selector } from '../lib/keccak.mjs';

const ABI = parseAbi([
  'function commit(uint256 roundId, bytes32 commitHash)',
  'function reveal(uint256 roundId, uint256 packed, bytes32 salt)',
  'function revealFor(uint256 roundId, address forecaster, uint256 packed, bytes32 salt)',
  'function roundCount() view returns (uint256)',
  'struct Round { uint64 commitDeadline; uint64 revealDeadline; uint64 createdAt; uint8 questionCount; uint16 outcomeYesMask; uint16 voidMask; uint16 resolvedMask; bool baselineSet; bool isSealed; uint256 baselinePacked; uint64 resolutionWait; }',
  'function getRound(uint256 roundId) view returns (Round)',
  'struct Question { bytes32 conditionId; address ctf; uint8 yesSlot; }',
  'function getQuestions(uint256 roundId) view returns (Question[])',
  'function getCommit(uint256 roundId, address forecaster) view returns (bytes32)',
  'function getReveal(uint256 roundId, address forecaster) view returns (uint256 packed, uint8 status)',
  'function computeCommitHash(uint256 roundId, address forecaster, uint256 packed, bytes32 salt) view returns (bytes32)',
  'function setPublicProfile(bool isPublic, string label)',
]);

const GOLDEN = {
  chainId: 56,
  ledger: '0x1111111111111111111111111111111111111111',
  roundId: 7,
  forecaster: '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5',
  packed: pack([9000, 2000, 10000]),
  salt: keccak256(toHex('golden')),
};
const randAddr = () => getAddress(toHex(randomBytes(20)));
const randB32 = () => toHex(randomBytes(32));

test('golden vector: packed and commit hash', () => {
  assert.equal(COMMIT_TYPEHASH, '0xd05256df5fe0aeb27c2c0e470434c7b5edc625923ab60448c2bd569c610d4371');
  assert.equal(GOLDEN.packed, 42949804041000n);
  assert.equal(commitHash(GOLDEN), '0x343e0813665598bb9ba88edb81220fe30cefbae1b52416242dc72e11c1d192b8');
});

test('commit hash matches viem abi.encode on random inputs', () => {
  for (let i = 0; i < 25; i++) {
    const a = { chainId: 97, ledger: randAddr(), roundId: BigInt(i * 977 + 1), forecaster: randAddr(), packed: pack([1 + i, 9900, 5000]), salt: randB32() };
    const want = keccak256(encodeAbiParameters(
      ['bytes32', 'uint256', 'address', 'uint256', 'address', 'uint256', 'bytes32'].map((type) => ({ type })),
      [COMMIT_TYPEHASH, BigInt(a.chainId), a.ledger, a.roundId, a.forecaster, a.packed, a.salt],
    ));
    assert.equal(commitHash(a), want);
  }
});

test('function selectors match viem', () => {
  for (const sig of Object.values(SIG)) {
    const name = sig.slice(0, sig.indexOf('('));
    const item = ABI.find((x) => x.type === 'function' && x.name === name);
    assert.equal(selector(sig), toFunctionSelector(item), sig);
    assert.equal(encodeFunctionData({ abi: ABI, functionName: name, args: item.inputs.map((inp) => (inp.type === 'address' ? randAddr() : inp.type === 'bytes32' ? randB32() : inp.type === 'bool' ? true : inp.type === 'string' ? 'x' : 1n)) }).slice(0, 10),
      toFunctionSelector('function ' + sig));
  }
});

test('full calldata matches viem for commit, reveal and revealFor', () => {
  const salt = randB32();
  const hash = randB32();
  const who = randAddr();
  assert.equal(commitCalldata(7, hash), encodeFunctionData({ abi: ABI, functionName: 'commit', args: [7n, hash] }));
  assert.equal(revealCalldata(7, GOLDEN.packed, salt), encodeFunctionData({ abi: ABI, functionName: 'reveal', args: [7n, GOLDEN.packed, salt] }));
  assert.equal(revealForCalldata(7, who, GOLDEN.packed, salt), encodeFunctionData({ abi: ABI, functionName: 'revealFor', args: [7n, who, GOLDEN.packed, salt] }));
});

test('decoders match viem encoded results', () => {
  const round = {
    commitDeadline: 1795000000n, revealDeadline: 1795050000n, createdAt: 1794990000n, questionCount: 3,
    outcomeYesMask: 1, voidMask: 4, resolvedMask: 7, baselineSet: true, isSealed: false,
    baselinePacked: pack([6000, 5000, 5000]), resolutionWait: 604800n,
  };
  const r = decodeRound(encodeFunctionResult({ abi: ABI, functionName: 'getRound', result: round }));
  assert.equal(r.commitDeadline, 1795000000);
  assert.equal(r.revealDeadline, 1795050000);
  assert.equal(r.questionCount, 3);
  assert.equal(r.baselineSet, true);
  assert.equal(r.resolutionWait, 604800);
  assert.equal(r.isSealed, false);
  assert.equal(r.baselinePacked, round.baselinePacked);
  assert.deepEqual([0, 1, 2].map((i) => outcomeOf(r, i)), ['yes', 'no', 'void']);

  const qs = [{ conditionId: randB32(), ctf: randAddr(), yesSlot: 0 }, { conditionId: randB32(), ctf: randAddr(), yesSlot: 1 }];
  const got = decodeQuestions(encodeFunctionResult({ abi: ABI, functionName: 'getQuestions', result: qs }));
  assert.deepEqual(got, qs.map((q) => ({ ...q, ctf: q.ctf.toLowerCase() })));
  assert.deepEqual(decodeQuestions(encodeFunctionResult({ abi: ABI, functionName: 'getQuestions', result: [] })), []);

  assert.deepEqual(decodeReveal(encodeFunctionResult({ abi: ABI, functionName: 'getReveal', result: [GOLDEN.packed, 3] })), { packed: GOLDEN.packed, status: 3 });
  assert.throws(() => decodeRound('0x' + '00'.repeat(32)));
  assert.throws(() => decodeQuestions('0x' + '00'.repeat(64)));
});

test('phase follows the contract windows', () => {
  const r = { commitDeadline: 100, revealDeadline: 200 };
  assert.equal(phaseOf(r, 99), 'commit open');
  assert.equal(phaseOf(r, 100), 'reveal open'); // reveal allowed at block.timestamp == commitDeadline
  assert.equal(phaseOf(r, 200), 'reveal open');
  assert.equal(phaseOf(r, 201), 'closed');
});

test('probabilities are validated and clamped to 1% to 99%', () => {
  assert.deepEqual(parseProbabilities('72,0,100,0.4,55.55,99.5'), { bps: [7200, 100, 9900, 100, 5555, 9900], clamped: [1, 2, 3, 5] });
  for (const bad of ['', 'abc', '50,', '101', '-5', '1e2', '50;50', Array(17).fill(50).join(',')]) {
    assert.throws(() => parseProbabilities(bad), undefined, bad);
  }
  assert.throws(() => pack([10001]));
  assert.throws(() => pack([1.5]));
  assert.throws(() => pack([]));
  assert.deepEqual(unpack(GOLDEN.packed, 4), [9000, 2000, 10000, 0]);
});

test('baw preview command has the exact external sign format', () => {
  const data = commitCalldata(2, randB32());
  const from = randAddr();
  const to = NETWORKS.testnet.ledger;
  assert.equal(bawPreview({ chainId: 56, from, to, data }),
    `baw contract-call preview --binanceChainId 56 --from ${from} --to ${to} --value 0 --inputData ${data} --json`);
  assert.throws(() => bawPreview({ chainId: 56, from: 'x; rm -rf /', to, data }));
  assert.throws(() => bawPreview({ chainId: 56, from, to, data: '0xzz' }));
});

test('receipts: one file per commit, reveal picks the one matching the onchain commit', () => {
  const home = mkdtempSync(join(tmpdir(), 'forewit_receipts_'));
  try {
    const net = NETWORKS.testnet;
    const from = randAddr();
    const round = { commitDeadline: 100, revealDeadline: 200 };
    const a = prepareCommit({ net, roundId: 3, from, bps: [7000, 2000], salt: randB32(), round });
    const b = prepareCommit({ net, roundId: 3, from, bps: [6000, 3000], salt: randB32(), round });
    assert.equal(a.commitHash, commitHash({ chainId: 97, ledger: net.ledger, roundId: 3, forecaster: from, packed: pack([7000, 2000]), salt: a.salt }));
    saveReceipt(a, home);
    saveReceipt(b, home);
    writeFileSync(join(home, '.forewit', 'junk.json'), '{not json');
    const found = findReceipts({ chainId: 97, ledger: net.ledger, roundId: 3, forecaster: from.toLowerCase() }, home);
    assert.equal(found.length, 2);
    assert.equal(matchReceipt(found, a.commitHash).salt, a.salt);
    assert.equal(matchReceipt(found, b.commitHash.toUpperCase().replace('0X', '0x')).salt, b.salt);
    assert.equal(matchReceipt(found, randB32()), undefined);
    // a receipt whose salt was altered no longer matches, even if its stored hash does
    assert.equal(matchReceipt([{ ...found[0], salt: randB32() }], found[0].commitHash), undefined);
    assert.equal(findReceipts({ roundId: 4 }, home).length, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('getRound decoding also accepts the v1.1 layout with resolutionWait', () => {
  const ABI2 = parseAbi([
    'struct Round { uint64 commitDeadline; uint64 revealDeadline; uint64 createdAt; uint8 questionCount; uint16 outcomeYesMask; uint16 voidMask; uint16 resolvedMask; bool baselineSet; bool isSealed; uint256 baselinePacked; bytes32 baselineCommit; uint64 resolutionWait; }',
    'function getRound(uint256 roundId) view returns (Round)',
  ]);
  const round = { commitDeadline: 10n, revealDeadline: 20n, createdAt: 1n, questionCount: 3, outcomeYesMask: 0, voidMask: 0, resolvedMask: 0, baselineSet: false, isSealed: true, baselinePacked: 0n, baselineCommit: '0x' + 'ab'.repeat(32), resolutionWait: 604800n };
  const r = decodeRound(encodeFunctionResult({ abi: ABI2, functionName: 'getRound', result: round }));
  assert.equal(r.resolutionWait, 604800);
  assert.equal(r.isSealed, true);
});
