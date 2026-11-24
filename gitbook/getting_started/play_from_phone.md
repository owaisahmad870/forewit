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
3. In the environment settings, allow network access to `www.binance.com`, `bsc-rpc.publicnode.com`, `forewit.xyz`, `api.github.com` and the npm registry. Expected: the agent's network checks return 2xx or 3xx instead of 403.
4. Send `Follow CLAUDE.md. Commit my forecast for the current Forewit round.` Expected: the agent shows a sign in link and a pairing code.
5. Tap the link on the same phone, check the pairing code in the Binance app and approve. Expected: the agent reports CONNECTED and your BSC address.
6. Give one percentage per question. Expected: the agent saves your receipt to your private repository and shows the wallet preview (target the Forewit ledger, value 0).
7. Type yes. Expected: a transaction hash, or a request to approve in the Binance app.
8. After the commit deadline, open a new session on the same repository and send `Follow CLAUDE.md. Reveal my forecast.`

{% hint style="warning" %}
Your receipts hold the salt. Keep your copy of the template private, and never paste a salt anywhere. A lost salt means the round counts as a forfeit.
{% endhint %}

## Who holds what
* Your wallet keys: Binance (the Agentic Wallet). You approve sign in in the Binance app.
* The wallet session: your cloud sandbox only, signed out at the end of each session.
* Your salt and receipts: your private repository.
* Forewit: nothing.
