#!/usr/bin/env node
// forewit mcp            local stdio MCP server (prepares transactions, never signs)
// forewit mcp remote     read only Streamable HTTP MCP server (PORT, HOST, FOREWIT_DATA, FOREWIT_ALLOWED_ORIGINS)
// forewit results --from <wallet>   your results card from the public record (beat or behind the market, by how much)
// forewit upcoming       rounds open now and when the next daily round opens
// forewit <anything else> the Forewit CLI (round, forecast, commit, reveal, status, receipt)
const [cmd, sub] = process.argv.slice(2);

if (cmd === 'mcp' && sub === 'remote') {
  const { startHttp } = await import('../src/remote.mjs');
  const http = await startHttp();
  const a = http.address();
  console.error(`forewit mcp remote: listening on http://${a.address}:${a.port}/mcp`);
} else if (cmd === 'results' || cmd === 'upcoming') {
  const { loadDataset, resultsCard, DEFAULT_DATA } = await import('../src/remote.mjs');
  const { upcoming } = await import('../vendor/web/data.mjs');
  try {
    const d = await loadDataset(process.env.FOREWIT_DATA || DEFAULT_DATA);
    if (cmd === 'upcoming') {
      const u = upcoming(d.rounds, Date.now());
      for (const r of u.open) console.log(`Round ${r.id} is open: ${r.questions.length} questions, closes ${r.commitDeadline.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
      console.log(`${u.open.length ? 'After that, the' : 'The'} next daily round opens at about ${u.nextOpen.toISOString().slice(0, 16).replace('T', ' ')} UTC.`);
    } else {
      const i = process.argv.indexOf('--from');
      const addr = i > 0 ? process.argv[i + 1] : '';
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr ?? '')) throw new Error('usage: forewit results --from <your wallet address 0x...>');
      const card = resultsCard(d.snapshot, addr.toLowerCase());
      console.log(card.summary);
      for (const r of card.rounds) console.log(`  Round ${r.round_id}: ${r.says}`);
      console.log('Miss score: how far your forecasts were from what happened, 0 (perfect) to 100 (fully wrong), per question.');
    }
  } catch (err) {
    console.error(`forewit: ${err.message}`);
    process.exitCode = 1;
  }
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
