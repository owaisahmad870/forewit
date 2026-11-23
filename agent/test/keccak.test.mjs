import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { keccak256 as viemKeccak, toHex } from 'viem';
import { keccak256, keccakText, bytesToHex, hexToBytes, decodeWords, wordUint, wordAddress } from '../lib/keccak.mjs';

test('keccak256 of the empty string', () => {
  assert.equal(keccakText(''), '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
});

test('keccak256 of "abc" is Ethereum keccak, not NIST SHA3', () => {
  assert.equal(keccakText('abc'), '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
});

test('keccak256 matches viem around the 136 byte block boundary and on random input', () => {
  for (const len of [1, 31, 32, 33, 135, 136, 137, 271, 272, 273, 1000]) {
    const b = new Uint8Array(randomBytes(len));
    assert.equal(bytesToHex(keccak256(b)), viemKeccak(b), `length ${len}`);
  }
  assert.equal(keccakText('golden'), viemKeccak(toHex('golden')));
});

test('hex and word helpers validate input', () => {
  assert.deepEqual([...hexToBytes('0x00ff')], [0, 255]);
  assert.throws(() => hexToBytes('0x0'));
  assert.throws(() => hexToBytes('00'));
  assert.throws(() => wordUint(-1));
  assert.throws(() => wordUint(1n << 256n));
  assert.throws(() => wordAddress('0x1234'));
  assert.throws(() => decodeWords('0x1234'));
  assert.deepEqual(decodeWords('0x' + wordUint(5) + wordUint(7)), [5n, 7n]);
});
