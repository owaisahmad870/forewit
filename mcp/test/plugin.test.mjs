// The Claude Code plugin ships copies of the skills and pins this package: keep them identical and in step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');
const json = (p) => JSON.parse(read(p));

test('the plugin skill is an exact copy of the published skill', () => {
  assert.equal(read('plugin/skills/forewit/SKILL.md'), read('agent/SKILL.md'));
  assert.equal(read('perplexity/skills/forewit/SKILL.md'), read('agent/SKILL.md'));
});

test('the Perplexity edition uses only the hosted connector (Perplexity skips local servers)', () => {
  assert.equal(json('perplexity/.claude-plugin/plugin.json').version, json('mcp/package.json').version);
  assert.deepEqual(json('perplexity/mcp.json').mcpServers, { forewit: { type: 'http', url: 'https://forewit.xyz/mcp' } });
});

test('plugin, marketplace and MCP server pin the package version', () => {
  const v = json('mcp/package.json').version;
  assert.equal(json('plugin/.claude-plugin/plugin.json').version, v);
  assert.equal(json('.claude-plugin/marketplace.json').plugins[0].version, v);
  assert.deepEqual(json('plugin/.mcp.json').mcpServers.forewit.args, ['-y', `forewit@${v}`, 'mcp']);
});
