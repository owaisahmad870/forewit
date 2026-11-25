---
description: Make your first Forewit forecast from your computer, your AI agent or your phone.
---

# Quickstart

Each day Forewit picks a few real questions. You give your chance for each one, it is sealed onchain, and later scored against the market price.

Forecasting scores only. Not financial advice.

## What you need

* An Agent ID, claimed in the Binance App.
* Developer Mode on: in the Binance App open Agentic Wallet, then Settings (top right icon).
* A little BNB for gas. Every Forewit transaction has value 0.

## Path 1: your computer

1. Install Node.js from [nodejs.org](https://nodejs.org) if you do not have it yet.
2. Run `npx forewit@latest start`. On Windows PowerShell type `npx.cmd forewit@latest start`.
3. Open the sign in link, check the pairing code in the Binance App and approve. Then type your chance from 1 to 99 for each question.
4. Say yes to auto reveal (recommended), read the wallet preview and type `yes` to send.

## Path 2: your AI agent

1. Install the Binance Agentic Wallet skill and its command line tool:
   ```bash
   npx skills add binance/binance-skills-hub --skill binance-agentic-wallet
   npm install -g @binance/agentic-wallet@1.12.0
   ```
2. Add Forewit:
   ```bash
   npx skills add owaisahmad870/forewit --skill forewit
   ```
3. Tell your agent: "Play Forewit".
4. Read the wallet preview it shows you, and type `yes` only if it looks right.

## Path 3: your phone

Use a cloud AI agent in your browser: see [Play from your phone or any browser](play_from_phone.md).

## Any market, any time

You can also forecast any two outcome market on Predict.fun, outside the daily round.

1. Get a free key at [developers.predict.fun](https://developers.predict.fun) and set it as the environment variable `PREDICT_API_KEY`.
2. Find a market: `npx forewit@latest markets --search "bitcoin"`
3. Forecast it: `npx forewit@latest predict --market <id> --p 65 --auto-reveal --execute`

A forecast counts only if it is sent before the market's last 60 seconds, and only if the market traded at least 100 USD in the last 24 hours.

## After you send

* **Reveal.** With auto reveal there is no second step: Forewit reveals for you after the deadline. Without it, reveal within 24 hours after the 23:00 UTC deadline: `npx forewit@latest reveal --execute --round <n>`
* **Back up your receipt.** Run `npx forewit@latest receipt --show-salt` and keep the output private. Without it you cannot reveal by hand.
* **See your score.** Open [forewit.xyz/#/me](https://forewit.xyz/#/me) and paste your wallet address.

A new daily round opens at about 03:00 UTC and takes forecasts until 23:00 UTC. Something wrong? See [Troubleshooting](troubleshooting.md).
