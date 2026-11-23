// Stand in for the baw CLI in tests. Logs every call to FAKE_BAW_LOG and answers by FAKE_BAW_SCENARIO.
// Scenarios: happy, pending, expired, locked, busy, devoff, nodata, wrongto, wrongdata, value, notcall,
// preview351802, preview351803, preview351804, preview351805, execute351802, execute351803, execute351805, garbage.
import { appendFileSync, readFileSync } from 'node:fs';

// Real mainnet preview replies (baw 1.12.0) are the base, so the tests follow the real field names.
const real = (n) => JSON.parse(readFileSync(new URL(n, import.meta.url), 'utf8')).reply;

const args = process.argv.slice(2);
if (process.env.FAKE_BAW_LOG) appendFileSync(process.env.FAKE_BAW_LOG, JSON.stringify(args) + '\n');
const s = process.env.FAKE_BAW_SCENARIO || 'happy';
const flag = (n) => args[args.indexOf(n) + 1];
const out = (o, code = 0) => {
  process.stdout.write(JSON.stringify(o, null, 2));
  process.exit(code);
};
const fail = (code) => out({ success: false, error: { code, name: 'FAKE_' + code, message: 'fake error ' + code } }, 1);
const key = args.slice(0, 2).join(' ');

if (key === 'wallet status') out({ success: true, data: { status: 'CONNECTED' } });
if (key === 'wallet agent-id') out({ success: true, data: { claimed: true, handle: 'tester', agentId: 'tester.ai' } });
if (key === 'wallet settings') {
  out({ success: true, data: { devMode: { enabled: s !== 'devoff', expiresAt: new Date(Date.now() + 86400e3).toISOString(), dailyLimit: 1000, balanceExceeded: false } } });
}
if (key === 'wallet tx-lock') out({ success: true, data: { status: s === 'locked' ? 'LOCKED' : 'UNLOCKED' } });
if (key === 'wallet tx-history') out({ success: true, data: { transactions: s === 'busy' ? [{ txHash: '0x' + '01'.repeat(32), status: 'pending' }] : [], hasMore: false } });
if (key === 'contract-call preview') {
  if (s === 'preview351805') out(real('baw_preview_reverted.json'), 1);
  if (s.startsWith('preview')) fail(Number(s.slice(7)));
  const selector = flag('--inputData').slice(0, 10);
  const reply = real('baw_preview_contract_call.json');
  const d = reply.data;
  d.requestId = 'req_123';
  d.parsedTx.contractAddress = s === 'wrongto' ? '0x' + '99'.repeat(20) : flag('--to');
  d.parsedTx.action = s === 'wrongdata' ? '0xdeadbeef' : selector;
  if (s === 'nodata') delete d.parsedTx.action;
  if (s === 'notcall') d.parsedTx.transactionType = 'Send';
  if (s === 'value') d.simulationResult.balanceChanges = [{ address: flag('--from'), amount: '-1' }];
  d.requireConfirmation = s === 'pending';
  d.expiresAt = Date.now() + (s === 'expired' ? -1000 : 300000);
  out(reply);
}
if (key === 'contract-call execute') {
  if (s.startsWith('execute')) fail(Number(s.slice(7)));
  if (s === 'garbage') {
    process.stdout.write('not json');
    process.exit(0);
  }
  if (s === 'pending') out({ success: true, data: { orderId: 'o1', status: 'PENDING_CONFIRMATION', txHash: null, message: 'Please confirm in the Binance App' } });
  out({ success: true, data: { orderId: 'o1', status: 'BROADCASTED', txHash: '0x' + 'ab'.repeat(32), message: null } });
}
fail(999);
