// Install snippets that doc blocks can reference by name ({ code: name }); flags keep hyphens, so they live here, not in the locale files.
export const INSTALL_SNIPPETS: Record<string, string> = {
  claudeCode: 'claude mcp add forewit -- npx -y forewit mcp',
  claudeRemote: 'claude mcp add --transport http forewit https://forewit.xyz/mcp',
  plugin: '/plugin marketplace add owaisahmad870/forewit\n/plugin install forewit@forewit',
  mcpJson: JSON.stringify({ mcpServers: { forewit: { command: 'npx', args: ['-y', 'forewit', 'mcp'] } } }, null, 2),
  mcpJsonWindows: JSON.stringify({ mcpServers: { forewit: { command: 'cmd', args: ['/c', 'npx', '-y', 'forewit', 'mcp'] } } }, null, 2),
};

// One place for the Forecast in Claude links (home card and Start page)
export const TEMPLATE_URL = 'https://github.com/owaisahmad870/forewit-agent-template';
export const TEMPLATE_NEW_URL = `${TEMPLATE_URL}/generate`;
export const CLAUDE_CODE_URL = 'https://claude.ai/code';
export const CONNECTOR_URL = 'https://forewit.xyz/mcp';
