// forewit plan: today's round pick, crypto baseline vs needsView, commit command, streak, duties, report size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildPlan } from '../src/plan.mjs';
import { writeData, INJECTION } from './helpers.mjs';
import { NETWORKS } from '../vendor/agent/config.mjs';
const ledger = NETWORKS.testnet.ledger;

test('plan for a new wallet and for a wallet that already committed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'forewit_plan_'));
  const now = Date.now();
  const { A } = writeData(dir, { ledger, now });
  // give round 2 one crypto question with an end time, keep one non crypto question
  const f = join(dir, 'rounds/2.json'), r2 = JSON.parse(readFileSync(f, 'utf8'));
  r2.questions[0] = { ...r2.questions[0], eventQuestion: 'Bitcoin Up or Down on November 27?', label: 'Bitcoin Up or Down on November 27?', endsAt: new Date(now + 86400e3).toISOString() };
  writeFileSync(f, JSON.stringify(r2));
  const calls = [];
  const baseline = async (title, endsAt) => { calls.push(title); return { symbol: 'BTCUSDT', p: 0.62, phase: 'running', start: 100, now: 101, startMs: now - 6 * 3600e3, endMs: endsAt, sigmaMin: 0.0005 }; };

  const fresh = '0x' + 'd'.repeat(40);
  const p = await buildPlan({ address: fresh, now, data: dir, baseline });
  assert.equal(p.today.roundId, 2);
  assert.equal(p.today.alreadyCommitted, false);
  assert.deepEqual(p.today.questions.map((q) => [q.kind, q.suggestPct]), [['crypto', 62], ['needsView', null]]);
  assert.equal(calls.length, 1, 'baseline runs only for questions with an end time');
  assert.match(p.today.command, /commit --round 2 --p 62,<your %> --from 0xd{40} --auto-reveal --execute$/);
  assert.ok(p.report.length <= 7 && p.report.every((l) => !l.includes(INJECTION)), 'short report, no third party text');
  assert.equal(p.record.rounds, 0);
  assert.ok(p.routine.limits.callsPerDay === 1 && p.routine.limits.value === '0');

  const a = await buildPlan({ address: A, now, data: dir, baseline });
  assert.equal(a.today.alreadyCommitted, true);
  assert.equal(a.today.command, null);
  assert.equal(a.record.streak, 1, 'committed to the one closed daily round');

  await assert.rejects(buildPlan({ address: 'nope', data: dir }), /wallet address/);
});

test('baseline errors degrade to needsView, never throw', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'forewit_plan_'));
  const now = Date.now();
  writeData(dir, { ledger, now });
  const f = join(dir, 'rounds/2.json'), r2 = JSON.parse(readFileSync(f, 'utf8'));
  r2.questions[0].endsAt = new Date(now + 86400e3).toISOString();
  writeFileSync(f, JSON.stringify(r2));
  const p = await buildPlan({ address: '0x' + 'e'.repeat(40), now, data: dir, baseline: async () => { throw new Error('blocked'); } });
  assert.equal(p.today.questions[0].kind, 'needsView');
  assert.match(p.today.questions[0].why, /unreachable \(blocked\)/);
});

test('a wallet that has not started gets the free start() call; a started one does not', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'forewit_plan_'));
  const now = Date.now();
  writeData(dir, { ledger, now });
  const net = { rpc: 'http://rpc.test', start: '0x' + 'ab'.repeat(20) };
  const rpcSays = (v) => async (url, init) => { assert.equal(url, net.rpc); assert.match(JSON.parse(init.body).params[0].data, /^0xaab035b7/); return { json: async () => ({ result: '0x' + v.toString(16).padStart(64, '0') }) }; };
  const fresh = await buildPlan({ address: '0x' + 'f'.repeat(40), now, data: dir, net, fetchImpl: rpcSays(0) });
  assert.equal(fresh.start.inputData, '0xbe9a6555');
  assert.equal(fresh.start.value, '0');
  assert.match(fresh.start.preview, /--to 0x(ab){20} --value 0 --inputData 0xbe9a6555/);
  assert.match(fresh.report[0], /free tap/);
  const started = await buildPlan({ address: '0x' + 'f'.repeat(40), now, data: dir, net, fetchImpl: rpcSays(1_800_000_000) });
  assert.equal(started.start, undefined);
  const unpinned = await buildPlan({ address: '0x' + 'f'.repeat(40), now, data: dir, net: { ...net, start: null } });
  assert.equal(unpinned.start, undefined);
});
