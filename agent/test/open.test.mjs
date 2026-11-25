import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData, encodeAbiParameters, keccak256, parseAbi } from 'viem';
import { openCommitHash, openCommitCalldata, openRevealCalldata, marketKey, prepareOpen, OPEN_TYPEHASH, predictApi } from '../lib/open.mjs';

const ABI = parseAbi([
  'function commit(address ctf, bytes32 conditionId, uint8 slot, uint256 marketId, bytes32 commitHash, bytes sealedCopy)',
  'function reveal(bytes32 key, uint16 bps, bytes32 salt, address ctf, bytes32 conditionId)',
]);
const CTF = '0x22DA1810B194ca018378464a58f6Ac2B10C9d244';
const LEDGER = '0x1111111111111111111111111111111111111111';
const FROM = '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5';
const CID = '0x' + 'ab'.repeat(32);
const SALT = '0x' + '11'.repeat(32);

test('encodings match the contract ABI (viem as the reference)', () => {
  const h = '0x' + '22'.repeat(32);
  for (const sealed of ['', '46574152010003aabbcc', 'ff'.repeat(70)]) {
    assert.equal(openCommitCalldata({ ctf: CTF, conditionId: CID, slot: 1, marketId: '4752900', commitHash: h, sealedHex: sealed }),
      encodeFunctionData({ abi: ABI, functionName: 'commit', args: [CTF, CID, 1, 4752900n, h, sealed ? '0x' + sealed : '0x'] }));
  }
  const key = marketKey(CTF, CID);
  assert.equal(key, keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [CTF, CID])));
  assert.equal(openRevealCalldata({ key, bps: 7000, salt: SALT, ctf: CTF, conditionId: CID }), encodeFunctionData({ abi: ABI, functionName: 'reveal', args: [key, 7000, SALT, CTF, CID] }));
  const want = keccak256(encodeAbiParameters(['bytes32', 'uint256', 'address', 'address', 'bytes32', 'uint8', 'address', 'uint16', 'bytes32'].map((type) => ({ type })),
    [OPEN_TYPEHASH, 56n, LEDGER, CTF, CID, 1, FROM, 7000, SALT]));
  assert.equal(openCommitHash({ chainId: 56, ledger: LEDGER, ctf: CTF, conditionId: CID, slot: 1, forecaster: FROM, bps: 7000, salt: SALT }), want);
});

test('prepareOpen refuses ended or closed markets and builds a receipt with the sealed copy', async () => {
  const market = { marketId: '9', conditionId: CID, ctf: CTF, outcomes: ['Up', 'Down'], tradingStatus: 'OPEN', endsAtMs: Date.now() + 15 * 60_000 };
  const { receipt, data } = await prepareOpen({ chainId: 56, ledger: LEDGER, forecaster: FROM, market, slot: 0, bps: 6500, autoReveal: true });
  assert.equal(receipt.outcome, 'Up');
  assert.match(data, /46574152/);
  await assert.rejects(prepareOpen({ chainId: 56, ledger: LEDGER, forecaster: FROM, market: { ...market, endsAtMs: Date.now() - 1 }, slot: 0, bps: 6500 }), /already ended/);
  await assert.rejects(prepareOpen({ chainId: 56, ledger: LEDGER, forecaster: FROM, market: { ...market, tradingStatus: 'CLOSED' }, slot: 0, bps: 6500 }), /not open/);
  await assert.rejects(prepareOpen({ chainId: 56, ledger: LEDGER, forecaster: FROM, market, slot: 0, bps: 50 }), /1 to 99/);
});

test('mainnet market data needs the user\'s own key and says where to get it', async () => {
  await assert.rejects(predictApi(56, '/v1/markets/1', { key: '' }), /developers\.predict\.fun/);
});
