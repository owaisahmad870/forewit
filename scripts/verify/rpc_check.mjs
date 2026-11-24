// Checks the keyed mainnet RPCs without printing them: eth_chainId must be 56, eth_blockNumber must answer.
// Run: node --env-file=.env scripts/verify/rpc_check.mjs
for (const name of ['RPC_MAINNET_PRIMARY', 'RPC_MAINNET_FALLBACK']) {
  const url = process.env[name];
  if (!url) { console.log(`${name}: missing`); continue; }
  const call = (method) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }) }).then((r) => r.json());
  try {
    const t = Date.now();
    const [id, bn] = [await call('eth_chainId'), await call('eth_blockNumber')];
    const ok = Number(id.result) === 56 && Number(bn.result) > 0;
    console.log(`${name}: ${ok ? 'pass' : 'fail'} chain ${Number(id.result)} block ${Number(bn.result)} ${Math.round((Date.now() - t) / 2)} ms per call`);
  } catch (e) {
    console.log(`${name}: fail (${e.name})`); // message may contain the URL, so only the error type prints
  }
}
