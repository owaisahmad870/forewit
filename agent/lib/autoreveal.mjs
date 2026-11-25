// Auto reveal: v1 (ForecastLedger) carries the time locked copy of (packed, salt) after the commit's ABI arguments;
// v2 (OpenForecasts) passes the same bytes as the commit's sealedCopy argument. It is
// encrypted with tlock to a drand quicknet round that starts 60 s after the commit deadline, so nobody (Forewit
// included) can read it while commits are open; after that anyone can decrypt it and call revealFor. The keeper does so
// and checks the decrypted values against the onchain commit hash first. The ledger ignores trailing calldata, so the
// commit itself is unchanged (contracts/test: test_commit_with_trailing_autoreveal_bytes_then_revealFor).
// Format after the 68 byte commit calldata: "FWAR" (4 bytes) | version 1 (1 byte) | length (2 bytes) | age armored ciphertext.

export const AR_MAGIC = '46574152'; // "FWAR"
export const AR_VERSION = 1;
export const AR_MARGIN_S = 60; // drand round time minus commit deadline: covers block time versus wall clock drift
export const AR_MAX_BYTES = 2048;
// drand quicknet (League of Entropy mainnet, unchained, 3 s rounds): pinned so a changed library default cannot switch chains
export const QUICKNET_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

async function tlock() {
  try {
    const t = await import('tlock-js');
    if (t.defaultChainInfo.hash !== QUICKNET_HASH) throw new Error('tlock-js default chain is not drand quicknet; refusing');
    return t;
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error('auto reveal needs the tlock-js package (npm ci in the repository, or the forewit npm package). Use --no-auto-reveal to commit without it.');
    throw e;
  }
}

const hex32 = (x) => BigInt(x).toString(16).padStart(64, '0');

/** Hex tail (no 0x) to append to the commit calldata. Needs no network: the quicknet public key is built in. */
export async function sealForDeadline({ packed, salt, commitDeadline }) {
  const t = await tlock();
  const info = t.defaultChainInfo;
  const round = t.roundAt((Number(commitDeadline) + AR_MARGIN_S) * 1000, info);
  const offline = { chain: () => ({ info: async () => info }) };
  const ct = await t.timelockEncrypt(round, t.Buffer.from(hex32(packed) + String(salt).slice(2), 'hex'), offline);
  const bytes = Buffer.from(ct, 'utf8');
  if (bytes.length > AR_MAX_BYTES) throw new Error('auto reveal ciphertext is unexpectedly large; refusing');
  return { tail: AR_MAGIC + AR_VERSION.toString(16).padStart(2, '0') + bytes.length.toString(16).padStart(4, '0') + bytes.toString('hex'), drandRound: round };
}

/** The ciphertext inside a transaction input (searched, so a wallet that wraps the call still works), or null. */
export function ciphertextOf(inputHex) {
  const h = String(inputHex).toLowerCase().replace(/^0x/, '');
  for (let i = h.lastIndexOf(AR_MAGIC); i >= 0; i = i ? h.lastIndexOf(AR_MAGIC, i - 1) : -1) {
    if (i % 2) continue;
    const ver = parseInt(h.slice(i + 8, i + 10), 16);
    const len = parseInt(h.slice(i + 10, i + 14), 16);
    const body = h.slice(i + 14, i + 14 + len * 2);
    if (ver !== AR_VERSION || !len || len > AR_MAX_BYTES || body.length !== len * 2) continue;
    const text = Buffer.from(body, 'hex').toString('utf8');
    if (text.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')) return text;
  }
  return null;
}

/** Decrypts after the drand round (network: api.drand.sh). Throws before it. Returns { packed: bigint, salt: 0x hex }. */
export async function openSealed(ciphertext) {
  const t = await tlock();
  const out = await t.timelockDecrypt(ciphertext, t.mainnetClient());
  if (out.length !== 64) throw new Error('auto reveal payload is not 64 bytes');
  return { packed: BigInt('0x' + out.subarray(0, 32).toString('hex')), salt: '0x' + out.subarray(32).toString('hex') };
}
