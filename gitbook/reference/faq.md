---
description: Short answers to the questions people ask most about Forewit.
---

# FAQ

## What is Forewit, in one line?

A forecasting track record nobody can fake or buy, tied to your Agent ID on BNB Smart Chain.

## Is this gambling or trading?

No. You give probabilities and get a score. Forewit holds no funds, takes no deposits, pays nothing out and has no token. Every transaction has value 0; you pay only network gas. Forecasting scores only, not financial advice.

## What does it cost?

Only BSC gas. A commit plus a reveal is about 190,000 gas, roughly 0.00001 BNB at the gas prices seen in November 2026.

## Do I need an Agent ID?

Yes. The ledger refuses a commit from a wallet without one. That is what makes every record one per person and impossible to buy.

## Can I play from my phone?

Not yet. Committing currently needs `baw`, the Binance Agentic Wallet CLI, on a computer. A phone only path is being worked on.

## What do I need on my computer?

Node, `baw` signed in, an Agent ID, and Developer Mode on in the Binance App. See [What you need](../getting_started/what_you_need.md).

## Why two steps, commit and reveal?

So nobody can copy you. Your commit is a sealed hash until the deadline. After the deadline you open it, and it must match. See [Commit and reveal](../how_it_works/commit_and_reveal.md).

## What if I forget to reveal?

It counts as a forfeit: the worst possible score on every question in that round. Come back during the reveal window (until 23:00 UTC the next day for daily rounds), or use the daily schedule in [forewit agent](../for_agents/forewit_agent.md).

## What if I lose my salt?

You cannot reveal, so the round becomes a forfeit. Back up each receipt with `receipt --show-salt` and keep it private.

## Can an AI assistant hold my keys or type yes for me?

No. Forewit never asks for keys, seed phrases or pairing codes. `--execute` refuses a piped or scripted yes. Only you, in your own terminal, can send.

## Can I let my own AI model forecast?

Yes. `forewit agent` sends only the question texts to the model you choose, then you approve the commit. See [forewit agent](../for_agents/forewit_agent.md).

## How am I scored?

With the Brier score per question, compared with the market price at the deadline. The difference is your skill. The leaderboard ranks on skill, shrunk toward zero for small samples. See [Scoring](../how_it_works/scoring.md).

## Who picks the questions?

The keeper, by a published rule (selection v3.1): daily crypto and other liquid Predict.fun markets, no sports and no politics, 3 to 8 questions. The rule was published before the first round and will not change while a round is open.

## Can the Forewit team change my score?

No. Nobody can edit commits, reveals, outcomes or scores. The team does post the market baseline, which sets skill for the round, under strict timing rules. See [Owner permissions](../trust/owner_permissions.md).

## Is my name public?

Only if you opt in with `profile`. Your wallet address and forecasts are public onchain either way. See [Privacy](../trust/privacy.md).

## How can another app use my score?

Through ForewitScores: one `verify` call checks your score against the latest posted root. See [Gate on a Forewit score](../developers/gate_on_a_score.md). No root is posted yet; the first comes after the first settled round with an opted in holder.

## Has it been audited?

It has had independent reviews by separate AI agents, with 0 open High and 0 open Medium findings, but no audit by a human security firm. See [Security reviews](../trust/security.md).

## Is the code open?

Yes, under the MIT license: [github.com/owaisahmad870/forewit](https://github.com/owaisahmad870/forewit). Both contracts are verified on BscScan and Sourcify.
