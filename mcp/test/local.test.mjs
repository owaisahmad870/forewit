// Local stdio server: prepare tools against a fake ledger, receipts, salt handling, stdout purity, baw never run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, parseAbi } from 'viem';
import { createLocalServer, profileCalldata } from '../src/local.mjs';
import { revealCalldata, pack } from '../vendor/agent/forewit.mjs';
import { NETWORKS } from '../vendor/agent/config.mjs';
import { connect, call, fakeChain } from './helpers.mjs';

const net = NETWORKS.mainnet; // the default network once the mainnet ledger is pinned
const FROM = '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5';
const BIN = fileURLToPath(new URL('../bin/forewit.mjs', import.meta.url));

test('local server', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'forewit_mcp_home_'));
  const now = Math.floor(Date.now() / 1000);
  const chain = { rpcUrls: [net.rpc], chainId: net.chainId, ledger: net.ledger, now, rounds: { 1: { commitDeadline: now + 600, revealDeadline: now + 1200, n: 3 } }, commits: {}, reveals: {} };
  const restore = fakeChain(chain);
  const client = await connect(createLocalServer({ home }));
  t.after(() => { restore(); rmSync(home, { recursive: true, force: true }); });

  let commit;
  await t.test('lists nine tools with strict inputs and no extra capabilities', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((x) => x.name).sort(), ['commit_forecast', 'my_receipts', 'predict_market', 'prepare_commit', 'prepare_profile', 'prepare_reveal', 'reveal_forecast', 'search_markets', 'wallet_status']);
    for (const x of tools) {
      assert.equal(x.inputSchema.additionalProperties, false, x.name);
      assert.ok(x.outputSchema, x.name);
      assert.doesNotMatch(x.description, /[-‐-―]/, `${x.name} description has a hyphen or dash`);
    }
    assert.equal(tools.find((x) => x.name === 'my_receipts').annotations.readOnlyHint, true);
    assert.deepEqual(Object.keys(client.getServerCapabilities()), ['tools']);
  });

  await t.test('prepare_commit saves the receipt, returns calldata and the preview command, never the salt', async () => {
    const { result, data } = await call(client, 'prepare_commit', { from: FROM, probabilities_percent: [72, 0.5, 50] });
    assert.equal(result.isError, undefined, result.content?.[0]?.text);
    commit = data;
    assert.equal(data.round_id, 1);
    assert.deepEqual(data.probabilities_bps, [7200, 100, 5000]);
    assert.deepEqual(data.clamped_indexes, [1]);
    assert.equal(data.salt_returned, false);
    assert.equal(data.transaction.to, net.ledger);
    assert.equal(data.transaction.value, '0');
    assert.ok(data.transaction.data.slice(0, 138).endsWith(data.commit_hash.slice(2)) && data.auto_reveal === false && data.transaction.data.length === 138);
    assert.equal(data.baw_preview_command, `baw contract-call preview --binanceChainId 56 --from ${FROM} --to ${net.ledger} --value 0 --inputData ${data.transaction.data} --json`);
    assert.equal(data.baw_can_sign_this_network, true);
    const receipt = JSON.parse(readFileSync(data.receipt_file, 'utf8'));
    assert.match(receipt.salt, /^0x[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(result).includes(receipt.salt.slice(2)), 'salt not in the tool result');
  });

  await t.test('prepare_commit validation errors are tool errors', async () => {
    for (const args of [{ from: FROM, probabilities_percent: [50, 50] }, { from: FROM, probabilities_percent: [101, 1, 1] }, { from: 'x', probabilities_percent: [1] },
      { from: FROM, probabilities_percent: [1, 2, 3], home: '/tmp' }, { from: FROM, probabilities_percent: [1, 2, 3], network: 'sepolia' }]) {
      const { result } = await call(client, 'prepare_commit', args);
      assert.equal(result.isError, true, JSON.stringify(args));
    }
  });

  await t.test('prepare_reveal is refused while commits are open (the salt stays local)', async () => {
    chain.commits[`1:${FROM.toLowerCase()}`] = commit.commit_hash;
    const { result, text } = await call(client, 'prepare_reveal', { from: FROM });
    assert.equal(result.isError, true);
    assert.match(text, /revealing early is refused/);
  });

  await t.test('my_receipts refuses include_salt while commits are open', async () => {
    const salt = JSON.parse(readFileSync(commit.receipt_file, 'utf8')).salt;
    for (const args of [{ include_salt: true }, { include_salt: true, round_id: 1, from: FROM }]) {
      const { result, text } = await call(client, 'my_receipts', args);
      assert.equal(result.isError, true, JSON.stringify(args));
      assert.match(text, /salts stay local/);
      assert.ok(!JSON.stringify(result).includes(salt.slice(2)), 'salt not in the refusal');
    }
    assert.equal((await call(client, 'my_receipts', {})).result.isError, undefined, 'metadata is still listed');
  });

  await t.test('prepare_reveal after the deadline returns the matching reveal calldata', async () => {
    chain.now = now + 700;
    const receipt = JSON.parse(readFileSync(commit.receipt_file, 'utf8'));
    const { result, data } = await call(client, 'prepare_reveal', { from: FROM, round_id: 1 });
    assert.equal(result.isError, undefined, result.content?.[0]?.text);
    assert.equal(data.already_revealed, false);
    assert.deepEqual(data.probabilities_bps, [7200, 100, 5000]);
    assert.equal(data.commit_hash, commit.commit_hash);
    assert.equal(data.transaction.data, revealCalldata(1, pack([7200, 100, 5000]), receipt.salt));
    chain.reveals[`1:${FROM.toLowerCase()}`] = { packed: 0n, status: 1 };
    const again = await call(client, 'prepare_reveal', { from: FROM, round_id: 1 });
    assert.equal(again.data.already_revealed, true);
    assert.equal(again.data.transaction, null);
  });

  await t.test('prepare_profile calldata matches viem encodeFunctionData', async () => {
    const abi = parseAbi(['function setPublicProfile(bool isPublic, string label)']);
    for (const [p, l] of [[true, 'owaisahmad'], [false, ''], [true, 'a'.repeat(33)], [true, '']]) {
      assert.equal(profileCalldata(p, l), encodeFunctionData({ abi, functionName: 'setPublicProfile', args: [p, l] }));
    }
    const { data } = await call(client, 'prepare_profile', { from: FROM, is_public: false, label: 'ignored' });
    assert.equal(data.label, '', 'opting out clears the name');
    assert.equal(data.transaction.data, encodeFunctionData({ abi, functionName: 'setPublicProfile', args: [false, ''] }));
    for (const label of ['name.ai', 'Upper', 'x'.repeat(65), 'a b']) {
      assert.equal((await call(client, 'prepare_profile', { from: FROM, is_public: true, label })).result.isError, true, label);
    }
  });

  await t.test('my_receipts returns metadata, the salt only when asked', async () => {
    const plain = await call(client, 'my_receipts', {});
    assert.equal(plain.data.receipts.length, 1);
    assert.equal(plain.data.receipts[0].commit_hash, commit.commit_hash);
    assert.equal(plain.data.receipts[0].salt, undefined);
    assert.ok(!plain.text.includes('"salt"'));
    const withSalt = await call(client, 'my_receipts', { include_salt: true, from: FROM, round_id: 1 });
    assert.match(withSalt.data.receipts[0].salt, /^0x[0-9a-f]{64}$/);
    assert.equal((await call(client, 'my_receipts', { round_id: 2 })).data.receipts.length, 0);
  });

  await t.test('my_receipts skips malformed receipt files with a warning per file', async () => {
    const dir = join(home, '.forewit');
    writeFileSync(join(dir, 'broken.json'), '{ not json');
    writeFileSync(join(dir, 'odd.json'), JSON.stringify({ roundId: 'one', salt: 42 }));
    writeFileSync(join(dir, 'list.json'), '[]');
    // A valid receipt from a deprecated (unpinned) ledger: its salt is withheld, other backups still work.
    const old = { ...JSON.parse(readFileSync(commit.receipt_file, 'utf8')), ledger: '0x' + '11'.repeat(20), createdAt: '2000-01-01T00:00:00.000Z' };
    writeFileSync(join(dir, 'old_instance.json'), JSON.stringify(old));
    const { result, data } = await call(client, 'my_receipts', { include_salt: true });
    assert.equal(result.isError, undefined, result.content?.[0]?.text);
    assert.equal(data.receipts.length, 2);
    assert.match(data.receipts[0].salt, /^0x[0-9a-f]{64}$/);
    assert.equal(data.receipts[1].salt, undefined, 'unpinned ledger: salt withheld');
    assert.deepEqual(data.warnings.map((w) => basename(w.file)).sort(), ['broken.json', 'list.json', 'odd.json', 'old_instance.json']);
    assert.ok(data.warnings.every((w) => w.reason.length > 0));
  });

  await t.test('network access is the pinned RPC only', () => {
    assert.ok(chain.calls.length > 0);
    assert.ok(chain.calls.every((m) => ['eth_chainId', 'eth_getBlockByNumber', 'eth_call'].includes(m)));
  });
});

test('stdio: stdout is JSON RPC only and baw is never started', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'forewit_mcp_stdio_'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const marker = join(home, 'baw_was_run');
  const fakeBaw = join(home, 'fake_baw.mjs');
  writeFileSync(fakeBaw, `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(marker)}, 'x');
`);
  const child = spawn(process.execPath, [BIN, 'mcp'], { env: { ...process.env, HOME: home, USERPROFILE: home, FOREWIT_BAW_BIN: fakeBaw }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'prepare_profile', arguments: { from: FROM, is_public: true, label: 'abc' } } });
  send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'my_receipts', arguments: {} } });
  const deadline = Date.now() + 15000;
  while (out.split('\n').filter(Boolean).length < 4 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  child.kill();
  const lines = out.split('\n').filter(Boolean);
  assert.equal(lines.length, 4, out);
  for (const l of lines) assert.equal(JSON.parse(l).jsonrpc, '2.0');
  const byId = Object.fromEntries(lines.map((l) => JSON.parse(l)).map((m) => [m.id, m]));
  assert.deepEqual(Object.keys(byId[1].result.capabilities), ['tools']);
  assert.equal(byId[3].result.structuredContent.label, 'abc');
  assert.equal(existsSync(marker), false, 'baw must never run');
});
