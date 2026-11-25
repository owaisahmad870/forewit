// The read only remote MCP server for a Workers runtime (Cloudflare Pages Function at forewit.xyz/mcp): stateless
// Streamable HTTP, one McpServer per request, the same nine read only tools as `forewit mcp remote`. It never prepares
// a commit (that would put a salt on our server) and never signs.
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createRemoteServer } from './remote.mjs';

export async function handleMcp(request, { data = 'https://forewit.xyz/data/' } = {}) {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: stateless server, use POST' }, id: null }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } });
  }
  // lenient Accept: the transport requires both types; some clients send only application/json
  const accept = request.headers.get('accept') ?? '';
  if (!/text\/event-stream/.test(accept) || !/application\/json/.test(accept)) {
    const headers = new Headers(request.headers);
    headers.set('accept', 'application/json, text/event-stream');
    request = new Request(request, { headers });
  }
  const server = createRemoteServer({ data });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}
