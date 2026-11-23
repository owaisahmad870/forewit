import { createPublicClient, http, parseAbi, keccak256, toHex, encodeFunctionData } from 'viem';
import { bsc } from 'viem/chains';
const c = createPublicClient({ chain: bsc, transport: http('https://bsc-rpc.publicnode.com') });
const j = (x) => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v);
const r = async (address, sig, args = [], account) => {
  try { const abi = parseAbi([sig]); return await c.readContract({ address, abi, functionName: abi[0].name, args, account }); }
  catch (e) { return 'ERR: ' + (e.shortMessage || e.message).split('\n').slice(0, 2).join(' | '); }
};
const CTF = '0x22DA1810B194ca018378464a58f6Ac2B10C9d244';
const cond = '0xd3b9db96de881083b81790eeae9f6c453ccd9bb6536912e8f78709f7630c54fc';
console.log('resolved cond slots', j(await r(CTF, 'function getOutcomeSlotCount(bytes32) view returns (uint256)', [cond])));
console.log('resolved cond denom', j(await r(CTF, 'function payoutDenominator(bytes32) view returns (uint256)', [cond])));
for (const i of [0n, 1n, 2n]) console.log('resolved cond num', i, j(await r(CTF, 'function payoutNumerators(bytes32,uint256) view returns (uint256)', [cond, i])));
const tx = await c.getTransaction({ hash: '0x1cca89666fdea332666c07fe177e205ba85cb8f679e7b66733bcd4a6a0c9a33c' });
console.log('resolution tx from', tx.from, 'to', tx.to, 'selector', tx.input.slice(0, 10));
const oracle = '0x77620fab2969df2d5696f1f081940e416cf17ca5';
console.log('oracle codeBytes', ((await c.getCode({ address: oracle })) || '0x').length / 2 - 1);

const AID = '0x60b9262456de011f7d15a54cdd8c48baaa8b022f';
const holder = '0xcba4ee480e307a3fcbcbe6a25e3823595ade61d5';
const tid = BigInt('0x0ae5d76f93557e43b6f4e8848345a888fc4be30aa19571e484fa0e40bb00a887');
console.log('holder balanceOf', j(await r(AID, 'function balanceOf(address) view returns (uint256)', [holder])));
console.log('ownerOf', j(await r(AID, 'function ownerOf(uint256) view returns (address)', [tid])));
const uri = await r(AID, 'function tokenURI(uint256) view returns (string)', [tid]);
console.log('tokenURI', typeof uri === 'string' ? uri.slice(0, 300) : uri);
const hcode = await c.getCode({ address: holder });
console.log('holder codeBytes', hcode ? (hcode.length - 2) / 2 : 0, hcode ? hcode.slice(0, 60) : '');
const mtx = await c.getTransaction({ hash: '0xe57f3ee7fc4fe0d291d2dc3caa890dde4a757d8320b893d05e69a619299e23e0' });
console.log('mint tx from', mtx.from, 'to', mtx.to, 'selector', mtx.input.slice(0, 10), 'len', mtx.input.length);
// non transferable: simulate transferFrom from holder
for (const sig of ['function transferFrom(address,address,uint256)', 'function safeTransferFrom(address,address,uint256)', 'function approve(address,uint256)']) {
  const abi = parseAbi([sig]);
  const args = abi[0].inputs.length === 3 ? [holder, '0x000000000000000000000000000000000000dEaD', tid] : ['0x000000000000000000000000000000000000dEaD', tid];
  try { await c.call({ account: holder, to: AID, data: encodeFunctionData({ abi, functionName: abi[0].name, args }) }); console.log(abi[0].name, 'SIMULATION SUCCEEDED (transferable?)'); }
  catch (e) { console.log(abi[0].name, 'reverts:', (e.shortMessage || e.message).split('\n').slice(0, 3).join(' | ')); }
}
