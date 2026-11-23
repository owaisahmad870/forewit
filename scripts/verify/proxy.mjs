import { createPublicClient, http, keccak256, toHex, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
const c = createPublicClient({ chain: bsc, transport: http('https://bsc-rpc.publicnode.com') });
const slot = (s) => toHex(BigInt(keccak256(toHex(s))) - 1n, { size: 32 });
const S = { impl: slot('eip1967.proxy.implementation'), admin: slot('eip1967.proxy.admin'), beacon: slot('eip1967.proxy.beacon') };
console.log('impl slot', S.impl);
const A = { AGENT_ID: '0x60b9262456de011f7d15a54cdd8c48baaa8b022f', CTF: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', YB_CTF: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', YB_NR_CTF: '0xF64b0b318AAf83BD9071110af24D24445719A07F', ERC8004_ID: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', ERC8004_REP: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' };
for (const [k, a] of Object.entries(A)) {
  const code = await c.getCode({ address: a });
  const r = {};
  for (const [n, s] of Object.entries(S)) { const v = await c.getStorageAt({ address: a, slot: s }); if (BigInt(v) !== 0n) r[n] = '0x' + v.slice(26); }
  r.hasDelegatecallByte = code.includes('f4'); // crude
  console.log(k, (code.length - 2) / 2, JSON.stringify(r));
}
// more label checks from recent mints
const abi = parseAbi(['function tokenURI(uint256) view returns (string)']);
const ids = ['0xcf587ad72fc107fc20f9944d3ff208c22f960417d0bc952e33e71217e84a4261','0x3e5a3fb2fa4c9873673c8e9950c14c3bbdab4f4c78f98c4f5a42c24f4cabf9a0','0x32597217a1daf1c978dc4539de86747ffa5f289dfad88d74dc69851110e71983'];
for (const id of ids) {
  const uri = await c.readContract({ address: A.AGENT_ID, abi, functionName: 'tokenURI', args: [BigInt(id)] });
  const label = decodeURIComponent(uri.split('/').pop().replace(/\.json$/, ''));
  console.log('label check', keccak256(toHex(label)) === id);
}
