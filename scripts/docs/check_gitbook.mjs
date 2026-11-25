// Checks the GitBook pages (gitbook/ and gitbook/zh/). Exit code 1 on any finding.
// Fails on: a page not in SUMMARY or a SUMMARY entry with no file, a dead internal link, a forewit subcommand or flag
// the CLI does not accept, an unknown address or a ledger address that differs from agent/config.mjs, a markdown table,
// a "-" bullet, a hyphen or dash in prose, a banned word, a missing front matter description.
// Run: node scripts/docs/check_gitbook.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';

const ROOT = 'gitbook';
const cli = readFileSync('agent/forewit.mjs', 'utf8');
const SUBS = new Set([...cli.matchAll(/(\w+): cmd[A-Z]\w*/g)].map((m) => m[1]).concat(['mcp', 'remote']));
const FLAGS = new Set([...cli.match(/options: \{([\s\S]*?)\n    \},/)[1].matchAll(/'?([\w-]+)'?: \{ type/g)].map((m) => m[1]));
FLAGS.add('help').add('version');
const config = readFileSync('agent/config.mjs', 'utf8');
const CONFIG_ADDR = new Set([...config.matchAll(/0x[0-9a-fA-F]{40}/g)].map((m) => m[0].toLowerCase()));
const KNOWN = new Set([
  '0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc', // ForewitScores mainnet
  '0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F', // Agent ID
  '0x22DA1810B194ca018378464a58f6Ac2B10C9d244', '0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F', '0xF64b0b318AAf83BD9071110af24D24445719A07F', // CTFs
  '0xF3b4728B30F0F380d77dE9d025E33680F66591bD', '0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18', '0x6732027E7f908E274bF4360Ce19cC182F82d008C', // admin, keeper, deployer
  '0xD1460596715c9f39a6EFBfd2760F62A4bF586C38', // v2 keeper
  '0x0000000000000000000000000000000000000000',
].map((a) => a.toLowerCase()).concat([...CONFIG_ADDR]));
const BANNED = /\b(bet|bets|betting|earn|earns|earning|profit|profits|win money)\b/i;
const ALLOWED_PHRASES = [/does not take bets/gi, /no bets/gi, /never (say )?bet/gi];

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : f.endsWith('.md') && files.push(p); } };
walk(ROOT);
const problems = [];
const bad = (file, line, msg) => problems.push(`${relative('.', file).replace(/\\/g, '/')}:${line}: ${msg}`);

// SUMMARY coverage per book (root and zh)
for (const book of [ROOT, join(ROOT, 'zh')]) {
  const summary = join(book, 'SUMMARY.md');
  if (!existsSync(summary)) continue;
  const linked = new Set([...readFileSync(summary, 'utf8').matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => posix.normalize(m[1])));
  for (const l of linked) if (!existsSync(join(book, l))) bad(summary, 0, `SUMMARY links a missing page ${l}`);
  for (const f of files) {
    const rel = relative(book, f).replace(/\\/g, '/');
    if (rel.startsWith('..') || rel === 'SUMMARY.md' || (book === ROOT && rel.startsWith('zh/'))) continue;
    if (!linked.has(rel)) bad(f, 0, 'page is not in SUMMARY.md');
  }
}

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  const isSummary = f.endsWith('SUMMARY.md');
  if (!isSummary && !/^---\r?\ndescription: .+\r?\n---/.test(text)) bad(f, 1, 'missing front matter description');
  let fence = false, front = text.startsWith('---');
  lines.forEach((raw, i) => {
    const n = i + 1;
    if (front) { if (i > 0 && raw.startsWith('---')) front = false; return; }
    if (/^\s*```/.test(raw)) { fence = !fence; return; }
    // commands, flags and addresses are checked inside and outside code
    for (const m of raw.matchAll(/(?:forewit\.mjs|npx(?: -y)? forewit|^\s*forewit)\s+([a-z]+)([^`\n]*)/g)) {
      if (!SUBS.has(m[1])) bad(f, n, `unknown forewit subcommand "${m[1]}"`);
      for (const fl of m[2].matchAll(/--([a-z][\w-]*)/g)) if (!FLAGS.has(fl[1])) bad(f, n, `unknown forewit flag --${fl[1]}`);
    }
    for (const a of raw.matchAll(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g)) if (!KNOWN.has(a[0].toLowerCase())) bad(f, n, `unknown address ${a[0]}`);
    for (const l of raw.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      const target = l[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      if (!existsSync(join(dirname(f), target))) bad(f, n, `dead internal link ${target}`);
    }
    if (fence) return;
    if (/^\s*\|.*\|\s*$/.test(raw)) bad(f, n, 'markdown table (use a list)');
    if (/^\s*- /.test(raw)) bad(f, n, 'bullet must use "*"');
    if (raw.startsWith('{%')) return;
    const prose = raw.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, '').replace(/0x[0-9a-fA-F]+/g, '');
    if (/[–—]|\w-\w|\s-\s/.test(prose)) bad(f, n, `hyphen or dash in prose: ${prose.trim().slice(0, 80)}`);
    let p = prose; for (const r of ALLOWED_PHRASES) p = p.replace(r, '');
    if (BANNED.test(p)) bad(f, n, `banned word: ${p.match(BANNED)[0]}`);
  });
}

// the ledger address on every page must be the pinned one
const pinned = (config.match(/mainnet:[\s\S]*?ledger: '(0x[0-9a-fA-F]{40})'/) || [])[1];
if (!pinned) problems.push('agent/config.mjs: no pinned mainnet ledger found');
console.log(`checked ${files.length} pages, CLI subcommands ${[...SUBS].join(' ')}, ${problems.length} problem(s)`);
for (const p of problems) console.log(p);
process.exitCode = problems.length ? 1 : 0;
