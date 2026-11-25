// /start and docs/QUICKSTART: every forewit command shown exists in the CLI, and the prose follows the wording and house rules.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import { QUICK_COMMAND, QUICK_COMMAND_WINDOWS, START_COMMANDS, Start, WINDOWS_COMMANDS } from '../pages/Start';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const cli = read('../../../agent/forewit.mjs');
const bin = read('../../../mcp/bin/forewit.mjs');
const bawLib = read('../../../agent/lib/baw.mjs');
const docs = [read('../../../docs/QUICKSTART.md'), read('../../../docs/QUICKSTART.zh.md')];

const CLI = /^(npx(\.cmd)? forewit(@latest)?|node agent\/forewit\.mjs) /;
const lines = [QUICK_COMMAND, QUICK_COMMAND_WINDOWS, ...START_COMMANDS.flat(), ...docs.flatMap((d) => d.split('\n'))].filter((l) => CLI.test(l));

describe('start commands', () => {
  it('has one command group per step', () => expect(START_COMMANDS).toHaveLength(en.start.steps.length));
  it('every npx forewit subcommand and flag exists in the CLI', () => {
    expect(lines.length).toBeGreaterThan(8);
    for (const l of lines) {
      const sub = l.replace(CLI, '').split(' ')[0];
      if (sub === 'mcp') expect(bin).toContain("cmd === 'mcp'");
      else expect(cli, l).toMatch(new RegExp(`\\b${sub}: cmd`, 'i'));
      for (const [, flag] of l.matchAll(/ --([a-z-]+)/g)) expect(cli, `${l}: --${flag}`).toMatch(new RegExp(`'?${flag}'?: \\{ type:`));
    }
  });
  it('every baw command shown is one the CLI prints or runs', () => {
    const shown = [...START_COMMANDS.flat(), ...WINDOWS_COMMANDS, ...docs.flatMap((d) => d.split('\n'))].filter((x) => /^baw(\.cmd)? /.test(x));
    expect(shown).toContain('baw.cmd auth signin');
    // the CLI prints these exact lines in its preflight, help and sign in hint (baw 1.12.0 has no wallet-status or login)
    for (const l of shown) expect(cli + bawLib, l).toContain(l.replace(/^baw\.cmd /, 'baw ').split(' --')[0]);
  });
  it('renders the steps, commands and screenshot placeholders', () => {
    const out = renderToStaticMarkup(<Start />);
    expect(out).toContain('node agent/forewit.mjs commit --execute --from 0xYourAgenticWallet');
    expect(out).toContain('npm.cmd install -g @binance/agentic-wallet@1.12.0');
    expect(out).toContain('Screenshot placeholder');
    expect(out.indexOf('npx forewit@latest start')).toBeLessThan(out.indexOf('node agent/forewit.mjs commit'));
  });
});

describe('quickstart docs', () => {
  // prose only: code blocks, code spans and the verbatim risk lines are excluded
  const prose = (d: string) => d.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').split('\n').filter((l) => !l.startsWith('>')).join('\n');
  it.each(docs.map((d, i) => [i ? 'zh' : 'en', d]))('%s has no dash characters, no hype words and no markdown tables', (_, d) => {
    const p = prose(d);
    expect(p).not.toMatch(/[-‐-―⸺⸻﹘﹣－]/);
    expect(p).not.toMatch(/\b(bet|bets|betting|earn|earns|earning|profit|profits|win|wins|winning)\b|赚钱|收益|盈利|下注/i);
    expect(d).not.toMatch(/^\|.*\|$/m);
  });
  it('both languages mark the screenshot placeholders', () => {
    expect(docs[0]).toContain('[Screenshot placeholder:');
    expect(docs[1]).toContain('[截图占位：');
  });
});
