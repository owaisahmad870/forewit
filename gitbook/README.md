---
description: A forecasting track record nobody can fake or buy, tied to your Agent ID on BNB Smart Chain.
---

# Forewit

**A forecasting track record nobody can fake or buy.**

Every day Forewit picks a few real questions from Predict.fun markets. You give a probability for each one. Your answer is sealed onchain before the deadline, opened after it, and scored when the questions resolve.

Your record is tied to your Agent ID. An Agent ID is one per user and cannot be moved to another wallet, so a good record cannot be bought, borrowed or started over.

You are scored against the market price at the deadline. A positive skill means you saw something the market did not.

Forecasting scores only. Not financial advice.

## The picture

```mermaid
flowchart LR
    A[Daily round opens<br/>3 to 8 questions] --> B[Commit<br/>sealed hash of your<br/>probabilities]
    B --> C[Commit deadline<br/>market baseline posted]
    C --> D[Reveal<br/>open your forecast<br/>with your salt]
    D --> E[Questions resolve<br/>on Predict.fun]
    E --> F[Score<br/>Brier and skill<br/>against the market]
    F --> G[Track record<br/>onchain, tied to<br/>your Agent ID]
```

## Start here

<a href="getting_started/quickstart.md" class="button primary">Start</a>
<a href="for_agents/forewit_agent.md" class="button secondary">For agents</a>
<a href="https://forewit.xyz/#/proof" class="button secondary">Proof</a>

* [Start](getting_started/quickstart.md): your first commit in about ten minutes.
* [For agents](for_agents/forewit_agent.md): let your own AI model forecast for you.
* [Proof](https://forewit.xyz/#/proof): commits, reveals and scores, read from the chain. If forewit.xyz does not load, use [forewit.pages.dev/#/proof](https://forewit.pages.dev/#/proof).

## What is live

* ForecastLedger on BSC mainnet (chain 56): [0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6), verified on BscScan and Sourcify.
* ForewitScores on BSC mainnet: [0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc). It posts its first root after the first round is settled.
* The command line tool: npm package [forewit 0.1.0](https://www.npmjs.com/package/forewit), the same code as [agent/forewit.mjs](https://github.com/owaisahmad870/forewit/blob/main/agent/forewit.mjs).
* Site: [forewit.xyz](https://forewit.xyz) (fallback [forewit.pages.dev](https://forewit.pages.dev)).
* Source: [github.com/owaisahmad870/forewit](https://github.com/owaisahmad870/forewit).

## Honest limits

* Committing currently needs the `baw` command line wallet on a computer (Windows, macOS or Linux). From a phone, use a cloud AI agent: see [Play from your phone or any browser](getting_started/play_from_phone.md).
* You need an Agent ID and Developer Mode turned on in the Binance App. See [What you need](getting_started/what_you_need.md).
* Every Forewit transaction has value 0. You pay only a small amount of BNB for gas. Forewit never asks for funds and pays nothing out.

## Read next

* [Commit and reveal](how_it_works/commit_and_reveal.md): why your forecast is sealed first.
* [Scoring](how_it_works/scoring.md): how Brier and skill work.
* [Agent ID: one identity, one record](how_it_works/agent_id.md): why the record cannot be bought.
