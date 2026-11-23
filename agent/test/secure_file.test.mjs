import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { writeSecretFile, windowsUser, windowsPrincipals, assertDedicatedDir } from '../lib/secure_file.mjs';

const WIN = process.platform === 'win32';

test('writeSecretFile leaves only the current user on the file and its directory', () => {
  const base = mkdtempSync(join(tmpdir(), 'forewit_secure_'));
  try {
    const dir = join(base, 'vault');
    const file = writeSecretFile(join(dir, 'receipt.json'), '{"salt":"0x01"}');
    assert.equal(readFileSync(file, 'utf8'), '{"salt":"0x01"}');
    assert.deepEqual(readdirSync(dir), ['receipt.json'], 'no temp files left behind');
    // overwrite is atomic and keeps the restriction
    writeSecretFile(file, 'second');
    assert.equal(readFileSync(file, 'utf8'), 'second');
    if (WIN) {
      const me = windowsUser().toLowerCase();
      for (const target of [file, dir]) {
        const principals = windowsPrincipals(target).map((p) => p.toLowerCase());
        assert.deepEqual(principals, [me], `${target} grants ${principals.join(', ')}`);
      }
    } else {
      assert.equal(statSync(file).mode & 0o777, 0o600);
      assert.equal(statSync(dir).mode & 0o777, 0o700);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// Calls the guard directly: a regression must never get as far as running icacls on the real home or temp folder.
test('the home, temp and root directories are never locked', () => {
  for (const dir of [homedir(), tmpdir(), parse(tmpdir()).root]) assert.throws(() => assertDedicatedDir(dir), /dedicated subdirectory/, dir);
  assert.doesNotThrow(() => assertDedicatedDir(join(homedir(), '.forewit')));
});
