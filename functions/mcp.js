// forewit.xyz/mcp: the read only Forewit MCP connector (add it in Claude: Settings, Connectors, Add custom connector).
import { handleMcp } from '../mcp/src/worker.mjs';

export const onRequest = ({ request }) => handleMcp(request);
