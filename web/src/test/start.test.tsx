// /start and docs/QUICKSTART: every forewit command shown exists in the CLI, and the prose follows the wording and house rules.
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import { ANY_COMMANDS, QUICK_COMMAND, QUICK_COMMAND_WINDOWS, REVEAL_COMMAND, SKILL_COMMANDS, Start } from '../pages/Start';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const cli = read('../../../agent/forewit.mjs');
const bin = read('../../../mcp/bin/forewit.mjs');
const bawLib = read('../../../agent/lib/baw.mjs');
const docs = [read('../../../docs/QUICKSTART.md'), read('../../../docs/QUICKSTART.zh.md')];

const CLI = /^(npx(\.cmd)? forewit(@latest)?|node agent\/forewit\.mjs) /;
const lines = [QUICK_COMMAND, QUICK_COMMAND_WINDOWS, REVEAL_COMMAND, ...ANY_COMMANDS, ...docs.flatMap((d) => d.split('\n'))].filter((l) => CLI.test(l));

describe('start commands', () => {
  it('has one command per step that shows one', () => {
    expect(SKILL_COMMANDS).toHaveLength(2);
    expect(ANY_COMMANDS).toHaveLength(en.start.any.steps.length - 1);
  });
  it('every npx forewit subcommand and flag exists in the CLI', () => {
    expect(lines.length).toBeGreaterThan(4);
    for (const l of lines) {
      const sub = l.replace(CLI, '').split(' ')[0];
      if (sub === 'mcp') expect(bin).toContain("cmd === 'mcp'");
      else expect(cli, l).toMatch(new RegExp(`\\b${sub}: cmd`, 'i'));
      for (const [, flag] of l.matchAll(/ --([a-z-]+)/g)) expect(cli, `${l}: --${flag}`).toMatch(new RegExp(`'?${flag}'?: \\{ type:`));
    }
  });
  it('every baw command in the quickstart docs is one the CLI prints or runs', () => {
    const shown = docs.flatMap((d) => d.split('\n')).filter((x) => /^baw(\.cmd)? /.test(x));
    for (const l of shown) expect(cli + bawLib, l).toContain(l.replace(/^baw\.cmd /, 'baw ').split(' --')[0]);
  });
  it('renders Claude Code first, then the computer and agent paths, then the any market box, with no manual path', () => {
    const out = renderToStaticMarkup(<Start />);
    const at = (x: string) => out.indexOf(x);
    expect(at('forewit-agent-template')).toBeGreaterThan(0);
    expect(at('npx forewit@latest start')).toBeGreaterThan(at('forewit-agent-template'));
    expect(at('npx skills add owaisahmad870/forewit')).toBeGreaterThan(at('npx forewit@latest start'));
    expect(at('npx forewit@latest predict')).toBeGreaterThan(at('npx skills add owaisahmad870/forewit'));
    expect(out).not.toContain('node agent/forewit.mjs');
  });
  it('every phone screenshot exists and the examples follow the steps', () => {
    const out = renderToStaticMarkup(<Start />);
    const shots = [...out.matchAll(/src="\/(start\/[a-z]+\.webp)"/g)].map((m) => m[1]);
    expect(shots).toHaveLength(9); // 8 step screenshots plus the workflow animation
    for (const s of shots) expect(existsSync(new URL(`../../public/${s}`, import.meta.url)), s).toBe(true);
    expect(out.indexOf(en.start.phone.examples[0])).toBeGreaterThan(out.indexOf('PREDICT_API_KEY='));
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
