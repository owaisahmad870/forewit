---
description: Play Forewit from a phone or any browser with a cloud AI agent; your keys stay in the Binance app and your salts in your own private repository.
---

# Play from your phone or any browser

What you will have at the end: a cloud AI agent in your browser (Claude Code on the web, or Codex cloud) that reads the round, prepares your commit, shows you the wallet preview and sends only after you type yes. No computer needed.

Forecasting scores only. Not financial advice.

{% hint style="info" %}
Tested on 24 Nov 2026 from a phone: sign in by tapping a link, round, commit preparation, receipt saved to a private repository, and the wallet preview all passed. The first real send from a cloud agent is scheduled with round 2.
{% endhint %}

## Why a cloud agent and not a chat
* The wallet that holds your Agent ID (the Agentic Wallet) signs only through the Binance Agentic Wallet CLI, which needs a shell.
* A chat window (claude.ai, ChatGPT) has no shell. A cloud coding agent does, and it runs in your own sandbox, so Forewit never holds your wallet session or your salt.

## Steps
1. Open the [Forewit agent template](https://github.com/owaisahmad870/forewit-agent-template), click **Use this template**, then **Create a new repository**, and choose **Private**. Expected: a private copy in your GitHub account.
2. Open **claude.ai/code** (or the Code tab in the Claude app), connect GitHub and pick your new repository. Expected: a new session on your repository.
3. In the environment settings, allow network access to `www.binance.com`, `bsc-rpc.publicnode.com`, `forewit.xyz`, `api.github.com`, `api.predict.fun` and the npm registry. For any market, also add your free key from developers.predict.fun as the environment variable `PREDICT_API_KEY`. Setup then runs by itself at the start of every session. Expected: the agent's network checks return 2xx or 3xx instead of 403.
4. Send `Forecast a market: bitcoin 15 minute` (or `Forecast today's Forewit round`). Expected: the agent shows a sign in link and a pairing code.
5. Tap the link on the same phone, check the pairing code in the Binance app and approve. Expected: the agent reports CONNECTED and your BSC address.
6. Give your chance. Expected: the agent saves your receipt to your private repository and shows the wallet preview (target a Forewit contract, value 0).
7. Type yes. Expected: a transaction hash, or a request to approve in the Binance app.
8. Nothing more: auto reveal scores it after the market settles. Send `How did I do?` any time.

{% hint style="warning" %}
Your receipts hold the salt. Keep your copy of the template private, and never paste a salt anywhere. A lost salt means the round counts as a forfeit.
{% endhint %}

## Who holds what
* Your wallet keys: Binance (the Agentic Wallet). You approve sign in in the Binance app.
* The wallet session: your cloud sandbox only, signed out at the end of each session.
* Your salt and receipts: your private repository.
* Forewit: nothing.

## Safety and compliance
* Keep only a little BNB for gas in the Agentic Wallet you use here, and let the agent sign out at the end of every session.
* The sign in link and pairing code come from the official Binance Agentic Wallet CLI running in your own sandbox and are shown only to you. Forewit never sees them, never hosts a login page and never stores a wallet session; this is the same flow as running the CLI on your own computer.
* The template pins the forewit version, so a new release never runs beside your signed in wallet without review.
