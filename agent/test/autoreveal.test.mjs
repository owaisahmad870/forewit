import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sealForDeadline, ciphertextOf, openSealed, AR_MAGIC } from '../lib/autoreveal.mjs';
import { commitCalldata } from '../forewit.mjs';

const salt = '0x' + 'ab'.repeat(32);
const packed = 7000n | (3000n << 16n);

test('the sealed tail rides after the commit calldata and is found again, also inside a wrapping call', async () => {
  const { tail, drandRound } = await sealForDeadline({ packed, salt, commitDeadline: Math.floor(Date.now() / 1000) + 3600 });
  assert.ok(drandRound > 0 && tail.startsWith(AR_MAGIC));
  const data = commitCalldata(1, '0x' + '11'.repeat(32)) + tail;
  const ct = ciphertextOf(data);
  assert.match(ct, /^-----BEGIN AGE ENCRYPTED FILE-----/);
  assert.equal(ciphertextOf('0xdeadbeef' + data.slice(2) + '00'.repeat(40)), ct); // wrapped and padded
  assert.equal(ciphertextOf(commitCalldata(1, '0x' + '11'.repeat(32))), null);
  assert.equal(ciphertextOf('0x' + AR_MAGIC + '01ffff'), null); // truncated
});

test('it cannot be opened before the deadline round', { skip: !process.env.FOREWIT_NET_TESTS }, async () => {
  const { tail } = await sealForDeadline({ packed, salt, commitDeadline: Math.floor(Date.now() / 1000) + 3600 });
  await assert.rejects(openSealed(ciphertextOf('0x' + tail)), /too early/);
});

test('after the deadline round it opens to the same packed and salt', { skip: !process.env.FOREWIT_NET_TESTS }, async () => {
  const { tail } = await sealForDeadline({ packed, salt, commitDeadline: Math.floor(Date.now() / 1000) - 120 });
  assert.deepEqual(await openSealed(ciphertextOf('0x' + tail)), { packed, salt });
});
