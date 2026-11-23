// Stand in for the baw CLI in tests. Logs every call to FAKE_BAW_LOG and answers by FAKE_BAW_SCENARIO.
// Scenarios: happy, pending, expired, locked, busy, devoff, nodata, wrongto, wrongdata, value,
// preview351802, preview351803, preview351804, preview351805, execute351802, execute351803, execute351805, garbage.
import { appendFileSync } from 'node:fs';

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
  if (s.startsWith('preview')) fail(Number(s.slice(7)));
  const data = flag('--inputData');
  const parsedTx = {
    transactionType: 'ContractCall',
    amount: s === 'value' ? '1' : '0',
    contractAddress: s === 'wrongto' ? '0x' + '99'.repeat(20) : flag('--to'),
    inputData: s === 'wrongdata' ? data.slice(0, -2) + (data.endsWith('00') ? '01' : '00') : data,
  };
  if (s === 'nodata') delete parsedTx.inputData;
  out({
    success: true,
    data: {
      requestId: 'req_123',
      parsedTx,
      simulationResult: { simulationCode: '000000000', simulationErrorDetail: null, balanceChanges: [] },
      risks: { riskDetails: [], addresses: {}, riskBehaviors: [] },
      requireConfirmation: s === 'pending',
      expiresAt: Date.now() + (s === 'expired' ? -1000 : 300000),
    },
  });
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
