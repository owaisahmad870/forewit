---
description: The problems players actually hit, each with a short fix.
---

# Troubleshooting

Two rules first:

* If a send result is unclear, never send again. Run `status` first: it only reads.
* `PENDING_CONFIRMATION` means approve in the Binance App. Do not run the command again.

## Setup

**`npx` or `node` is not found.**
Install Node.js from [nodejs.org](https://nodejs.org), then open a new terminal.

**PowerShell says "running scripts is disabled on this system".**
Type `npx.cmd`, `npm.cmd` and `baw.cmd` instead of `npx`, `npm` and `baw`. No policy change is needed.

**`baw not found`.**
Run `npm install -g @binance/agentic-wallet@1.12.0`, then open a new terminal.

**`needs an interactive terminal` or `forewit start is interactive`.**
Run the command yourself in PowerShell, Windows Terminal or a normal terminal. Git Bash often does not report a terminal. A piped or scripted yes is always refused, on purpose.

**`sign in did not complete`.**
The code expires after 5 minutes. Run `start` again, check that the Binance App shows the same pairing code, and approve sooner.

## Your wallet

**The Agentic Wallet is not signed in.**
Run `baw auth signin` and approve in the Binance App.

**`this wallet has no claimed Agent ID`, or the error `NoAgentID`.**
Claim your Agent ID in the Binance App, and forecast from the Agentic Wallet that holds it.

**`the Agent ID service is temporarily unavailable (20003008)`.**
This does not mean you have no Agent ID. Try again in a few minutes.

**`Developer Mode is off, expired or over its limit` (codes 351802 or 351804).**
Turn it on again in the Binance App: Agentic Wallet, Settings. It lasts 7 days and each use extends it. It has its own daily limit, and your wallet balance must be under its cap.

**`the wallet is locked` or `the wallet has <n> pending transaction(s)`.**
Approve or reject the waiting transaction in the Binance App, then run `status`. Never resend.

**`351803: risk blocked by the Binance Agentic Wallet`.**
The wallet's risk check stopped the call. Forewit never works around it. Stop here.

## Sending a forecast

**`commits for round <n> closed at <time>`.**
The 23:00 UTC deadline has passed. The next daily round opens at about 03:00 UTC.

**`round <n> has <k> questions, you gave <m> probabilities`.**
Give exactly one number per question, in the order shown, from 1 to 99, with no `%` sign.

**`clamped to the 1% to 99% range`.**
Not an error. Forewit never accepts 0% or 100%.

**`this wallet already committed in this round`.**
Not an error. Your newest commit before the deadline is the one that counts.

**`aborted: you did not type yes` or `the preview expired`.**
Nothing was sent. Run the command again when ready.

**`refusing this preview` or `351805: the simulation failed`.**
Nothing was sent. Run `status`. The contract's reason tells you why: `CommitClosed` (deadline passed), `NoAgentID` (wrong wallet), `RevealNotOpen`, `NoCommit`, `HashMismatch`, `AlreadyRevealed` or `LabelNotOwned`.

**`execute failed` or `the transaction state is unknown`.**
Do not resend. Run the two checks printed after the message, then `status`.

**`RPC ... failed` or `round file download failed`.**
The public node or the site had a hiccup. Wait a minute and try again. If forewit.xyz does not load, use [forewit.pages.dev](https://forewit.pages.dev).

**The receipt could not be saved (`ACL of <path> still grants`, or `is still accessible to group or others`).**
Nothing was sent. Keep your home folder on a normal local drive and run the tool as your own user.

## Revealing

**Auto reveal is on, but `status` still shows not revealed an hour after the deadline.**
Reveal yourself before the reveal deadline: `npx forewit@latest reveal --execute --round <n>`

**`reveal for round <n> opens at <time>`.**
Wait for the commit deadline. For an older round, add `--round <n>`.

**`the reveal window for round <n> closed`.**
Too late: that round counts as a forfeit.

**`no local receipt matches the onchain commit`.**
Save your backed up receipt as a `.json` file in the `.forewit` folder in your home folder, then reveal again.

**`no commit onchain for <wallet> in round <n>`.**
The commit did not land, or you used another wallet or round. Run `status` with the right `--round`.

## forewit agent

**An error about `FOREWIT_LLM_MODEL`, `FOREWIT_LLM_API` or `FOREWIT_LLM_URL`.**
Set at least `FOREWIT_LLM_MODEL`. `FOREWIT_LLM_API` is `openai` or `anthropic`, and `FOREWIT_LLM_URL` must be https (plain http only for localhost). See [forewit agent](../for_agents/forewit_agent.md).

**`refusing the model output`.**
The model must reply exactly `{"p":[...]}`, one number from 1 to 99 per question. Try again or use another model.

## Still stuck?

Open an issue on [GitHub](https://github.com/owaisahmad870/forewit/issues) with the message and the command you ran. Never paste your salt or receipt there.
