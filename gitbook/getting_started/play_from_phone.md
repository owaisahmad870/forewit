---
description: Play Forewit from a phone or any browser with a cloud AI agent; your keys stay in the Binance app and your salts in your own private repository.
---

# Play from your phone or any browser

A cloud AI agent in your browser (Claude Code on the web, or Codex cloud) reads the round, prepares your forecast, shows you the wallet preview and sends only after you type yes. No computer needed.

Forecasting scores only. Not financial advice.

{% hint style="info" %}
Why not a normal chat? The Agentic Wallet signs only through its command line tool, which needs a shell. A chat window (claude.ai, ChatGPT) has none; a cloud coding agent does, in your own sandbox.
{% endhint %}

## Set up once (about five minutes)
These are real screenshots.

1. Open the [Forewit agent template](https://github.com/owaisahmad870/forewit-agent-template), click **Use this template**, then **Create a new repository**.

   ![Use this template menu](../.gitbook/assets/start_template.webp)
2. Give it any name, choose **Private** and click **Create repository**. Your receipts are saved here, so keep it private.

   ![Create repository with Private selected](../.gitbook/assets/start_private.webp)
3. Open **claude.ai/code** (or the Code tab in the Claude app). Connect GitHub if asked, then pick your new repository.

   ![Repository picker in Claude Code](../.gitbook/assets/start_repo.webp)
4. Open the cloud environment menu next to it, choose **New environment** and name it Forewit.

   ![Environment menu with New environment](../.gitbook/assets/start_envmenu.webp)

   ![New environment named Forewit](../.gitbook/assets/start_envname.webp)
5. Open **Network access**, keep **Limited**, paste these websites one per line and leave **package managers** on:

   ```
   www.binance.com
   bsc-rpc.publicnode.com
   forewit.xyz
   api.github.com
   api.predict.fun
   ```

   ![Network access with the Forewit websites](../.gitbook/assets/start_network.webp)
6. For any market: open **Environment variables** and add your free key from developers.predict.fun as `PREDICT_API_KEY=your key`. Only you use this environment; never paste the key in chat. Then click **Add environment**.

   ![Environment variables with PREDICT_API_KEY](../.gitbook/assets/start_envvars.webp)
7. Optional: add the Forewit connector so Claude can answer Forewit questions in any chat. In claude.ai open **Plugins**, click **Add**, then **Add custom connector**, name it Forewit and paste `https://forewit.xyz/mcp`. It only reads and never sends anything.

   ![Add custom connector with the Forewit address](../.gitbook/assets/start_connector.webp)

Setup then runs by itself at the start of every session. Check: the agent's network checks return 2xx or 3xx instead of 403.

## Play
1. Start a new session with your repository and the Forewit environment, and send one of these:
   * `Forecast a market: bitcoin 15 minute`
   * `Forecast today's Forewit round`
   * `How did I do?`
   * `What can I forecast right now?`
   * `Explain how Forewit scores me`
   * `Show the Forewit leaderboard`
2. The agent shows a sign in link and a pairing code. Tap the link on the same phone, check the code in the Binance app and approve. The agent reports CONNECTED and your BSC address.
3. Give your chance. The agent saves your receipt to your private repository and shows the wallet preview (a Forewit contract, value 0).
4. Type yes. You get a transaction hash, or a request to approve in the Binance app.
5. That is all: auto reveal scores it after the market settles. Send `How did I do?` any time.

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
