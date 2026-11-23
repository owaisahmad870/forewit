import { createPublicClient, http, parseAbi, keccak256, toHex, getAddress, parseAbiItem } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

const main = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed.bnbchain.org') });
const test = createPublicClient({ chain: bscTestnet, transport: http('https://data-seed-prebsc-1-s1.bnbchain.org:8545') });
const EIP1967_IMPL = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_ADMIN = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

const out = (k, v) => console.log(k.padEnd(48), typeof v === 'bigint' ? v.toString() : JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x));
async function tryRead(c, address, sig, args = []) {
  try { const abi = parseAbi([sig]); return await c.readContract({ address, abi, functionName: abi[0].name, args }); }
  catch (e) { return 'ERR: ' + (e.shortMessage || e.message).split('\n')[0]; }
}
async function codeInfo(c, label, a) {
  const code = await c.getCode({ address: a });
  const impl = await c.getStorageAt({ address: a, slot: EIP1967_IMPL });
  const adm = await c.getStorageAt({ address: a, slot: EIP1967_ADMIN });
  out(label + ' codeBytes', code ? (code.length - 2) / 2 : 0);
  if (impl && BigInt(impl) !== 0n) out(label + ' EIP1967 impl', '0x' + impl.slice(26));
  if (adm && BigInt(adm) !== 0n) out(label + ' EIP1967 admin', '0x' + adm.slice(26));
  return code;
}

const section = process.argv[2] || 'all';
const MAIN = {
  AGENT_ID: '0x60b9262456de011f7d15a54cdd8c48baaa8b022f',
  CONDITIONAL_TOKENS: '0x22DA1810B194ca018378464a58f6Ac2B10C9d244',
  YB_CTF: '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F',
  YB_NEGRISK_CTF: '0xF64b0b318AAf83BD9071110af24D24445719A07F',
  CTF_EXCHANGE: '0x8BC070BEdAB741406F4B1Eb65A72bee27894B689',
  NEG_RISK_CTF_EXCHANGE: '0x365fb81bd4A24D6303cd2F19c349dE6894D8d58A',
  NEG_RISK_ADAPTER: '0xc3Cf7c252f65E0d8D88537dF96569AE94a7F1A6E',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  ERC8004_IDENTITY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  ERC8004_REPUTATION: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
};
const TEST = {
  CONDITIONAL_TOKENS: '0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743',
  YB_CTF: '0x38BF1cbD66d174bb5F3037d7068E708861D68D7f',
  YB_NEGRISK_CTF: '0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5',
};

if (section === 'all' || section === 'code') {
  out('mainnet head', await main.getBlockNumber());
  for (const [k, a] of Object.entries(MAIN)) { getAddress(a); await codeInfo(main, k, a); }
  for (const [k, a] of Object.entries(TEST)) await codeInfo(test, 'TESTNET ' + k, a);
}

if (section === 'all' || section === 'agentid') {
  const A = MAIN.AGENT_ID;
  for (const s of ['function name() view returns (string)', 'function symbol() view returns (string)', 'function totalSupply() view returns (uint256)'])
    out('AgentID ' + s.split('(')[0].slice(9), await tryRead(main, A, s));
  for (const id of ['0x80ac58cd', '0x5b5e139f', '0x780e9d63', '0xb45a3c0e', '0x01ffc9a7'])
    out('AgentID supportsInterface ' + id, await tryRead(main, A, 'function supportsInterface(bytes4) view returns (bool)', [id]));
  out('AgentID balanceOf(0x..dEaD)', await tryRead(main, A, 'function balanceOf(address) view returns (uint256)', ['0x000000000000000000000000000000000000dEaD']));
}

if (section === 'all' || section === 'ctf') {
  const z = '0x' + '00'.repeat(32);
  for (const [net, c, set] of [['main', main, MAIN], ['test', test, TEST]])
    for (const k of ['CONDITIONAL_TOKENS', 'YB_CTF', 'YB_NEGRISK_CTF']) {
      out(`${net} ${k} getOutcomeSlotCount(0)`, await tryRead(c, set[k], 'function getOutcomeSlotCount(bytes32) view returns (uint256)', [z]));
      out(`${net} ${k} payoutDenominator(0)`, await tryRead(c, set[k], 'function payoutDenominator(bytes32) view returns (uint256)', [z]));
      out(`${net} ${k} payoutNumerators(0,0)`, await tryRead(c, set[k], 'function payoutNumerators(bytes32,uint256) view returns (uint256)', [z, 0n]));
    }
  out('ex getCtf', await tryRead(main, MAIN.CTF_EXCHANGE, 'function getCtf() view returns (address)'));
  out('ex getCollateral', await tryRead(main, MAIN.CTF_EXCHANGE, 'function getCollateral() view returns (address)'));
  out('nrex getCtf', await tryRead(main, MAIN.NEG_RISK_CTF_EXCHANGE, 'function getCtf() view returns (address)'));
  out('nrex getCollateral', await tryRead(main, MAIN.NEG_RISK_CTF_EXCHANGE, 'function getCollateral() view returns (address)'));
  out('nra ctf', await tryRead(main, MAIN.NEG_RISK_ADAPTER, 'function ctf() view returns (address)'));
  out('nra col', await tryRead(main, MAIN.NEG_RISK_ADAPTER, 'function col() view returns (address)'));
  out('USDT symbol', await tryRead(main, MAIN.USDT, 'function symbol() view returns (string)'));
  out('USDT decimals', await tryRead(main, MAIN.USDT, 'function decimals() view returns (uint8)'));
  for (const k of ['ERC8004_IDENTITY', 'ERC8004_REPUTATION']) {
    out(k + ' name', await tryRead(main, MAIN[k], 'function name() view returns (string)'));
    out(k + ' getVersion', await tryRead(main, MAIN[k], 'function getVersion() view returns (string)'));
  }
}
