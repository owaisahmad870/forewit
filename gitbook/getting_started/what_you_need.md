---
description: The five things you need before your first Forewit commit, and the current limits.
---

# What you need

## What you will have at the end

* An Agent ID, Node.js, a signed in `baw` wallet tool, Developer Mode on, and a little BNB for gas.
* A check for each one, so you know it works before your first commit.

You need five things. Most people already have the first one.

## 1. An Agent ID

Your Agent ID is your `.ai` name, claimed in the Binance App. Forewit only accepts commits from a wallet that holds one. The contract checks this itself ([ForecastLedger.sol](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol), `commit`).

The Agent ID lives in your Agentic Wallet, which has its own address. That address is the one you forecast from.

See [Agent ID: one identity, one record](../how_it_works/agent_id.md) for why this matters.

> Screenshot placeholder: the Agent ID screen in the Binance App showing a claimed .ai name

## 2. A computer with Node.js 26

Forewit runs as a small command line tool. Install Node.js 26 or newer from [nodejs.org](https://nodejs.org). Windows, macOS and Linux all work.

Check it:

```bash
node --version
```

Expected result: `v26` or higher.

## 3. The Agentic Wallet command line tool (`baw`)

`baw` is the Binance Agentic Wallet CLI. Forewit uses it to show you a preview of each transaction and to send it after you type `yes`. Forewit itself never holds a key.

```bash
npm install -g @binance/agentic-wallet@1.12.0
```

On Windows, PowerShell may say "running scripts is disabled on this system". Use the `.cmd` forms instead. They need no policy change:

```powershell
npm.cmd install -g @binance/agentic-wallet@1.12.0
baw.cmd wallet status --json
```

Wherever these docs say `baw`, type `baw.cmd` in that case. The same goes for `npx`: type `npx.cmd`.

Sign in once. The command shows a QR code to scan with the Binance App:

```bash
baw auth signin
```

Then check:

```bash
baw wallet status --json
```

Expected result: the status shows `CONNECTED`.

## 4. Developer Mode on

Commit and reveal are custom contract calls. The Agentic Wallet allows those only with Developer Mode on.

1. In the Binance App, open Agentic Wallet, then Settings (the top right icon).
2. Turn on Developer Mode.
3. Read and confirm the risk warning, then approve the signature request.

> Screenshot placeholder: the Developer Mode switch in Agentic Wallet settings

{% hint style="warning" %}
Developer Mode lasts 7 days, and each use extends it. It has its own daily limit, and your wallet balance must be under its cap. If it lapses, commits fail with code 351802 or 351804 until you turn it on again.
{% endhint %}

Check it from your terminal:

```bash
baw wallet agent-id --json
baw wallet settings --json
```

Expected result: `agent-id` shows your claimed name, and `settings` shows `devMode.enabled: true`.

## 5. A little BNB for gas

Every Forewit transaction has value 0. You only pay network gas, which is a tiny amount of BNB on BNB Smart Chain. Forewit never asks for funds and pays nothing out.

## Honest limits

* Committing currently needs `baw` on a computer (Windows, macOS or Linux). A phone only path is being worked on.
* Sending needs an interactive terminal, because you must type `yes` yourself. On Windows use PowerShell or Windows Terminal. Git Bash often does not report a terminal, and the tool then refuses.
* The tool signs on BSC mainnet (chain 56) only.

Forecasting scores only. Not financial advice.

Next: [Quickstart: your first commit](quickstart.md).
