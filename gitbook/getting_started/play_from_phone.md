---
description: Play Forewit from a phone or any browser with a cloud AI agent; your keys stay in the Binance app and your salts in your own private repository.
---

# Play from your phone or any browser

A cloud AI agent in your browser (Claude Code on the web, or Codex cloud) reads the round, prepares your forecast, shows you the wallet preview and sends only after you type yes. No computer needed.

Forecasting scores only. Not financial advice.

{% hint style="info" %}
Why not a normal chat? The Agentic Wallet signs only through its command line tool, which needs a shell. A chat window (claude.ai, ChatGPT) has none; a cloud coding agent does, in your own sandbox.
{% endhint %}

## Steps
1. Open the [Forewit agent template](https://github.com/owaisahmad870/forewit-agent-template), click **Use this template**, then **Create a new repository**, and choose **Private**.
2. Open **claude.ai/code** (or the Code tab in the Claude app), connect GitHub and pick your new repository.
3. In the environment settings, allow network access to `www.binance.com`, `bsc-rpc.publicnode.com`, `forewit.xyz`, `api.github.com`, `api.predict.fun` and the npm registry. For any market, also add your free key from developers.predict.fun as the environment variable `PREDICT_API_KEY`. Setup then runs by itself at the start of every session. Check: the agent's network checks return 2xx or 3xx instead of 403.
4. Send `Forecast a market: bitcoin 15 minute` (or `Forecast today's Forewit round`). The agent shows a sign in link and a pairing code.
5. Tap the link on the same phone, check the pairing code in the Binance app and approve. The agent reports CONNECTED and your BSC address.
6. Give your chance. The agent saves your receipt to your private repository and shows the wallet preview (a Forewit contract, value 0).
7. Type yes. You get a transaction hash, or a request to approve in the Binance app.
8. That is all: auto reveal scores it after the market settles. Send `How did I do?` any time.

{% hint style="warning" %}
Your receipts hold the salt. Keep your copy of the template private and never paste a salt anywhere. A lost salt means the round counts as a forfeit.
{% endhint %}

## Who holds what
* Your wallet keys: Binance (the Agentic Wallet). You approve sign in in the Binance app.
* The wallet session: your cloud sandbox only, signed out at the end of each session.
* Your salt and receipts: your private repository.
* Forewit: nothing. It never sees the sign in link or pairing code, never hosts a login page and never stores a wallet session.

## Stay safe
* Keep only a little BNB for gas in the Agentic Wallet you use here.
* The template pins the forewit version, so a new release never runs beside your signed in wallet without review.
