#!/usr/bin/env node
// forewit mcp            local stdio MCP server (prepares transactions, never signs)
// forewit mcp remote     read only Streamable HTTP MCP server (PORT, HOST, FOREWIT_DATA, FOREWIT_ALLOWED_ORIGINS)
// forewit <anything else> the Forewit CLI (round, forecast, commit, reveal, status, receipt)
const [cmd, sub] = process.argv.slice(2);

if (cmd === 'mcp' && sub === 'remote') {
  const { startHttp } = await import('../src/remote.mjs');
  const http = await startHttp();
  const a = http.address();
  console.error(`forewit mcp remote: listening on http://${a.address}:${a.port}/mcp`);
} else if (cmd === 'mcp') {
  console.log = console.error; // stdout carries JSON RPC only; any stray log goes to stderr
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { createLocalServer } = await import('../src/local.mjs');
  await createLocalServer().connect(new StdioServerTransport());
  console.error('forewit mcp: local server on stdio');
} else {
  const { main } = await import('../vendor/agent/forewit.mjs');
  main(process.argv.slice(2)).catch((err) => {
    console.error(`forewit: ${err.message}`);
    process.exitCode = 1;
  });
}
