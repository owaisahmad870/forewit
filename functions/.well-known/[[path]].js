// The connector at /mcp needs no sign in. Without this, the site's page fallback answered /.well-known/oauth-* with
// 200 HTML, so Claude looked for an OAuth server and failed to register. A plain 404 means: no authorization server.
export const onRequest = () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
