// Copyable commands shown in "How to play". Code, not prose, so they stay out of the locale files.
// CLI lines follow agent/README.md (Quickstart). The skill install lines are a draft until the repository is public.
export const SKILL_COMMANDS = [
  'git clone <repository URL> forewit && cd forewit',
  'mkdir -p .claude/skills/forewit && cp agent/SKILL.md .claude/skills/forewit/',
  'claude "Play today\'s Forewit round"',
].join('\n');

export const CLI_COMMANDS = [
  'node agent/forewit.mjs round --round-file <URL of the public round JSON>',
  'node agent/forewit.mjs forecast --p 60,40,50,30',
  'baw wallet address --json',
  'node agent/forewit.mjs commit --from 0xYourAgenticWallet --p 60,40,50,30',
  'node agent/forewit.mjs receipt --from 0xYourAgenticWallet',
  'node agent/forewit.mjs reveal --from 0xYourAgenticWallet',
  'node agent/forewit.mjs status --from 0xYourAgenticWallet',
].join('\n');

// Install snippets for the agents page; flags keep hyphens, so they live here, not in the locale files.
// claudeCode tested 24 Nov 2026: `claude mcp list` shows forewit Connected (npx -y forewit mcp, npm 0.1.1).
export const INSTALL_SNIPPETS: Record<string, string> = {
  claudeCode: 'claude mcp add forewit -- npx -y forewit mcp',
  mcpJson: JSON.stringify({ mcpServers: { forewit: { command: 'npx', args: ['-y', 'forewit', 'mcp'] } } }, null, 2),
  mcpJsonWindows: JSON.stringify({ mcpServers: { forewit: { command: 'cmd', args: ['/c', 'npx', '-y', 'forewit', 'mcp'] } } }, null, 2),
};
