// Execute mode against a fake baw (test/fixtures/fake_baw.mjs). The real baw is never started by these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FAKE = fileURLToPath(new URL('./fixtures/fake_baw.mjs', import.meta.url));
process.env.FOREWIT_BAW_BIN = FAKE; // set before anything can run baw
const dir = mkdtempSync(join(tmpdir(), 'forewit_exec_'));
process.env.FAKE_BAW_LOG = join(dir, 'calls.jsonl');

const { sendWithConfirmation, bawCommand, parsedCall, checkPreview } = await import('../lib/baw.mjs');
const { commitCalldata } = await import('../forewit.mjs');

const FROM = '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5';
const NET = Object.freeze({ name: 'mainnet', chainId: 56, ledger: '0x1111111111111111111111111111111111111111', explorer: 'https://bscscan.com' });
const DATA = commitCalldata(3, '0x' + 'cd'.repeat(32));

async function run(scenario, { answer = 'yes', tty = true, net = NET } = {}) {
  rmSync(process.env.FAKE_BAW_LOG, { force: true });
  process.env.FAKE_BAW_SCENARIO = scenario;
  const out = [];
  const asked = [];
  const io = { isTTY: () => tty, ask: async (p) => { asked.push(p); return answer; }, log: (...l) => out.push(...l) };
  let result, error;
  try {
    result = await sendWithConfirmation({ net, from: FROM, data: DATA, what: 'commit for round 3', io });
  } catch (e) {
    error = e;
  }
  const calls = existsSync(process.env.FAKE_BAW_LOG)
    ? readFileSync(process.env.FAKE_BAW_LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  const verbs = calls.map((c) => c.slice(0, 2).join(' '));
  return { result, error, calls, verbs, out: out.join('\n'), asked };
}
const executed = (r) => r.verbs.includes('contract-call execute');

test('execute mode', async (t) => {
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  await t.test('the resolver runs the fake through node, never through a shell', () => {
    assert.deepEqual(bawCommand(), { file: process.execPath, pre: [FAKE] });
  });

  await t.test('happy path: preflight, exact preview, typed yes, exact execute, txHash', async () => {
    const r = await run('happy');
    assert.equal(r.error, undefined, r.error?.message);
    assert.equal(r.result, 'BROADCASTED');
    assert.deepEqual(r.verbs, ['wallet status', 'wallet agent-id', 'wallet settings', 'wallet tx-lock', 'wallet tx-history', 'contract-call preview', 'contract-call execute']);
    assert.deepEqual(r.calls[3], ['wallet', 'tx-lock', '--binanceChainId', '56', '--json']);
    assert.deepEqual(r.calls[4], ['wallet', 'tx-history', '--type', 'pending', '--binanceChainId', '56', '--json']);
    assert.deepEqual(r.calls[5], ['contract-call', 'preview', '--binanceChainId', '56', '--from', FROM, '--to', NET.ledger, '--value', '0', '--inputData', DATA, '--json']);
    assert.deepEqual(r.calls[6], ['contract-call', 'execute', '--requestId', 'req_123', '--json']);
    assert.ok(r.calls.every((c) => !c.some((a) => /gas/i.test(a))), 'no gas flags');
    assert.equal(r.asked.length, 1);
    assert.match(r.out, /parsedTx:[\s\S]*simulationCode: 000000000[\s\S]*risks:\n\s+none reported/);
    assert.ok(r.out.includes('0x' + 'ab'.repeat(32)));
  });

  await t.test('PENDING_CONFIRMATION: approve in the App, never resend', async () => {
    const r = await run('pending');
    assert.equal(r.result, 'PENDING_CONFIRMATION');
    assert.equal(r.verbs.filter((v) => v === 'contract-call execute').length, 1);
    assert.match(r.out, /approve this transaction in the Binance App/);
    assert.match(r.out, /never resend/);
  });

  for (const [scenario, re] of [
    ['preview351802', /351802: Developer Mode is off/],
    ['preview351804', /351804: Developer Mode is off/],
    ['preview351803', /351803: risk blocked.*never works around/],
    ['preview351805', /351805: the simulation failed/],
  ]) {
    await t.test(`${scenario} stops before execute`, async () => {
      const r = await run(scenario);
      assert.match(r.error?.message ?? '', re);
      assert.match(r.error.message, /Nothing was sent/);
      assert.ok(!executed(r));
      assert.equal(r.asked.length, 0, 'no yes is asked for a failed preview');
    });
  }

  for (const [scenario, re] of [
    ['execute351802', /351802: Developer Mode/],
    ['execute351803', /351803: risk blocked/],
    ['execute351805', /351805: the simulation failed/],
    ['garbage', /unknown or unreadable result/],
  ]) {
    await t.test(`${scenario} at execute: explain, never resend, point at pending checks`, async () => {
      const r = await run(scenario);
      assert.match(r.error?.message ?? '', re);
      assert.match(r.error.message, /Do not resend.*tx-history --type pending.*tx-lock/);
      assert.equal(r.verbs.filter((v) => v === 'contract-call execute').length, 1);
    });
  }

  for (const [scenario, re] of [
    ['wrongto', /target .* is not the pinned ledger/],
    ['wrongdata', /function selector is missing or differs/],
    ['nodata', /function selector is missing or differs/],
    ['value', /balance, allowance or authority change, so value is not 0/],
    ['notcall', /transaction type Send is not ContractInteraction/],
  ]) {
    await t.test(`a preview with ${scenario} is refused`, async () => {
      const r = await run(scenario);
      assert.match(r.error?.message ?? '', re);
      assert.match(r.error.message, /parsedTx fields: transactionType, (action, )?contractAddress/);
      assert.ok(!executed(r));
      assert.equal(r.asked.length, 0);
    });
  }

  await t.test('Developer Mode off, wallet locked or a pending transaction: refuse before preview', async () => {
    for (const [scenario, re] of [['devoff', /Developer Mode is off/], ['locked', /wallet is locked/], ['busy', /pending transaction/]]) {
      const r = await run(scenario);
      assert.match(r.error?.message ?? '', re);
      assert.ok(!r.verbs.includes('contract-call preview'), scenario);
    }
  });

  await t.test('non TTY stdin is refused before baw runs', async () => {
    const r = await run('happy', { tty: false });
    assert.match(r.error?.message ?? '', /not a TTY/);
    assert.equal(r.calls.length, 0);
  });

  await t.test('anything other than yes aborts', async () => {
    for (const answer of ['no', 'y', 'YES', 'yes please', '', null]) {
      const r = await run('happy', { answer });
      assert.match(r.error?.message ?? '', /aborted/, String(answer));
      assert.ok(!executed(r));
    }
  });

  await t.test('a preview that expired while waiting for yes is not executed', async () => {
    const r = await run('expired');
    assert.match(r.error?.message ?? '', /expired/);
    assert.ok(!executed(r));
  });

  await t.test('only chain 56 with a pinned ledger', async () => {
    for (const net of [{ ...NET, chainId: 97, name: 'testnet' }, { ...NET, ledger: null }]) {
      const r = await run('happy', { net });
      assert.match(r.error?.message ?? '', /--execute needs BSC mainnet/);
      assert.equal(r.calls.length, 0);
    }
  });

  await t.test('parsedTx field mapping', () => {
    assert.deepEqual(parsedCall({ transactionType: 'ContractInteraction', contractAddress: '0xa', action: '0x12345678' }), { type: 'ContractInteraction', to: '0xa', selector: '0x12345678' });
    assert.deepEqual(parsedCall(undefined), { type: undefined, to: undefined, selector: undefined });
  });

  await t.test('the real mainnet preview reply passes checkPreview unchanged', () => {
    const { reply } = JSON.parse(readFileSync(new URL('./fixtures/baw_preview_contract_call.json', import.meta.url), 'utf8'));
    const data = '0x70a08231' + '00'.repeat(12) + '4db416baf0127adca78e7571038b763868ff282c';
    assert.doesNotThrow(() => checkPreview(reply.data, { ledger: '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', data }));
    assert.throws(() => checkPreview(reply.data, { ledger: '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', data: '0xdeadbeef' }), /selector/);
  });

  await t.test('the CLI refuses a piped yes and a null mainnet ledger without running baw', () => {
    rmSync(process.env.FAKE_BAW_LOG, { force: true });
    const cli = fileURLToPath(new URL('../forewit.mjs', import.meta.url));
    const env = { ...process.env, HOME: dir, USERPROFILE: dir, FAKE_BAW_SCENARIO: 'happy' };
    // A piped yes is not a typed yes: the real CLI refuses a non TTY stdin before anything else.
    const t1 = spawnSync(process.execPath, [cli, 'commit', '--network', 'testnet', '--execute', '--from', FROM, '--p', '50'], { env, encoding: 'utf8', input: 'yes\n' });
    assert.equal(t1.status, 1);
    assert.match(t1.stderr, /stdin is not a TTY/);
    const t2 = spawnSync(process.execPath, [cli, 'reveal', '--network', 'mainnet', '--execute', '--from', FROM], { env, encoding: 'utf8' });
    assert.equal(t2.status, 1);
    assert.match(t2.stderr, /mainnet ledger is not deployed/);
    assert.ok(!existsSync(process.env.FAKE_BAW_LOG), 'baw was never started');
    assert.ok(!existsSync(join(dir, '.forewit')), 'no salt was made');
  });
});
