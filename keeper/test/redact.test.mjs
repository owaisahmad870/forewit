import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPublic } from '../lib/redact.mjs';

test('public alerts drop URLs and long tokens but keep tx hashes and addresses', () => {
  const tx = '0xfb1ff2078d10c78dbb76229ab9e45456bd2ac3cf5f651bdece661c0b011de826';
  const addr = '0xd11e67ff70ACD42E01d79130f280162b00Bb09B6';
  const out = redactPublic(`RPC failed https://rpc.example/v1/abcdef0123456789abcdef0123456789 key abcdEFGH1234567890abcdEFGH1234567890 tx ${tx} addr ${addr}`);
  assert.equal(out, `RPC failed <url> key <redacted> tx ${tx} addr ${addr}`);
});
