// Offline CLI tests: every case here fails or finishes before any network call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { prepareCommit, saveReceipt } from '../prescient.mjs';
import { NETWORKS, RISK_WARNING } from '../config.mjs';

const CLI = fileURLToPath(new URL('../prescient.mjs', import.meta.url));
const FROM = '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5';

function cli(args, home) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  return spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', timeout: 20000 });
}

test('CLI', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'prescient_cli_'));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  await t.test('help', () => {
    const r = cli([], home);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /round\s+Show the current round/);
  });

  await t.test('forecast clamps and packs, with the risk warning', () => {
    const r = cli(['forecast', '--p', '90,20,100'], home);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /question 3: 99\.00% \(9900 bps\)\s+clamped/);
    assert.match(r.stdout, new RegExp(`packed: ${(9000n | (2000n << 16n) | (9900n << 32n)).toString()} `));
    assert.ok(r.stdout.includes(RISK_WARNING));
  });

  await t.test('mainnet writes are refused while the ledger is null', () => {
    assert.equal(NETWORKS.mainnet.ledger, null);
    const r = cli(['commit', '--network', 'mainnet', '--from', FROM, '--p', '50'], home);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /mainnet ledger is not deployed/);
  });

  await t.test('bad input is rejected before any network access', () => {
    assert.match(cli(['commit', '--network', 'testnet', '--p', '50'], home).stderr, /--from/);
    assert.match(cli(['commit', '--network', 'testnet', '--from', FROM, '--p', '50,abc'], home).stderr, /percentage/);
    assert.match(cli(['commit', '--network', 'testnet', '--from', 'not_an_address', '--p', '50'], home).stderr, /--from/);
    assert.match(cli(['reveal', '--network', 'testnet', '--from', FROM, '--round', '1;ls'], home).stderr, /--round/);
    assert.match(cli(['round', '--network', 'sepolia'], home).stderr, /unknown network/);
  });

  await t.test('receipt prints saved receipts from the home directory', () => {
    const receipt = prepareCommit({ net: NETWORKS.testnet, roundId: 5, from: FROM, bps: [5000], salt: '0x' + 'ab'.repeat(32), round: null });
    saveReceipt(receipt, home);
    const r = cli(['receipt', '--from', FROM], home);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /SECRET until the commit deadline/);
    assert.ok(r.stdout.includes(receipt.salt));
    assert.ok(r.stdout.includes(receipt.commitHash));
    assert.match(cli(['receipt', '--round', '6'], home).stdout, /No receipts found/);
  });
});
