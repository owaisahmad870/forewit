import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, parseAbi } from 'viem';
import { profileCalldata } from '../forewit.mjs';

const abi = parseAbi(['function setPublicProfile(bool isPublic, string label)']);
const CLI = fileURLToPath(new URL('../forewit.mjs', import.meta.url));
const FROM = '0x4Db416bAF0127AdCa78e7571038b763868ff282C';

test('profile calldata equals viem for short, 32 byte and longer labels, and opt out', () => {
  for (const [on, label] of [[true, 'owaisahmad'], [true, 'a'.repeat(32)], [true, 'b'.repeat(45)], [false, '']]) {
    assert.equal(profileCalldata(on, label), encodeFunctionData({ abi, functionName: 'setPublicProfile', args: [on, label] }));
  }
});

test('profile dry run strips .ai, refuses a bad label, never sends without --execute', () => {
  const ok = spawnSync(process.execPath, [CLI, 'profile', '--network', 'mainnet', '--from', FROM, '--label', 'OwaisAhmad.ai'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Dry run: nothing was sent/);
  assert.ok(ok.stdout.includes(profileCalldata(true, 'owaisahmad')));
  const bad = spawnSync(process.execPath, [CLI, 'profile', '--network', 'mainnet', '--from', FROM, '--label', 'bad name!'], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /--label/);
});
