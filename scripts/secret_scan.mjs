// Pre commit secret scan. Blocks: staged .env files, any staged text containing a value from .env,
// and generic private key patterns. Prints file paths and variable NAMES only, never values.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'buffer', maxBuffer: 64 << 20 });
// --raw -z gives ":oldmode newmode oldsha newsha status\0path\0"; gitlinks (mode 160000, submodules) have no blob to scan.
// --no-renames: a rename would carry two paths per entry; as delete plus add, the added file is still scanned
const raw = git('diff', '--cached', '--raw', '-z', '--no-renames', '--diff-filter=ACM').toString().split('\0');
const staged = [];
for (let i = 0; i + 1 < raw.length; i += 2) {
  if (!raw[i].startsWith(':')) break;
  if (raw[i].split(' ')[1] !== '160000') staged.push(raw[i + 1]);
}

// Allowlist (Owais, 23 Nov 2026): these names are skipped only while their value is a bare public endpoint
// (known public host, no credentials, no path, no query). A keyed URL put in later is scanned again.
const PUBLIC_RPC_NAMES = new Set(['BSC_RPC_URL', 'BSC_TESTNET_RPC_URL']);
const PUBLIC_RPC_HOST = /^(bsc-dataseed[0-9]?(\.[a-z0-9]+)?\.(bnbchain\.org|binance\.org|defibit\.io|ninicoin\.io)|data-seed-prebsc-[12]-s[123]\.(bnbchain\.org|binance\.org)|bsc(-testnet)?-rpc\.publicnode\.com|bsc(-testnet)?\.publicnode\.com)$/;
function isPublicRpc(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password && (u.pathname === '/' || u.pathname === '') && !u.search && !u.hash && PUBLIC_RPC_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

const secrets = [];
const skipped = [];
// a linked worktree has no .env of its own: check against the main checkout's .env
const ENV = existsSync('.env') ? '.env' : join(dirname(resolve(git('rev-parse', '--git-common-dir').toString().trim())), '.env');
if (existsSync(ENV)) {
  for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (PUBLIC_RPC_NAMES.has(m[1]) && isPublicRpc(v)) { skipped.push(m[1]); continue; }
    if (v.length >= 8) secrets.push([m[1], v, v.replace(/^0x/i, '')]);
  }
}
const patterns = [
  [/PRIVATE_KEY\s*[=:]\s*['"]?(0x)?[0-9a-fA-F]{64}/, 'private key assignment'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM private key'],
  // local machine paths leak the user name and folder layout into a public repo (24 Nov 2026: review reports did)
  [/AppData[\\/]+Local[\\/]+Temp[\\/]+claude/i, 'local Claude workspace path'],
  [new RegExp(`Users[\\\\/]+${userInfo().username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]`, 'i'), 'path in your own user folder'],
];

const problems = [];
for (const f of staged) {
  const base = f.split('/').pop();
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') { problems.push(`${f}: env file must never be committed`); continue; }
  const buf = git('show', `:${f}`);
  if (buf.includes(0)) continue; // binary
  const text = buf.toString('utf8');
  for (const [name, v, bare] of secrets) if (text.includes(v) || (bare.length >= 8 && text.includes(bare))) problems.push(`${f}: contains the value of ${name}`);
  for (const [re, label] of patterns) if (re.test(text)) problems.push(`${f}: looks like a ${label}`);
}
if (problems.length) {
  console.error('Secret scan FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`Secret scan ok (${staged.length} files, ${secrets.length} env values checked${skipped.length ? `; public RPC names skipped: ${skipped.join(", ")}` : ""}).`);
