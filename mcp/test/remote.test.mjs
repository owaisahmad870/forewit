// Remote read only server: every tool, strict inputs, untrusted text isolation, operator filtering, HTTP edges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRemoteServer, startHttp } from '../src/remote.mjs';
import { NETWORKS } from '../vendor/agent/config.mjs';
import { connect, call, fakeChain, writeData, INJECTION } from './helpers.mjs';

const net = NETWORKS.testnet;
const nowS = Math.floor(Date.now() / 1000);

/** Every JSON path at which `needle` occurs in a string value. */
function pathsOf(value, needle, path = '$') {
  if (typeof value === 'string') return value.includes(needle) ? [path] : [];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => pathsOf(v, needle, `${path}.${k}`));
  return [];
}

test('remote server', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'forewit_mcp_data_'));
  const { A, B, OP } = writeData(dir, { ledger: net.ledger });
  const chain = {
    rpcUrls: [net.rpc], chainId: net.chainId, ledger: net.ledger, now: nowS,
    rounds: { 1: { commitDeadline: nowS - 2 * 86400, revealDeadline: nowS - 2 * 86400 + 3600, n: 2, baseline: 6000n | (4000n << 16n) }, 2: { commitDeadline: nowS + 3600, revealDeadline: nowS + 7200, n: 2 } },
    commits: { [`2:${A}`]: '0x' + '1'.repeat(64) }, reveals: {},
  };
  const restore = fakeChain(chain);
  const client = await connect(createRemoteServer({ data: dir }));
  t.after(() => { restore(); rmSync(dir, { recursive: true, force: true }); });

  await t.test('lists the nine read only tools with strict inputs and output schemas', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((x) => x.name).sort(), ['explain_scoring', 'get_baseline', 'get_crowd', 'get_current_round', 'get_leaderboard', 'get_my_status', 'get_question', 'get_round', 'get_upcoming']);
    for (const x of tools) {
      assert.equal(x.annotations.readOnlyHint, true, x.name);
      assert.equal(x.inputSchema.additionalProperties, false, x.name);
      assert.equal(x.outputSchema.type, 'object', x.name);
      assert.doesNotMatch(x.description, /[-‐-―]/, `${x.name} description has a hyphen or dash`);
    }
  });

  await t.test('advertises tools only: no logging, sampling or roots', () => {
    const caps = client.getServerCapabilities();
    assert.deepEqual(Object.keys(caps), ['tools']);
  });

  await t.test('get_current_round picks the round open for commits', async () => {
    const { data, result } = await call(client, 'get_current_round');
    assert.equal(result.isError, undefined);
    assert.equal(data.round_id, 2);
    assert.equal(data.phase, 'commit');
    assert.equal(data.network, 'testnet');
    assert.equal(data.ledger, net.ledger);
    assert.deepEqual(JSON.parse(result.content[0].text), data);
  });

  await t.test('get_round returns questions with untrusted text, null when no event question', async () => {
    const { data } = await call(client, 'get_round', { round_id: 1 });
    assert.equal(data.questions.length, 2);
    assert.equal(data.questions[0].untrusted_market_text.text, 'Will BTC close above 100k? · Yes');
    assert.equal(data.questions[0].baseline_bps, 6000);
    assert.equal(data.questions[0].outcome, 'Yes');
    const r2 = await call(client, 'get_round', { round_id: 2 });
    assert.equal(r2.data.questions[1].untrusted_market_text, null);
  });

  await t.test('get_question always carries the parent event question, refuses a bare label', async () => {
    const { data } = await call(client, 'get_question', { round_id: 1, index: 1 });
    assert.equal(data.untrusted_market_text.event_question, 'Will ETH close above 5k?');
    const bare = await call(client, 'get_question', { round_id: 2, index: 1 });
    assert.equal(bare.result.isError, true);
    assert.match(bare.text, /no event question/);
    assert.doesNotMatch(bare.text, /Orphan label/);
  });

  await t.test('prompt injection in market text and names comes back only inside untrusted fields', async () => {
    const outputs = [
      (await call(client, 'get_question', { round_id: 2, index: 0 })).result,
      (await call(client, 'get_round', { round_id: 2 })).result,
      (await call(client, 'get_current_round')).result,
      (await call(client, 'get_leaderboard')).result,
      (await call(client, 'get_my_status', { address: A })).result,
    ];
    for (const r of outputs) {
      assert.equal(r.isError, undefined);
      const paths = [...pathsOf(r.structuredContent, 'IGNORE ALL'), ...pathsOf(JSON.parse(r.content[0].text), 'IGNORE ALL').map((p) => 'text' + p)];
      assert.ok(paths.length > 0, 'payload is returned as data');
      for (const p of paths) assert.match(p, /\.untrusted_(market_text|profile_name)(\.|$)/, `payload outside an untrusted field at ${p}`);
    }
    const q = outputs[0].structuredContent.untrusted_market_text;
    assert.ok(q.event_question.startsWith(INJECTION));
    assert.doesNotMatch(q.event_question + q.label, /[\u0000‮]/, 'control and bidi characters removed');
    assert.equal(q.tags[1], INJECTION);
  });

  await t.test('get_baseline reads the chain and checks the published data', async () => {
    chain.calls.length = 0;
    const { data } = await call(client, 'get_baseline', { round_id: 1 });
    assert.deepEqual(data.baseline_bps, [6000, 4000]);
    assert.equal(data.source, 'chain');
    assert.equal(data.published_data_agrees, true);
    assert.ok(chain.calls.includes('eth_call'));
    const none = await call(client, 'get_baseline', { round_id: 2 });
    assert.equal(none.data.baseline_set, false);
    assert.equal(none.data.baseline_bps, null);
  });

  await t.test('get_crowd compares the crowd with the market and paginates', async () => {
    const { data } = await call(client, 'get_crowd', { limit: 1 });
    assert.equal(data.overall.questions, 2);
    assert.ok(Math.abs(data.overall.crowd_brier - 0.04) < 1e-12);
    assert.ok(Math.abs(data.overall.market_brier - 0.16) < 1e-12);
    assert.equal(data.rounds.length, 1);
    assert.equal(data.rounds[0].round_id, 2);
    const next = await call(client, 'get_crowd', { limit: 1, cursor: data.next_cursor });
    assert.equal(next.data.rounds[0].round_id, 1);
    assert.equal(next.data.next_cursor, null);
  });

  await t.test('get_leaderboard lists opt in profiles only and never operators', async () => {
    const { data } = await call(client, 'get_leaderboard');
    assert.deepEqual(data.rows.map((r) => r.address), [A]);
    assert.equal(data.public_count, 1);
    assert.equal(data.forecasters, 3);
    assert.ok(!JSON.stringify(data).includes(OP.slice(2)) && !JSON.stringify(data).includes(B.slice(2)));
  });

  await t.test('get_my_status combines chain status and history', async () => {
    const { data } = await call(client, 'get_my_status', { address: A.toUpperCase().replace('0X', '0x') });
    assert.equal(data.current.round_id, 2);
    assert.equal(data.current.committed, true);
    assert.equal(data.current.phase, 'commit open');
    assert.equal(data.history.length, 2);
    assert.equal(data.history[1].result, 'scored');
    assert.equal(data.leaderboard.address, A);
    assert.match(data.results.summary, /rounds played/);
    const r1 = data.results.rounds.find((r) => r.round_id === 1);
    assert.ok(['beat', 'behind', 'level', 'scored'].includes(r1.verdict) && r1.says.length > 10);
    const op = await call(client, 'get_my_status', { address: OP });
    assert.equal(op.data.leaderboard, null);
  });

  await t.test('get_upcoming lists open rounds and the next daily open', async () => {
    const { data } = await call(client, 'get_upcoming');
    assert.ok(Array.isArray(data.open));
    assert.ok(Date.parse(data.next_daily_open) > Date.now());
  });

  await t.test('explain_scoring in both languages with the constants', async () => {
    const en = await call(client, 'explain_scoring');
    assert.equal(en.data.lang, 'en');
    assert.equal(en.data.constants.shrink_k, 20);
    assert.ok(en.data.rules.some((r) => r.startsWith('Brier')));
    const zh = await call(client, 'explain_scoring', { lang: 'zh' });
    assert.equal(zh.data.lang, 'zh');
    assert.notEqual(zh.data.title, en.data.title);
  });

  await t.test('invalid input is a tool execution error, not a protocol error', async () => {
    for (const [name, args] of [['get_round', { round_id: 0 }], ['get_round', { round_id: 1, extra: true }], ['get_my_status', { address: 'nope' }],
      ['get_question', { round_id: 1 }], ['get_crowd', { cursor: 'bad!' }], ['get_round', { round_id: 99 }]]) {
      const { result } = await call(client, name, args);
      assert.equal(result.isError, true, `${name} ${JSON.stringify(args)}`);
    }
  });

  await t.test('refuses published data for a ledger that is not pinned', async () => {
    const other = mkdtempSync(join(tmpdir(), 'forewit_mcp_other_'));
    writeData(other, { ledger: '0x' + '9'.repeat(40) });
    const c = await connect(createRemoteServer({ data: other }));
    const { result, text } = await call(c, 'get_current_round');
    assert.equal(result.isError, true);
    assert.match(text, /pinned/);
    rmSync(other, { recursive: true, force: true });
  });

  await t.test('HTTP: Origin allowlist, body limit, rate limit, POST only', async () => {
    const http = await startHttp({ port: 0, data: dir, allowedOrigins: ['https://forewit.xyz'], rateLimit: 8 });
    const url = `http://127.0.0.1:${http.address().port}/mcp`;
    const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } } };
    const post = (body, extra = {}) => fetch(url, { method: 'POST', headers: { ...headers, ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    try {
      const noOrigin = await post(init);
      assert.equal(noOrigin.status, 200);
      const j = await noOrigin.json();
      assert.equal(j.result.protocolVersion, '2025-11-25');
      assert.deepEqual(Object.keys(j.result.capabilities), ['tools']);
      const newer = await (await post({ ...init, params: { ...init.params, protocolVersion: '2026-07-28' } })).json();
      assert.equal(newer.result.protocolVersion, '2025-11-25', 'falls back to the newest revision the SDK supports');
      assert.equal((await post(init, { origin: 'https://forewit.xyz' })).status, 200);
      assert.equal((await post(init, { origin: 'https://evil.example' })).status, 403);
      assert.equal((await post('x'.repeat(70 * 1024))).status, 413);
      assert.equal((await fetch(url)).status, 405);
      const list = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_round', arguments: { round_id: 1 } } }, { 'mcp-protocol-version': '2025-11-25' })).json();
      assert.equal(list.result.structuredContent.round_id, 1);
      let limited = 0;
      for (let i = 0; i < 4; i++) if ((await post(init)).status === 429) limited++;
      assert.ok(limited > 0, 'rate limit applies');
    } finally {
      http.close();
    }
  });
});

test('worker handler (forewit.xyz/mcp): web standard requests, read only tools, GET refused', async () => {
  const { handleMcp } = await import('../src/worker.mjs');
  const call = async (body) => (await handleMcp(new Request('https://forewit.xyz/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), { data: 'https://data.invalid/' })).json();
  const init = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.result.serverInfo.name, 'forewit');
  const list = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.ok(list.result.tools.every((t) => t.annotations.readOnlyHint === true));
  assert.ok(!list.result.tools.some((t) => /prepare|commit/.test(t.name)), 'no tool can prepare a commit (it would put a salt on the server)');
  assert.equal((await handleMcp(new Request('https://forewit.xyz/mcp'))).status, 405);
});
