---
description: Every message the Forewit command line tool can print, with a plain fix for each.
---

# Troubleshooting

Find your message below. Each one starts with `forewit:` in your terminal. The text in angle brackets changes with your round, wallet or file.

Two rules first:

* If a send result is unclear, do not send again. Check `baw wallet tx-history --type pending --binanceChainId 56 --json` and `baw wallet tx-lock --binanceChainId 56 --json` first.
* `status` is always safe. It only reads.

The messages come from [agent/forewit.mjs](https://github.com/owaisahmad870/forewit/blob/main/agent/forewit.mjs) and [agent/lib](https://github.com/owaisahmad870/forewit/tree/main/agent/lib).

## Installing and starting

**PowerShell says "running scripts is disabled on this system".**
Use the `.cmd` forms: `npm.cmd install -g @binance/agentic-wallet@1.12.0`, then `baw.cmd` and `npx.cmd` wherever the docs say `baw` and `npx`.

**`baw not found. Install the Binance Agentic Wallet CLI (npm package @binance/agentic-wallet).`**
Run `npm install -g @binance/agentic-wallet@1.12.0` (on Windows `npm.cmd ...`), then open a new terminal so the path is picked up.

**`--execute needs an interactive terminal so the wallet owner can type yes; stdin is not a TTY. Nothing was sent.`**
Run the command yourself in a normal terminal. On Windows use PowerShell or Windows Terminal: Git Bash often does not report a terminal. A piped or scripted yes is always refused, on purpose.

**`--execute needs BSC mainnet (chain 56) with a pinned ledger; baw cannot sign on <network> (chain <id>). Run without --execute for the dry run.`**
Remove `--network testnet`. `baw` signs on BSC mainnet only.

**`unknown network "<name>"; use mainnet or testnet`**
Use `--network mainnet` or leave the flag out (mainnet is the default).

**`the <network> ledger is not deployed yet, so the CLI refuses to read or write it. Use --network testnet.`**
You are on an old copy. Update with `npx forewit@0.1.1` or `git pull`.

## Your wallet

**`--from <your agentic wallet address> is required (get it from: baw wallet address --json, the binanceChainId 56 entry)`**
Add `--from 0x...` with the address from `baw wallet address --json`, the entry with `binanceChainId` 56.

**`the Agentic Wallet is not signed in (baw wallet status is not CONNECTED). Sign in with: baw auth signin`**
Run `baw auth signin` and scan the QR code with the Binance App. Then check `baw wallet status --json` shows `CONNECTED`.

**`the Agent ID service is temporarily unavailable (20003008). This does not mean you have no Agent ID; try again later.`**
Wait a few minutes and run the command again.

**`this wallet has no claimed Agent ID (baw wallet agent-id). Claim one in the Binance App, Web3 wallet, Agent ID.`**
Claim your Agent ID in the Binance App first. Forewit only accepts commits from a wallet that holds one.

**`Developer Mode is off, expired or over its limit. ...`** (also shown with code 351802 or 351804)
In the Binance App open Agentic Wallet, Settings (top right icon), turn on Developer Mode, confirm the risk warning and approve the signature request. It lasts 7 days, each use extends it, it has its own daily limit, and the wallet balance must be under its cap. Then run the command again.

**`the wallet is locked: a transaction is pending onchain or waiting for approval in the Binance App. ...`**
Open the Binance App and approve or reject the waiting transaction. Then run `status` before trying again.

**`could not read pending transactions (baw wallet tx-history --type pending); refusing to send.`**
Check your connection and that `baw wallet status --json` shows `CONNECTED`. Try again.

**`the wallet has <n> pending transaction(s). Wait until they confirm, then run status before sending again. Never resend.`**
Wait for them to confirm, or approve them in the Binance App. Then run `status`. Never send the same commit twice.

## Reading the round

**`no rounds exist on this ledger yet`**
No round has opened. Daily rounds open around 03:00 UTC.

**`round <n> does not exist (latest is <m>)`**
Use a round number up to `<m>`, or leave out `--round` for the latest.

**`--round must be a positive integer`**
Write the round as a plain number, for example `--round 3`.

**`RPC <method> failed: HTTP <code>`**, **`RPC <method> error: ...`**, **`RPC returned a block without a timestamp`**
The public BSC node had a hiccup. Wait a minute and try again.

**`RPC reports chain <id>, expected 56; refusing`**
Something between you and the node is wrong. Try another network connection. The tool never sends to the wrong chain.

**`getRound returned ...`**, **`getQuestions returned an unexpected layout`**, **`getQuestions length mismatch`**, **`getReveal returned an unexpected layout`**, **`question count mismatch between getRound and getQuestions`**, **`eth_call result is not ABI words`**
The node returned data the tool cannot trust. Try again later. If it repeats, update the tool and open an issue on [GitHub](https://github.com/owaisahmad870/forewit/issues).

## The round file

**`Titles not shown: add --round-file <path or https URL of the public round JSON> to see each event question and label.`**
Not an error. Add `--round-file https://forewit.xyz/data/rounds/<n>.json` to see the questions in words.

**`round file download failed: HTTP <code>`**
The file is not reachable. If `forewit.xyz` does not answer, use the fallback `https://forewit.pages.dev/data/rounds/<n>.json`. In a repository checkout you can also use `web/public/data/rounds/<n>.json` after `git pull`.

**`--round-file must be a local path or an https URL`**
Use an `https://` link or a file path. Plain `http://` links are refused.

**`round file is too large`**, **`round file is not valid JSON`**, **`round file has no questions list`**
The file is damaged or not a Forewit round file. Download it again from the site.

**`round file does not match the chain (<reason>); refusing`**
The file is for another round or network, or was changed. Check that the number in the file name matches `--round`. Download a fresh copy.

**`question has no event question: refusing to present it`**
The round file lacks a question's event text. Download a fresh copy. Forewit never shows a question without it.

**`--round-file <path or https URL of the public round JSON> is required on <network>`**
Add `--round-file` with the public round file.

## Your probabilities

**`pack expects 1 to 16 values`**, **`slot <i> out of range: <value>`**
The forecast could not be packed. Give 1 to 16 percentages with `--p`, each from 0 to 100.

**`give 1 to 16 comma separated percentages, for example --p 72,15,50`**
Add `--p` with one percentage per question, separated by commas, no spaces.

**`probability <i> must be a percentage from 0 to 100, got "<value>"`**
Use plain numbers like `65` or `12.5`. No `%` sign.

**`round <n> has <k> questions, you gave <m> probabilities`**
Give exactly one number per question, in the order shown by `round`.

**`clamped to the 1% to 99% range`**
Not an error. Forewit never accepts 0% or 100%, so it moved your value to 1% or 99%.

## Flags and files

**`Unknown option '--<name>'`** (or another option error from Node)
A flag is misspelled. Compare with `npx forewit@0.1.1 --help`.

**`ENOENT: no such file or directory, open '<path>'`**
A local `--round-file` or `--env-file` path does not exist. Check the path, or use the https link to the round file.

**`not even length 0x hex: ...`**, **`uint256 out of range: ...`**, **`bad address: ...`**, **`bad bytes32: ...`**
A value given to the tool, or read from a receipt or round file, is malformed. Check that `--from` is a full `0x` address with 40 hex characters. If the value came from a receipt, restore it from your backup.

## Committing

**`commits for round <n> closed at <time>`**
That round's commit deadline has passed. Wait for the next daily round, and reveal this one if you committed.

**`NOTE: this wallet already committed in this round. Sending this commit replaces it; the older receipt is kept in case this one never lands.`**
Not an error. Your newest commit before the deadline is the one that counts.

**`local commit hash encoding differs from the ledger computeCommitHash; refusing`**
Your copy of the tool does not match the live contract. Update it, then try again. Nothing was sent.

**`refusing to print a command with unvalidated input`**, **`refusing to send unvalidated input`**
Check that `--from` is a full `0x` address with 40 hex characters.

## Saving the receipt

**`ACL of <path> still grants: ...`**, **`unexpected whoami output: ...`**, **`unexpected icacls output`**, **`unparsed icacls entry: ...`** (Windows)
The tool could not make the receipt readable by you alone, so it deleted it and stopped. Nothing was sent. Make sure your home folder is on a normal local NTFS drive and that you run the tool as your own user. If it repeats, open an issue with the message.

**`<path> is still accessible to group or others`** (macOS, Linux)
Same cause. Check that you own your home folder and the `.forewit` folder in it.

**`refusing to lock <dir>; use a dedicated subdirectory`**
The receipt folder resolved to your home or temp folder itself. Keep the default `.forewit` folder.

## The wallet preview and send

**`refusing this preview: <reasons> (parsedTx fields: ...). Nothing was sent.`**
The preview did not match what Forewit prepared: a wrong target, a wrong function, a value change or a failed simulation. Do not send it by other means. Run `status`, then try again.

**`aborted: you did not type yes. Nothing was sent.`**
You typed something other than `yes`. Run the command again when ready.

**`the preview expired before you confirmed. Nothing was sent; run the command again for a fresh preview.`**
Run the command again and answer sooner.

**`351803: risk blocked by the Binance Agentic Wallet. Stopped. Forewit never works around a risk block.`**
The wallet's risk check stopped this call. Forewit will not try another way.

**`351805: the simulation failed (<reason>). ...`**
The contract would reject the call. Common reasons, by the contract's own error name:
* `CommitClosed`: the commit deadline has passed.
* `NoAgentID`: the sending wallet holds no Agent ID. Use your Agentic Wallet address.
* `RevealNotOpen`: the reveal window is not open yet, or has closed.
* `NoCommit`: there is no commit from this wallet in that round.
* `HashMismatch`: the receipt does not match your onchain commit.
* `AlreadyRevealed`: you already revealed. Nothing to do.
* `LabelNotOwned`: the `--label` name is not owned by this wallet.

Run `status` and do not retry blindly.

**`PENDING_CONFIRMATION: approve this transaction in the Binance App now.`**
Approve it in the Binance App. Do not run the command again. It completes once approved.

**`preview failed ...`**, **`execute failed ...`**, or **`execute returned an unknown or unreadable result, so the transaction state is unknown. Do not resend. ...`**
The state is unknown. Do not resend. Run the two checks printed after the message, then `status`.

## Revealing

**`reveal for round <n> opens at <time> (<in>); revealing early is refused`**
Wait until the commit deadline. If you meant an older round, add `--round <n>`.

**`the reveal window for round <n> closed at <time>; an unrevealed commit counts as a forfeit`**
Too late for that round. It will be scored as a forfeit. Set a reminder for the next one.

**`no commit onchain for <wallet> in round <n>. If a commit is pending, check: ...`**
Your commit did not land, or you used another wallet or round. Run the pending check shown, and `status` with the right `--round`.

**`no local receipt matches the onchain commit <hash> (found <k> receipt(s) for this round in <folder>). Restore your backup receipt into that folder. ...`**
Save your backed up receipt as a `.json` file in the `.forewit` folder in your home folder, then reveal again. Without the salt the round counts as a forfeit.

**`local receipt: NONE MATCHES the onchain commit`** (in `status`)
Same fix: restore the matching backup receipt.

**`receipt packed value is not canonical for this round; refusing`**
The receipt file is damaged or edited. Restore it from your backup.

**`Round <n>: <wallet> has already revealed. Nothing to do.`**
Not an error.

**`No receipts found in <folder> for that filter.`** (from `receipt`)
No receipt is saved for that wallet or round on this computer. Check `--from` and `--round`, or restore your backup.

## Public profile

**`--label <your Agent ID name, for example owaisahmad> is required (or --off to opt out)`**
Add `--label yourname` with your Agent ID name, lowercase, without `.ai`. Letters, digits and `_` only.

## forewit agent and schedule

**`set FOREWIT_LLM_MODEL (and FOREWIT_LLM_URL, FOREWIT_LLM_KEY, FOREWIT_LLM_API as needed) in your environment or in a file passed with --env-file. ...`**
Put at least `FOREWIT_LLM_MODEL` in your environment or in the file you pass with `--env-file`.

**`FOREWIT_LLM_API must be openai (any OpenAI compatible chat completions endpoint) or anthropic`**
Set `FOREWIT_LLM_API=openai` or `FOREWIT_LLM_API=anthropic`.

**`FOREWIT_LLM_URL is not a valid URL`**, **`FOREWIT_LLM_URL must be https (plain http only for localhost), so your key never travels in clear`**
Fix the address. Use `https://`, or `http://localhost` for a model on your own machine.

**`could not reach the LLM at <host> ...`**, **`the LLM at <host> answered HTTP <code>; ...`**, **`the LLM reply is not JSON. ...`**, **`the LLM reply has no text; refusing. ...`**, **`the model declined to answer. ...`**
Check the address, model name and key. Nothing was saved or sent.

**`refusing the model output (<why>); nothing was saved or sent. The model replied: ...`**
The model must reply with exactly `{"p":[...]}`, one number from 1 to 99 per question. Try again or use another model.

**`commits for round <n> closed at <time>; nothing to forecast. Reveal with: ...`**
Run the reveal command shown.

**`no saved commit receipts for <wallet> on <network> in <folder>; nothing to reveal`**
No receipt on this computer. Restore your backup, or check `--from`.

**`no committed round is in its reveal window now (newest committed round: <n>). Check with: ...`**
Too early or too late. Run the `status` command shown.

**`schedule needs BSC mainnet: ...`**, **`--at must be a local time as HH:MM, for example 13:00`**, **`--env-file does not exist`**, **`a path contains " or %, which a .cmd file cannot quote safely; ...`**, **`<file> failed...; the schedule may not be registered`**
Fix the flag or path named in the message, then run `schedule` again. See [forewit agent](../for_agents/forewit_agent.md).

## Still stuck?

Open an issue on [GitHub](https://github.com/owaisahmad870/forewit/issues) with the message and the command you ran. Never paste your salt or receipt there.
