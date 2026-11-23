// Zero dependency Ethereum keccak256 (original Keccak padding 0x01, not NIST SHA3 0x06),
// hex helpers, and the minimal ABI encoding and decoding the Forewit CLI needs.

const MASK = (1n << 64n) - 1n;
const RATE = 136; // bytes, for a 256 bit output

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
// Rotation offsets indexed by lane x + 5y.
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

const rotl = (v, n) => (n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK);

function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    const c = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) s[x + y] ^= d;
    }
    const b = new Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x + 5 * y]);
    }
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) s[x + y] = b[x + y] ^ (~b[((x + 1) % 5) + y] & MASK & b[((x + 2) % 5) + y]);
    }
    s[0] ^= RC[round];
  }
}

/** keccak256 over a Uint8Array, returns a 32 byte Uint8Array. */
export function keccak256(data) {
  if (!(data instanceof Uint8Array)) throw new TypeError('keccak256 expects a Uint8Array');
  const padLen = RATE - (data.length % RATE);
  const msg = new Uint8Array(data.length + padLen);
  msg.set(data);
  msg[data.length] ^= 0x01;
  msg[msg.length - 1] ^= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < msg.length; off += RATE) {
    for (let i = 0; i < RATE / 8; i++) {
      let lane = 0n;
      for (let j = 7; j >= 0; j--) lane = (lane << 8n) | BigInt(msg[off + i * 8 + j]);
      s[i] ^= lane;
    }
    keccakF(s);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 8; j++) out[i * 8 + j] = Number((s[i] >> BigInt(8 * j)) & 0xffn);
  }
  return out;
}

// Hex helpers

export const bytesToHex = (b) => '0x' + Buffer.from(b).toString('hex');

export function hexToBytes(hex) {
  if (!/^0x([0-9a-fA-F]{2})*$/.test(hex)) throw new Error(`not even length 0x hex: ${String(hex).slice(0, 80)}`);
  return new Uint8Array(Buffer.from(hex.slice(2), 'hex'));
}

export const utf8 = (s) => new TextEncoder().encode(s);
export const keccakHex = (bytes) => bytesToHex(keccak256(bytes));
export const keccakText = (s) => keccakHex(utf8(s));

export const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
export const isBytes32 = (h) => typeof h === 'string' && /^0x[0-9a-fA-F]{64}$/.test(h);

// ABI encoding (static types only: each value is one 32 byte word)

const WORD_MAX = (1n << 256n) - 1n;

export function wordUint(v) {
  const n = BigInt(v);
  if (n < 0n || n > WORD_MAX) throw new Error(`uint256 out of range: ${v}`);
  return n.toString(16).padStart(64, '0');
}

export function wordAddress(a) {
  if (!isAddress(a)) throw new Error(`bad address: ${String(a).slice(0, 80)}`);
  return a.slice(2).toLowerCase().padStart(64, '0');
}

export function wordBytes32(h) {
  if (!isBytes32(h)) throw new Error(`bad bytes32: ${String(h).slice(0, 80)}`);
  return h.slice(2).toLowerCase();
}

export const wordBool = (b) => wordUint(b ? 1 : 0);

/** 4 byte selector of a canonical signature such as "commit(uint256,bytes32)". */
export const selector = (signature) => keccakText(signature).slice(0, 10);

/** Calldata: selector followed by pre encoded words (from the word* helpers). */
export const encodeCall = (signature, words) => selector(signature) + words.join('');

/** abi.encode of static words, hashed: keccak256(abi.encode(...)). */
export const keccakWords = (words) => keccakHex(hexToBytes('0x' + words.join('')));

// ABI decoding of eth_call results

/** Splits a return blob into 32 byte words as BigInt. Rejects anything that is not whole words of hex. */
export function decodeWords(hex) {
  if (!/^0x([0-9a-fA-F]{64})*$/.test(hex)) throw new Error('eth_call result is not ABI words');
  const out = [];
  for (let i = 2; i < hex.length; i += 64) out.push(BigInt('0x' + hex.slice(i, i + 64)));
  return out;
}

export const wordToAddress = (w) => '0x' + (w & ((1n << 160n) - 1n)).toString(16).padStart(40, '0');
export const wordToBytes32 = (w) => '0x' + w.toString(16).padStart(64, '0');
