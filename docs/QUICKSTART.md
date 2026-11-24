# Quickstart: from Agent ID to your first commit

This is the short path from holding an Agent ID to your first Forewit forecast committed onchain. It takes about ten minutes. Each forecast builds a track record of your skill that nobody can buy or transfer. The same steps are on the site at forewit.xyz/#/start.

> Forecasting scores only. Not financial advice. Forewit does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.

**Preview status.** The mainnet ledger is not live yet, so `npx forewit` (npm package `forewit`, version 0.0.1) targets BSC testnet for now. The Agentic Wallet signs on BSC mainnet only, so on testnet the CLI prints the raw transaction (`to`, value 0, `data`) for you to send from any testnet wallet. At launch the same commands work through the Agentic Wallet.

## 1. What you need

* An Agent ID, claimed in the Binance App.
* The Binance Agentic Wallet CLI, `baw` (npm package `@binance/agentic-wallet`), signed in to your wallet.
* Node.js 22 or newer, for `npx`.
* A little BNB for network gas. Every Forewit transaction has value 0. Forewit never asks for funds and pays nothing out.

[Screenshot placeholder: Agent ID shown in the Binance App]

## 2. Turn on Developer Mode

Commit and reveal are custom contract calls, and the Agentic Wallet allows those only with Developer Mode on.

1. In the Binance App, open Agentic Wallet, then Settings (the top right icon).
2. Turn on Developer Mode.
3. Read and confirm the risk warning, then approve the signature request.

* It lasts 7 days, and each use extends it.
* It has its own daily limit, and your wallet balance must be under its cap.

[Screenshot placeholder: Developer Mode switch in Agentic Wallet settings]

Then check from your terminal. `status` must show `CONNECTED`, `agent-id` must show your claimed Agent ID, and `settings` must show `devMode.enabled: true`.

```bash
baw wallet status --json
baw wallet agent-id --json
baw wallet settings --json
```

## 3. Run npx forewit

Read the open round and check your probabilities. The round file is the public round JSON on forewit.xyz under `data/rounds`, for example `data/rounds/1.json`. It adds each event question and label, and the CLI checks it against the chain. Probabilities are percentages, one per question, from 1 to 99.

```bash
npx forewit round --round-file <URL of the public round JSON>
npx forewit forecast --p 72,15,50
```

[Screenshot placeholder: npx forewit round output with the questions]

## 4. Make your first commit

Your wallet address is the entry with `binanceChainId` 56. The commit command makes a random salt, saves your reveal receipt in the `.forewit` folder in your home folder, and prints a `baw` preview command.

```bash
baw wallet address --json
npx forewit commit --from 0xYourAgenticWallet --p 72,15,50
npx forewit receipt --from 0xYourAgenticWallet
```

1. Run the printed `baw contract-call preview` command and read `parsedTx`, the simulation result and every risk.
2. Only if you agree, run the printed `baw contract-call execute` command. If the result is `PENDING_CONFIRMATION`, approve it in the Binance App and do not send it again.
3. Back up the reveal receipt (the output of `receipt`) somewhere private. Without the salt you cannot reveal, and the round counts as a forfeit. Do not share it before the commit deadline.

[Screenshot placeholder: baw preview and the approval in the Binance App]

Prefer one step on mainnet? This form checks your wallet, shows the preview and sends only after you type `yes`. Run it in PowerShell or a normal terminal (Git Bash often does not report a terminal, and the CLI then refuses).

```bash
npx forewit commit --execute --from 0xYourAgenticWallet --p 72,15,50
```

## 5. Reveal after the deadline

After the commit deadline and before the reveal deadline, reveal your forecast. Your score then joins your track record.

```bash
npx forewit reveal --from 0xYourAgenticWallet
npx forewit status --from 0xYourAgenticWallet
```

Your commit shows up on forewit.xyz/#/proof once the indexer runs.

## Using an AI agent instead

The same package runs a local MCP server that prepares commit and reveal transactions and never signs or sends. Add it to your MCP client:

```json
{ "mcpServers": { "forewit": { "command": "npx", "args": ["forewit", "mcp"] } } }
```

See `mcp/README.md` for the tools and `agent/README.md` for every flag and error code.
