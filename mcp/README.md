# Forewit MCP servers

Preview, testnet only (0.0.1). Targets the BSC testnet ledger until mainnet launch.

Two Model Context Protocol servers for Forewit, the commit and reveal forecasting ledger for Agent ID holders on BNB Smart Chain. One npm package, `forewit`, with one bin:

* `forewit mcp`: local server over stdio. Prepares commit, reveal and profile transactions. Never signs, never sends, never runs baw.
* `forewit mcp remote`: read only server over stateless Streamable HTTP, for hosting at `https://mcp.forewit.xyz/mcp`.
* `forewit <round|forecast|commit|reveal|status|receipt>`: the Forewit CLI (same code as `agent/forewit.mjs`).

Status: built and tested, not published to npm, not listed in the MCP Registry, not hosted. Mainnet is not deployed, so both servers target the BSC testnet ledger pinned in `agent/config.mjs` until the mainnet address is pinned there.

## Protocol and SDK

Supports MCP protocol 2025-11-25. Support for 2026-07-28 will come when the official MCP SDK adds it.

* SDK: `@modelcontextprotocol/sdk` 1.32.2 (latest on npm, 24 Nov 2026) with zod 4.6.7.
* Protocol: 2025-11-25. Neither `@modelcontextprotocol/sdk` 1.32.2 nor the split `@modelcontextprotocol/server` 2.4.0 negotiates revision 2026-07-28 yet (both list 2025-11-25 as their latest; a 2026-07-28 `initialize` is answered with 2025-11-25, which a 2026-07-28 client accepts or declines per the spec). Checked by sending `initialize` to both; the remote test asserts this fallback, so an SDK upgrade that adds 2026-07-28 shows up as a test change.
* Capabilities: tools only. No resources, prompts, logging, sampling, roots or elicitation.

## Remote server (read only)

Tools, all `readOnlyHint: true`, each with a strict input schema (`additionalProperties: false`) and an `outputSchema` with `structuredContent`:

* `get_current_round`: the featured round (open for commits with the nearest deadline, else in its reveal window, else the newest), with every question.
* `get_round {round_id}`
* `get_question {round_id, index}`: always includes the parent event question; a market with no event question is refused, never shown as a bare label.
* `get_baseline {round_id}`: read from the ledger by `eth_call`, compared with the published data.
* `get_crowd {cursor?, limit?}`: Agent ID Crowd versus market Brier, overall and per round.
* `get_leaderboard {cursor?, limit?}`: opt in public profiles only; operator wallets are filtered out even when public.
* `get_my_status {address, cursor?, limit?}`: latest round status from the ledger, history from the published data, the leaderboard row when public.
* `explain_scoring {lang?}`: the scoring page of the site (`en` or `zh`) plus the constants from the site's data layer and `agent/config.mjs`.

Data sources:

* The published site data (`index.json`, `snapshot.json`, `rounds/*.json`), joined by the site's own `web/src/lib/data.ts` (types stripped into `vendor/` at build time, so the numbers match the site). `FOREWIT_DATA` sets an https base URL or a local folder; default `https://forewit.xyz/data/`. Cached 60 s.
* Read only `eth_call` to the RPC pinned in `agent/config.mjs`. The snapshot's chain id and ledger must match a pinned network or nothing is served. Chain reads cached 30 s per round.

Untrusted text: market titles, labels and tags come back only inside `untrusted_market_text`, profile names only inside `untrusted_profile_name`. Control and bidi characters are stripped and length is capped (`agent/lib/question.mjs`). Error messages never echo market text.

HTTP hardening:

* `POST /mcp` only (stateless, JSON responses, one server and transport per request); other methods 405, other paths 404.
* Origin allowlist (`FOREWIT_ALLOWED_ORIGINS`, comma separated, default `https://forewit.xyz,https://www.forewit.xyz`). Requests without an Origin header (non browser clients) pass; any other Origin gets 403.
* Request body limit 64 KB (413). Rate limit per client address, default 60 requests per minute (`FOREWIT_RATE_LIMIT`, 429). Behind a reverse proxy all clients share one socket address, so the default becomes a global cap: raise `FOREWIT_RATE_LIMIT` there and enforce the per client limit at the proxy.
* No secrets: nothing to configure besides `PORT`, `HOST` (default 127.0.0.1), `FOREWIT_DATA`, `FOREWIT_ALLOWED_ORIGINS`, `FOREWIT_RATE_LIMIT`.

## Local server (stdio)

Run with `npx forewit mcp` (after publish) or `node mcp/bin/forewit.mjs mcp` from this repo. Client config:

```json
{ "mcpServers": { "forewit": { "command": "npx", "args": ["forewit", "mcp"] } } }
```

Tools:

* `prepare_commit {from, probabilities_percent, round_id?, network?}`: reads the round from the ledger, refuses after the commit deadline or on a wrong question count, makes a 32 byte salt with `crypto.randomBytes`, checks the hash encoding against the ledger's `computeCommitHash` with a throwaway salt, saves the receipt to `~/.forewit/` with owner only permissions (`agent/lib/secure_file.mjs`, icacls on Windows), then returns the commit hash, calldata, `{to, value: "0", data}` and the exact `baw contract-call preview` command. The salt is not returned (`salt_returned: false`).
* `prepare_reveal {from, round_id?, network?}`: refused before the commit deadline (chain time). After it, finds the receipt matching the onchain commit and returns the reveal calldata. That calldata contains the salt by construction; it is returned only when the salt is about to be public onchain anyway.
* `prepare_profile {from, is_public, label?, network?}`: `setPublicProfile(bool,string)` calldata, checked against viem in the tests. Opting out always clears the name.
* `my_receipts {from?, round_id?, network?, include_salt?, cursor?, limit?}`: receipt metadata and file paths. Salts only with `include_salt: true`, for a private backup the user asked for, and only once every listed round is past its commit deadline (chain time on the receipt's pinned network); otherwise the call is a tool error. Files in `~/.forewit` that are not valid receipts are skipped and listed in `warnings` (file and reason), never failing the whole call.

Decision on salts: salts never enter agent context before the commit deadline. Before it, the salt plus forecast would let anyone reveal or copy the forecast, so it stays on disk; `prepare_reveal` and `my_receipts include_salt` are both refused until then. After the deadline the model sees a salt only in reveal calldata or when the user asks `my_receipts` for a backup.

Guarantees: no tool signs, sends or runs baw (a test runs the stdio server with a fake baw that leaves a marker file and asserts it never ran). stdout carries JSON RPC only; logs go to stderr (`console.log` is redirected). Network access is the pinned RPC only. A `home` folder is not a tool input, and neither are round file URLs.

`baw_can_sign_this_network` is false on testnet: baw signs on BSC mainnet (chain 56) only, so on testnet the preview command shows the format and the transaction object is what you send from a testnet wallet.

## Build and test

```sh
cd mcp
npm ci
npm test        # builds vendor/ then runs node --test test/
```

`npm run build` (also `prepack`) copies `agent/forewit.mjs`, `agent/config.mjs`, `agent/lib/*`, `web/src/lib/question.mjs`, the type stripped `web/src/lib/data.ts` and the scoring docs from both locales into `vendor/` (gitignored). Needs Node 22.13 or later for `module.stripTypeScriptTypes`.

## MCP Inspector run

Recorded in `mcp/INSPECTOR.md`.

## Ready for the publish step (owner approval needed, not done)

* `npm pack` output is checked (see `INSPECTOR.md`): bin, src, vendor, README only.
* Preview publish (0.0.1, testnet only, no provenance): `npm publish --access public` by the owner after `npm login`. At mainnet launch, with the repo public, republish with `npm publish --provenance --access public` from a CI workflow with `id-token: write`.
* MCP Registry: needs a `server.json` and a namespace (`io.github.owaisahmad870/forewit` or a domain namespace `xyz.forewit/forewit` with DNS verification). Not created.
* Hosting the remote server: run `node bin/forewit.mjs mcp remote` behind TLS at `mcp.forewit.xyz`, with `HOST=0.0.0.0` and a proxy rate limit.
* Reserve the npm name `forewit` before the docs page goes live: the page tells users to run `npx forewit mcp`, and the name is unregistered today.
* Provenance needs a public repository and a publish workflow with `id-token: write`; neither exists yet.
* `agent/config.mjs` is copied at pack time: a package published before the mainnet ledger is pinned stays testnet only until republished.
