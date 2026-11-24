---
description: From an Agent ID to your first sealed forecast on BSC mainnet in about ten minutes.
---

# Quickstart: your first commit

## What you will have at the end

* Your first forecast committed onchain, sealed so nobody can read it before the deadline.
* A reveal receipt saved on your computer, plus a private backup of it.
* A reminder of when to come back and reveal.

Forecasting scores only. Not financial advice.

It takes about ten minutes. You need the five things in [What you need](what_you_need.md) first.

{% hint style="info" %}
Honest limit: committing currently needs the `baw` command line wallet on a computer (Windows, macOS or Linux). From a phone, use a cloud AI agent: see [Play from your phone or any browser](play_from_phone.md).
{% endhint %}

## The picture

You write your answer, seal it in an envelope, and post the envelope. After the deadline you open it. Read [Commit and reveal](../how_it_works/commit_and_reveal.md) for the full story.

## Steps

These steps use the npm package `forewit` through `npx`, so there is nothing to clone. On Windows, if PowerShell blocks scripts, type `npx.cmd` instead of `npx` and `baw.cmd` instead of `baw`.

### 1. Check your wallet

```bash
baw wallet status --json
baw wallet agent-id --json
baw wallet settings --json
```

Expected result: status `CONNECTED`, your claimed Agent ID, and `devMode.enabled: true`. If any is missing, go back to [What you need](what_you_need.md).

### 2. Find your wallet address

```bash
baw wallet address --json
```

Expected result: a list of addresses. Use the entry with `binanceChainId` 56. Below it is written `0xYourAgenticWallet`.

### 3. Read the round

First find the latest round number:

```bash
npx forewit@0.1.1 round
```

Expected result: the first line reads `Forewit round <n> on mainnet (chain 56), ledger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6`. Questions show only as numbers for now.

Each round has a public round file that adds the questions in words. Replace `1` with your round number:

```bash
npx forewit@0.1.1 round --round-file https://forewit.xyz/data/rounds/1.json
```

Expected result: the round number, the commit and reveal deadlines, and each question as its event question plus label. For example:

```
Forewit round 1 on mainnet (chain 56), ledger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6
Phase: commit open
Commit deadline: 24 Nov 2026 23:00 UTC (in 9h 14m)
Reveal deadline: 25 Nov 2026 23:00 UTC (in 1d 9h)
Questions: 4
  1. Bitcoin Up or Down on November 25?
  ...
  4. Highest temperature in Tokyo on November 25? · 15°C
```

The tool checks the round file against the chain and refuses on any mismatch.

### 4. Check your probabilities

Give one percentage per question, in order. Round 1 has 4 questions, so it takes 4 numbers.

```bash
npx forewit@0.1.1 forecast --p 60,40,50,30
```

Expected result: each question with your percentage. Nothing is saved or sent. Values below 1 or above 99 are clamped to the 1% to 99% range.

### 5. Commit

```bash
npx forewit@0.1.1 commit --execute --from 0xYourAgenticWallet --p 60,40,50,30 --round-file https://forewit.xyz/data/rounds/1.json
```

Expected result, in this order:

1. The tool makes a random salt and saves your reveal receipt in the `.forewit` folder in your home folder, before anything else.
2. It checks your wallet: signed in, Agent ID claimed, Developer Mode on, no pending transaction.
3. It shows the wallet preview: `parsedTx`, the simulation result and every risk.
4. It asks you to type `yes`. Type it only if the preview looks right. Anything else aborts and nothing is sent.
5. It prints `BROADCASTED` with a transaction link, or `PENDING_CONFIRMATION`.

If you see `PENDING_CONFIRMATION`, approve it in the Binance App. Do not run the command again.

> Screenshot placeholder: the terminal showing the commit preview and the "Type yes to send it" prompt

> Screenshot placeholder: the approval screen in the Binance App for a PENDING_CONFIRMATION commit

Without `--execute` the commit command sends nothing. It still saves the receipt, and prints the `baw contract-call preview` and `execute` commands for you to run yourself.

### 6. Back up your receipt

```bash
npx forewit@0.1.1 receipt --from 0xYourAgenticWallet --show-salt
```

Expected result: your receipt as JSON, including the salt. Copy it into a password manager or an offline note.

{% hint style="warning" %}
Without the salt you cannot reveal, and the round counts as a forfeit with the worst possible score. Do not share the salt or the receipt before the commit deadline: anyone holding it can read your forecast. Without `--show-salt` the salt stays hidden, so that output alone is not a backup.
{% endhint %}

### 7. Check your status

```bash
npx forewit@0.1.1 status --from 0xYourAgenticWallet
```

Expected result: `committed: yes`, `local receipt: matches the onchain commit`, and `Next: wait for the commit deadline, then reveal`.

### 8. Come back to reveal

{% hint style="warning" %}
Daily rounds take commits until 23:00 UTC. The reveal window then stays open for 24 hours. Reveal from the same computer, because the salt is in your receipt there.
{% endhint %}

Go on with [Reveal and check your score](reveal_and_score.md).

## Prefer the repository?

The same tool is in the repository. Clone it and use `node agent/forewit.mjs` wherever this page says `npx forewit@0.1.1`:

```bash
git clone https://github.com/owaisahmad870/forewit.git
cd forewit
node agent/forewit.mjs --help
```

## Prefer an AI agent?

Let your own model choose the probabilities with `forewit agent`. See [forewit agent](../for_agents/forewit_agent.md).

## If something goes wrong

Every message the tool can print is listed in [Troubleshooting](troubleshooting.md), with a plain fix.

Forecasting scores only. Not financial advice.
