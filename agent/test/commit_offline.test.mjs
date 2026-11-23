// Runs `commit` and `reveal` in process against a stubbed RPC, and proves the real salt and forecast never leave the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { encodeFunctionResult, decodeFunctionData, parseAbi, keccak256, encodeAbiParameters } from 'viem';
import { main, findReceipts, COMMIT_TYPEHASH, revealCalldata } from '../prescient.mjs';
import { NETWORKS } from '../config.mjs';

const ABI = parseAbi([
  'function roundCount() view returns (uint256)',
  'struct Round { uint64 commitDeadline; uint64 revealDeadline; uint64 createdAt; uint8 questionCount; uint16 outcomeYesMask; uint16 voidMask; uint16 resolvedMask; bool baselineRevealed; bool isSealed; uint256 baselinePacked; bytes32 baselineCommit; }',
  'function getRound(uint256 roundId) view returns (Round)',
  'struct Question { bytes32 conditionId; address ctf; uint8 yesSlot; }',
  'function getQuestions(uint256 roundId) view returns (Question[])',
  'function getCommit(uint256 roundId, address forecaster) view returns (bytes32)',
  'function getReveal(uint256 roundId, address forecaster) view returns (uint256 packed, uint8 status)',
  'function computeCommitHash(uint256 roundId, address forecaster, uint256 packed, bytes32 salt) view returns (bytes32)',
]);
const FROM = '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5';
const net = NETWORKS.testnet;
const ZERO32 = '0x' + '00'.repeat(32);

/** A fake ledger: `chain.now` and `chain.commit` can be changed between calls. */
function fakeRpc(chain, bodies) {
  return async (url, init) => {
    assert.equal(url, net.rpc);
    bodies.push(init.body);
    const { method, params } = JSON.parse(init.body);
    let result;
    if (method === 'eth_chainId') result = '0x61';
    else if (method === 'eth_getBlockByNumber') result = { timestamp: '0x' + chain.now.toString(16) };
    else if (method === 'eth_call') {
      assert.equal(params[0].to, net.ledger);
      const { functionName, args } = decodeFunctionData({ abi: ABI, data: params[0].data });
      const r = {
        roundCount: () => 1n,
        getRound: () => ({ commitDeadline: 1000n, revealDeadline: 2000n, createdAt: 1n, questionCount: 2, outcomeYesMask: 0, voidMask: 0, resolvedMask: 0, baselineRevealed: false, isSealed: false, baselinePacked: 0n, baselineCommit: ZERO32 }),
        getQuestions: () => [{ conditionId: '0x' + '11'.repeat(32), ctf: FROM, yesSlot: 0 }, { conditionId: '0x' + '22'.repeat(32), ctf: FROM, yesSlot: 1 }],
        getCommit: () => chain.commit,
        getReveal: () => [0n, 0],
        computeCommitHash: () => keccak256(encodeAbiParameters(
          ['bytes32', 'uint256', 'address', 'uint256', 'address', 'uint256', 'bytes32'].map((type) => ({ type })),
          [COMMIT_TYPEHASH, 97n, net.ledger, args[0], args[1], args[2], args[3]])),
      }[functionName]();
      result = encodeFunctionResult({ abi: ABI, functionName, result: r });
    } else throw new Error('unexpected RPC method ' + method);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
  };
}

test('commit saves the salt first, never sends it, and reveal finds it', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'prescient_offline_'));
  const saved = { fetch: globalThis.fetch, log: console.log, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  const out = [];
  const bodies = [];
  const chain = { now: 500, commit: ZERO32 };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  globalThis.fetch = fakeRpc(chain, bodies);
  console.log = (...a) => out.push(a.join(' '));
  t.after(() => {
    Object.assign(globalThis, { fetch: saved.fetch });
    console.log = saved.log;
    for (const k of ['HOME', 'USERPROFILE']) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    rmSync(home, { recursive: true, force: true });
  });

  await main(['commit', '--network', 'testnet', '--from', FROM, '--p', '70,0']);
  const [receipt, ...extra] = findReceipts({ chainId: 97, roundId: 1, forecaster: FROM }, home);
  assert.equal(extra.length, 0);
  assert.deepEqual(receipt.probabilitiesBps, [7000, 100]);
  assert.match(out[0], /^Saved reveal receipt/, 'the receipt path is the first thing printed');
  assert.ok(!out.join('\n').includes(receipt.salt.slice(2)), 'salt is not printed');
  const packedWord = BigInt(receipt.packed).toString(16).padStart(64, '0');
  for (const b of bodies) {
    assert.ok(!b.toLowerCase().includes(receipt.salt.slice(2).toLowerCase()), 'salt was sent to the RPC');
    assert.ok(!b.toLowerCase().includes(packedWord), 'forecast was sent to the RPC');
  }
  const printed = out.join('\n');
  assert.ok(printed.includes(`--to ${net.ledger} --value 0 --inputData 0xf2f03877`), 'commit preview targets the pinned ledger');

  // Reveal is refused before the commit deadline.
  await assert.rejects(main(['reveal', '--network', 'testnet', '--from', FROM]), /revealing early is refused/);

  // After the deadline, with this commit onchain, reveal prints the matching calldata.
  chain.now = 1500;
  chain.commit = receipt.commitHash;
  out.length = 0;
  await main(['reveal', '--network', 'testnet', '--from', FROM]);
  assert.ok(out.join('\n').includes(revealCalldata(1, BigInt(receipt.packed), receipt.salt)));

  // A commit that is not ours has no matching receipt: refuse, explaining the forfeit.
  chain.commit = '0x' + '33'.repeat(32);
  await assert.rejects(main(['reveal', '--network', 'testnet', '--from', FROM]), /forfeit/);

  // After the reveal deadline the window is closed.
  chain.now = 2001;
  await assert.rejects(main(['reveal', '--network', 'testnet', '--from', FROM]), /closed/);
});
