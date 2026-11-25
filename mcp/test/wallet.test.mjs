// Local server wallet tools against the fake baw and a fake ledger: the human confirmation form (elicitation) is the
// gate, the model cannot send without it, and the wallet address always comes from the signed in wallet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NETWORKS } from '../vendor/agent/config.mjs';
import { call, fakeChain } from './helpers.mjs';

process.env.FOREWIT_BAW_BIN = fileURLToPath(new URL('../../agent/test/fixtures/fake_baw.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'forewit_wallet_'));
process.env.FAKE_BAW_LOG = join(dir, 'calls.jsonl');
process.env.FAKE_BAW_SCENARIO = 'happy';
const { createLocalServer } = await import('../src/local.mjs');
const net = NETWORKS.mainnet;
const WALLET = '0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5'; // the fake baw's BSC address

async function client(home, answer) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createLocalServer({ home }).connect(b);
  const c = new Client({ name: 'test', version: '1' }, answer === undefined ? {} : { capabilities: { elicitation: {} } });
  const asked = [];
  if (answer !== undefined) c.setRequestHandler(ElicitRequestSchema, async (req) => { asked.push(req.params.message); return answer; });
  await c.connect(a);
  return { c, asked };
}
const verbs = () => (existsSync(process.env.FAKE_BAW_LOG) ? readFileSync(process.env.FAKE_BAW_LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l).slice(0, 2).join(' ')) : []);

test('wallet tools', async (t) => {
  const now = Math.floor(Date.now() / 1000);
  const chain = { rpcUrls: [net.rpc], chainId: net.chainId, ledger: net.ledger, now, rounds: { 1: { commitDeadline: now + 600, revealDeadline: now + 1200, n: 2 } }, commits: {}, reveals: {} };
  const restore = fakeChain(chain);
  t.after(() => { restore(); rmSync(dir, { recursive: true, force: true }); });

  await t.test('wallet_status reads the signed in wallet', async () => {
    const { c } = await client(join(dir, 'h0'), { action: 'accept', content: { confirm: 'yes' } });
    const { data } = await call(c, 'wallet_status');
    assert.deepEqual(data, { signed_in: true, agent_id: 'tester.ai', developer_mode: true, bsc_address: WALLET });
  });

  await t.test('commit_forecast sends only after the person types yes in the form, from the wallet\'s own address', async () => {
    rmSync(process.env.FAKE_BAW_LOG, { force: true });
    const { c, asked } = await client(join(dir, 'h1'), { action: 'accept', content: { confirm: 'yes' } });
    const { result, data } = await call(c, 'commit_forecast', { probabilities_percent: [70, 20], auto_reveal: true });
    assert.equal(result.isError, undefined, result.content?.[0]?.text);
    assert.equal(data.status, 'BROADCASTED');
    assert.equal(data.from, WALLET);
    assert.equal(data.auto_reveal, true);
    assert.equal(asked.length, 1);
    assert.match(asked[0], /Round 1 commit, your forecast: 70%, 20%[\s\S]*Auto reveal: on[\s\S]*parsedTx/);
    assert.deepEqual(verbs().slice(-2), ['contract-call preview', 'contract-call execute']);
    assert.ok(existsSync(data.receipt_file), 'the salt is saved before sending');
  });

  await t.test('a declined form, a wrong word, or a client without forms never executes', async () => {
    for (const answer of [{ action: 'decline' }, { action: 'accept', content: { confirm: 'ok' } }, undefined]) {
      rmSync(process.env.FAKE_BAW_LOG, { force: true });
      const { c } = await client(join(dir, 'h2'), answer);
      const { result } = await call(c, 'commit_forecast', { probabilities_percent: [70, 20] });
      assert.equal(result.isError, true);
      assert.ok(!verbs().includes('contract-call execute'), JSON.stringify(answer));
    }
  });

  await t.test('send tools are marked destructive so clients ask before running them', async () => {
    const { c } = await client(join(dir, 'h3'), { action: 'decline' });
    const { tools } = await c.listTools();
    for (const n of ['commit_forecast', 'reveal_forecast']) assert.equal(tools.find((x) => x.name === n).annotations.destructiveHint, true);
  });
});
