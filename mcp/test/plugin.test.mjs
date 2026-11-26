// The Claude Code plugin ships copies of the skills and pins this package: keep them identical and in step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8').replace(/\r\n/g, '\n');
const json = (p) => JSON.parse(read(p));

test('plugin skills are exact copies of the published skills', () => {
  assert.equal(read('plugin/skills/forewit/SKILL.md'), read('agent/SKILL.md'));
  assert.equal(read('plugin/skills/forelens/SKILL.md'), read('skills/forelens/SKILL.md'));
});

test('plugin, marketplace and MCP server pin the package version', () => {
  const v = json('mcp/package.json').version;
  assert.equal(json('plugin/.claude-plugin/plugin.json').version, v);
  assert.equal(json('.claude-plugin/marketplace.json').plugins[0].version, v);
  assert.deepEqual(json('plugin/.mcp.json').mcpServers.forewit.args, ['-y', `forewit@${v}`, 'mcp']);
});
