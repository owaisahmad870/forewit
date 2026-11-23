# MCP Inspector run, 24 Nov 2026

Tool: `@modelcontextprotocol/inspector` 2.16.0 (latest on npm that day), CLI mode, Windows 11, Node 26.13.1. Local server with HOME pointed at an empty scratch folder. Remote server on 127.0.0.1:8799 with `FOREWIT_DATA` set to `web/public/data` (real testnet snapshot of instance E) and the pinned public testnet RPC for chain reads. Nothing was signed or sent; no mainnet call.

## Local server (stdio)

* `npx @modelcontextprotocol/inspector@2.16.0 --cli node bin/forewit.mjs mcp --method tools/list`
  * Saw 4 tools: prepare_commit, prepare_reveal, prepare_profile, my_receipts. Every inputSchema has `additionalProperties: false`; my_receipts has `readOnlyHint: true`, the prepare tools `readOnlyHint: false`, `destructiveHint: false`. Each has an outputSchema.
  * stderr showed only `forewit mcp: local server on stdio`.
* `... --method tools/call --tool-name prepare_profile --tool-arg from=0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5 --tool-arg is_public=true --tool-arg label=forewit`
  * structuredContent and the same JSON in the text block: `transaction {chain_id 97, to 0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1, value "0", data 0x460bbce1...}`, the `baw contract-call preview --binanceChainId 97 ...` command, `baw_can_sign_this_network: false`, the risk warning.
* `... --method tools/call --tool-name prepare_commit --tool-arg from=0xcBa4...61D5 --tool-arg 'probabilities_percent=[60,40,50]'`
  * Read round 1 from the testnet ledger and returned `isError: true` with `commits for round 1 closed at 23 Nov 2026 20:17 UTC`: a tool execution error, not a protocol error. No receipt was written.
* `... --method tools/call --tool-name my_receipts`
  * `{"folder": "<scratch home>\\.forewit", "receipts": [], "next_cursor": null}`.

## Remote server (Streamable HTTP)

Started with `PORT=8799 FOREWIT_DATA=<repo>/web/public/data node bin/forewit.mjs mcp remote`; it logged `forewit mcp remote: listening on http://127.0.0.1:8799/mcp`.

* `npx @modelcontextprotocol/inspector@2.16.0 --cli http://127.0.0.1:8799/mcp --transport http --method tools/list`
  * Saw 8 tools: get_current_round, get_round, get_question, get_baseline, get_crowd, get_leaderboard, get_my_status, explain_scoring.
* `--method tools/call --tool-name get_current_round`: round 1, phase scored, 2 commits, 1 scored, 1 forfeited, baseline present.
* `get_baseline round_id=1`: `source "chain", baseline_set true, baseline_bps [3500, 6350, 3150], published_data_agrees true` (live eth_call to the pinned testnet ledger matched the published snapshot).
* `get_question round_id=1 index=0`: market 437, outcome Yes, baseline 3500, crowd 8000, and the titles only inside `untrusted_market_text` (event question "Testnet mock question 1 ...", label "Mock outcome 1", tags Testnet and Mock).
* `get_leaderboard`: `forecasters 2, public_count 0, rows []` (both testnet forecasters are operator wallets with no public profile).
* `get_my_status address=0x04ca5c9c38ac62d48fda6fe5328db4a0edee4b7a`: chain status for round 1 (committed, revealed, scored) and history with Brier 0.065 and skill 0.348.
* `get_crowd`: crowd Brier 0.065 against market Brier 0.413 over 2 resolved questions.

## Packaging check

* `npm pack` (runs the build): 15 files, 36.4 kB: bin, src, vendor (agent CLI, site data layer, scoring docs), README, package.json.
* Installed the tarball into an empty scratch project: `npx forewit mcp` answered `initialize` with protocol 2025-11-25 and listed the 4 local tools; `npx forewit --help` printed the CLI help.
