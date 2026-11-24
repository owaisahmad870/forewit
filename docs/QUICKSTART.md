# Quickstart: from Agent ID to your first commit

This is the short path from holding an Agent ID to your first Forewit forecast committed onchain. It takes about ten minutes. Each forecast builds a track record of your skill that nobody can buy or transfer. The same steps are on the site at forewit.xyz/#/start.

> Forecasting scores only. Not financial advice. Forewit does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.

**Status.** The ForecastLedger is live on BSC mainnet at `0xd11e67ff70ACD42E01d79130f280162b00Bb09B6`. Use the CLI from the repository (`node agent/forewit.mjs`), which targets mainnet by default. The npm package (`npx forewit`, version 0.0.1) is still a testnet preview until the next release, so do not use it for mainnet commits yet.

## 1. What you need

* An Agent ID, claimed in the Binance App.
* Node.js 26 or newer, and git.
* A little BNB for network gas. Every Forewit transaction has value 0. Forewit never asks for funds and pays nothing out.

Get the CLI:

```bash
git clone https://github.com/owaisahmad870/forewit.git
cd forewit
npm ci
```

[Screenshot placeholder: Agent ID shown in the Binance App]

## 2. Install and sign in to the Agentic Wallet CLI

Install `baw`, the Binance Agentic Wallet CLI:

```bash
npm install -g @binance/agentic-wallet@1.12.0
```

On Windows, PowerShell may refuse with "running scripts is disabled on this system". Then call the `.cmd` forms instead, which need no script policy change, and use `baw.cmd` wherever this guide says `baw`:

```powershell
npm.cmd install -g @binance/agentic-wallet@1.12.0
baw.cmd wallet status --json
```

Check that you are signed in. `status` must show `CONNECTED`. If it does not, sign in: the command shows a QR code to scan with the Binance App.

```bash
baw wallet status --json
baw auth signin
```

## 3. Turn on Developer Mode

Commit and reveal are custom contract calls, and the Agentic Wallet allows those only with Developer Mode on.

1. In the Binance App, open Agentic Wallet, then Settings (the top right icon).
2. Turn on Developer Mode.
3. Read and confirm the risk warning, then approve the signature request.

* It lasts 7 days, and each use extends it.
* It has its own daily limit, and your wallet balance must be under its cap.

[Screenshot placeholder: Developer Mode switch in Agentic Wallet settings]

Then check from your terminal. `agent-id` must show your claimed Agent ID, and `settings` must show `devMode.enabled: true`.

```bash
baw wallet agent-id --json
baw wallet settings --json
```

## 4. Read the round

The round file is the public round JSON. It adds each event question and label, and the CLI checks it against the chain. In the repository it is `web/public/data/rounds/<round number>.json` (run `git pull` first for the latest round). Probabilities are percentages, one per question, from 1 to 99. Round 1 has 4 questions, so it takes 4 numbers.

```bash
node agent/forewit.mjs round --round-file web/public/data/rounds/1.json
node agent/forewit.mjs forecast --p 60,40,50,30
```

[Screenshot placeholder: round output with the questions]

## 5. Make your first commit

Your wallet address is the entry with `binanceChainId` 56. The commit command makes a random salt, saves your reveal receipt in the `.forewit` folder in your home folder, shows the wallet preview and sends only after you type `yes`. Run it in PowerShell or a normal terminal (Git Bash often does not report a terminal, and the CLI then refuses).

```bash
baw wallet address --json
node agent/forewit.mjs commit --execute --from 0xYourAgenticWallet --p 60,40,50,30 --round-file web/public/data/rounds/1.json
node agent/forewit.mjs receipt --from 0xYourAgenticWallet
```

1. Read the preview: `parsedTx`, the simulation result and every risk. Type `yes` only if you agree.
2. If the result is `PENDING_CONFIRMATION`, approve it in the Binance App and do not send it again.
3. Back up the reveal receipt (the output of `receipt`) somewhere private. Without the salt you cannot reveal, and the round counts as a forfeit. Do not share it before the commit deadline.

Without `--execute` the commit command sends nothing and prints the `baw contract-call` preview and execute commands for you to run yourself.

[Screenshot placeholder: the preview and the approval in the Binance App]

## 6. Reveal after the deadline

After the commit deadline and before the reveal deadline, reveal from the same machine (the salt is in your receipt). Your score then joins your track record. The site shows a reveal due banner while a reveal window is open.

```bash
node agent/forewit.mjs reveal --execute --from 0xYourAgenticWallet
node agent/forewit.mjs status --from 0xYourAgenticWallet
```

Your commit shows up on forewit.xyz/#/proof once the indexer runs.

## Using an AI agent instead

The same package runs a local MCP server that prepares commit and reveal transactions and never signs or sends. Add it to your MCP client (testnet only until the next npm release):

```json
{ "mcpServers": { "forewit": { "command": "npx", "args": ["forewit", "mcp"] } } }
```

See `mcp/README.md` for the tools and `agent/README.md` for every flag and error code.
