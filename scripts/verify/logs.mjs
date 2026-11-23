import { createPublicClient, http, keccak256, toHex, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
const c = createPublicClient({ chain: bsc, transport: http(process.env.RPC || 'https://bsc-dataseed.bnbchain.org') });
const topic = (s) => keccak256(toHex(s));
const [addr, sig, span = '5000', back = '0'] = process.argv.slice(2);
const head = await c.getBlockNumber();
let to = head - BigInt(back), found = [];
for (let i = 0; i < 40 && found.length < 5; i++) {
  const from = to - BigInt(span) + 1n;
  try {
    const logs = await c.request({ method: 'eth_getLogs', params: [{ address: addr, topics: [topic(sig)], fromBlock: toHex(from), toBlock: toHex(to) }] });
    found.push(...logs);
  } catch (e) { console.log('getLogs err', from, to, (e.shortMessage || e.message).split('\n')[0]); break; }
  to = from - 1n;
}
console.log('topic', topic(sig), 'found', found.length, 'scanned down to', to.toString());
for (const l of found.slice(0, 5)) console.log(JSON.stringify({ block: BigInt(l.blockNumber).toString(), tx: l.transactionHash, topics: l.topics, data: l.data.slice(0, 200) }));
