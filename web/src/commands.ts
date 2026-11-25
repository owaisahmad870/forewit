// Install snippets that doc blocks can reference by name ({ code: name }); flags keep hyphens, so they live here, not in the locale files.
export const INSTALL_SNIPPETS: Record<string, string> = {
  claudeCode: 'claude mcp add forewit -- npx -y forewit mcp',
  mcpJson: JSON.stringify({ mcpServers: { forewit: { command: 'npx', args: ['-y', 'forewit', 'mcp'] } } }, null, 2),
  mcpJsonWindows: JSON.stringify({ mcpServers: { forewit: { command: 'cmd', args: ['/c', 'npx', '-y', 'forewit', 'mcp'] } } }, null, 2),
};
