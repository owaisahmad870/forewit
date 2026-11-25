# Forewit agent toolkit

Play Forewit daily forecast rounds with your Binance Agentic Wallet and Agent ID.

> Forecasting scores only. Not financial advice. Forewit does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.

Every transaction this toolkit prepares has value 0 and goes to one pinned contract. Forewit never asks for funds and pays nothing out; the only cost is network gas.

This folder holds:

* `forewit.mjs`: a zero dependency Node CLI (Node 26 or newer) that reads rounds from the chain, computes commits, stores salts safely and prints the exact `baw` commands, or runs them for you after you type yes (`--execute`). `agent` lets your own LLM pick the probabilities, and `schedule` sets up a daily run.
* `SKILL.md`: a Claude Code skill with the preflight, the round flow and the hard rules for agents.
* `llms.txt`: a short machine readable summary for any agent.
* `config.mjs`: the pinned networks and ledger addresses. The CLI has no flag to change them.

## Quickstart

You need Node 26, the Binance Agentic Wallet CLI (`baw`, npm package `@binance/agentic-wallet`), an Agent ID, and Developer Mode turned on in the Binance App (Agentic Wallet, Settings, Developer Mode; it has its own daily limit and lasts 7 days).

The easy way is the guided first run: `node agent/forewit.mjs start` (or `npx forewit@latest start`). It checks the wallet, signs you in, shows today's questions, and sends your forecast after the preview and your typed yes.

Step by step, from the repository root:

```bash
# 1. See the current round and its questions (the round file adds each event question and label)
node agent/forewit.mjs round --round-file <path or https URL of the public round JSON>

# 2. Check your probabilities (percentages, one per question, clamped to 1% to 99%)
node agent/forewit.mjs forecast --p 72,15,50

# 3. Your wallet address: the binanceChainId 56 entry
baw wallet address --json

# 4. Commit: saves your salt, then prints the baw preview and execute commands
#    add --auto-reveal (opt in) and Forewit reveals for you after the deadline: no step 6
node agent/forewit.mjs commit --from 0xYourAgenticWallet --p 72,15,50

# 5. Back up the reveal receipt somewhere private
node agent/forewit.mjs receipt --from 0xYourAgenticWallet --show-salt

# 6. After the commit deadline, before the reveal deadline
node agent/forewit.mjs reveal --from 0xYourAgenticWallet

# Any time
node agent/forewit.mjs status --from 0xYourAgenticWallet

# 7. Optional: opt in publicly with your Agent ID name (leaderboard and ForewitScores); --off opts out
node agent/forewit.mjs profile --from 0xYourAgenticWallet --label yourname --execute
```

Common flags: `--network mainnet|testnet` (testnet until the mainnet ledger is pinned), `--round N` (default: the latest round, or the round in the round file) and `--round-file <path or https URL>`.

## Question titles

Every question is shown as its parent event question plus the sub market label, for example `Highest temperature in Shenzhen on November 24? · 24°C`, never as a bare label. Titles come from the public round JSON that the keeper writes when it opens a round (`--round-file`, a local path or an https URL). The CLI checks the file's network, ledger, round, question count, order, conditionIds and CTF addresses against the chain and refuses on any mismatch. A question without its event question makes the command refuse. Titles are untrusted text from Predict.fun: the CLI strips control and direction override characters and shows them as plain text only. Without `--round-file` the CLI shows question numbers and conditionIds and no titles.

## Dry run (default)

By default the CLI never runs `baw` and never sends a transaction. For each commit or reveal it prints a preview command of this form, which you run yourself:

```bash
baw contract-call preview --binanceChainId 56 --from <wallet> --to <pinned ledger> --value 0 --inputData <calldata> --json
```

Then read `parsedTx`, `simulationResult` and `risks`, and only if you agree run `baw contract-call execute --requestId <requestId> --json`. If the result is `PENDING_CONFIRMATION`, approve it in the Binance App and do not resend. A risk block (351803) is final: do not work around it.

`baw` signs on BSC mainnet (chain 56) only. On testnet the CLI also prints the raw `to`, `value` and `data` so you can send the same call from any testnet wallet.

## Execute mode (`--execute`)

`commit --execute` and `reveal --execute` run the wallet steps for you, in your own terminal:

1. Refuse unless stdin is an interactive terminal and the network is BSC mainnet (chain 56) with a pinned ledger. There is no flag to skip the question, and a piped or scripted yes is refused. On Windows use PowerShell or Windows Terminal: Git Bash (mintty) often does not report a terminal.
2. For a commit, save the salt and reveal receipt first, exactly as in the dry run.
3. Preflight, read only: `baw wallet status` must be CONNECTED, `baw wallet agent-id` must show a claimed Agent ID, `baw wallet settings` must show Developer Mode enabled and not expired, `baw wallet tx-lock` must be UNLOCKED and `baw wallet tx-history --type pending` must be empty. A pending transaction stops the run, so nothing is ever sent twice.
4. Run `baw contract-call preview` with value 0, the pinned ledger and the calldata. No gas price and no gas limit are passed.
5. Refuse unless the preview targets the pinned ledger, has value 0, carries exactly our calldata and its simulation passed.
6. Print parsedTx, the simulation result and every risk, then ask you to type `yes`. Anything else aborts and nothing is sent.
7. Run `baw contract-call execute --requestId <id>` once.

Results:

* `BROADCASTED`: the CLI prints the txHash and an explorer link.
* `PENDING_CONFIRMATION`: approve it in the Binance App. Never run the command again for it; it completes once approved.
* 351802 or 351804: Developer Mode is off, expired or over its cap. In the Binance App open Agentic Wallet, Settings (top right icon), turn on Developer Mode, confirm the risk warning and approve the signature request. It lasts 7 days, each use extends it, it has its own daily limit, and the wallet balance must be under its cap.
* 351803: risk blocked. The CLI stops. Forewit never works around a risk block.
* 351805: the simulation failed (for example the commit window closed or the reveal window is not open). Run `status`.
* Any other error, or an unreadable result: the state is unknown. Do not resend. Check `baw wallet tx-history --type pending --binanceChainId 56 --json` and `baw wallet tx-lock --binanceChainId 56 --json` first.

Every transaction has value 0 and only pays network gas. Forewit never asks for funds and pays no returns.

## Forecast with your own LLM (`agent`)

`agent` does a whole round in one run: it reads the open round, asks your own LLM for one probability per question, then runs the normal commit flow (salt saved first, then the dry run, or with `--execute` the preview and your typed yes). It ends by printing the reveal command. You pay your LLM provider directly; Forewit pays nothing per user and sees nothing.

```bash
# Dry run: prints the baw commands
node agent/forewit.mjs agent --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env

# Preview, your typed yes, send
node agent/forewit.mjs agent --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env --execute

# After the commit deadline: reveal the newest committed round whose reveal window is open
node agent/forewit.mjs agent --reveal --from 0xYourAgenticWallet --execute
```

Settings, in your environment or in a file given with `--env-file` (the file wins). Only these four names are read from that file, so other secrets in it never enter the CLI:

* `FOREWIT_LLM_MODEL`: required: your provider's model id, for example `claude-opus-5-5` with `FOREWIT_LLM_API=anthropic`.
* `FOREWIT_LLM_KEY`: your API key, sent only in the auth header. Leave it empty for a local server.
* `FOREWIT_LLM_API`: `openai` (default, any OpenAI compatible chat completions endpoint: OpenAI, OpenRouter, Groq, Ollama, LM Studio and others) or `anthropic` (the Anthropic Messages API).
* `FOREWIT_LLM_URL`: the endpoint. Defaults to `https://api.openai.com/v1/chat/completions` or `https://api.anthropic.com/v1/messages`. It must be https; plain http is allowed only for localhost, for example `http://localhost:11434/v1/chat/completions` for Ollama.

What goes to the LLM, and what never does:

* Sent: the question texts (event question plus label, cross checked against the chain), the current time and the commit deadline. Nothing else.
* Never sent: the salt, the wallet address, the receipt. The LLM is asked before the salt exists.
* The question texts come from Predict.fun and are untrusted. The prompt passes them as JSON data and tells the model to ignore any instructions inside them.
* The reply must be exactly `{"p":[...]}` with one number from 1 to 99 per question, in order (one surrounding code fence is tolerated). Anything else, a wrong count, a 0 or a 100 is refused and shown, and nothing is saved or sent. A refusal is never clamped into a forecast.

Round file: `--round-file` is optional on mainnet. Without it the CLI fetches `https://forewit.xyz/data/rounds/<latest round>.json` and cross checks it against the chain like any round file.

## Daily schedule (`schedule`)

```bash
# Print the daily job for this machine (nothing is installed)
node agent/forewit.mjs schedule --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env

# Write the script and register it
node agent/forewit.mjs schedule --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env --install
```

The job runs once a day at `--at HH:MM` local time (default: 12:00 UTC in your local time; daily rounds open about 03:00 UTC and take commits until 23:00 UTC, and the previous round's reveal window is open then too). It first runs `agent --reveal --execute`, then `agent --execute`, so one sitting reveals yesterday and forecasts today.

Why it opens a terminal instead of sending by itself: every commit and reveal needs your typed yes, and the CLI refuses a piped or scripted yes. A background job cannot type it, and Forewit does not offer a way around that. So:

* Windows: a Task Scheduler task (`schtasks /Create ... /IT`) opens a console window with `~/.forewit/forewit_daily.cmd` while you are signed in. Review each preview and type yes, or close the window to skip. Remove it with `schtasks /Delete /F /TN "Forewit daily"`.
* macOS: a launchd agent (`~/Library/LaunchAgents/xyz.forewit.daily.plist`) opens Terminal with `~/.forewit/forewit_daily.command`. Remove it with `launchctl unload -w` on that plist.
* Linux: cron has no terminal, so the cron job (`~/.forewit/forewit_daily.sh`) only runs the read only `status`, appends it to `~/.forewit/schedule.log` and shows a desktop notice with `notify-send` when available. Then run the two `agent` commands yourself. It never calls your LLM or saves a salt in the background.

Notes: run `schedule` from a stable copy of the CLI (this repository checkout), not from an npx cache path, which can disappear; the job points at the exact file that created it. A scheduled task does not see variables from your shell, so pass `--env-file`. Times are local, so the job follows daylight saving changes.

## How salts are stored and protected

A commit is a hash of your probabilities and a random 32 byte salt. The salt keeps your forecast hidden until the deadline, and you need it again to reveal.

* `commit` makes the salt with `crypto.randomBytes(32)` and writes a reveal receipt (round, wallet, probabilities, packed value, salt, commit hash, deadlines) to `~/.forewit/` before it prints anything else. If saving fails, nothing is printed and you have nothing to send.
* Each commit gets its own file, named after the chain, ledger, round, wallet and commit hash. Committing again in the same round never overwrites an older salt, and `reveal` picks the receipt whose hash matches the commit that is actually onchain.
* Writes are atomic: a temporary file in the same folder is written, flushed, locked and then renamed into place.
* POSIX (Linux, macOS): the folder is mode 0700 and each file 0600, checked after writing.
* Windows: the CLI runs `icacls` from `System32` (no shell) to remove inherited permissions and every other entry on the folder and the file, granting full control only to the account reported by `whoami`. It then reads the permissions back and fails closed (deletes the file and stops) if any other principal remains, including SYSTEM, Administrators, Users, Authenticated Users or Everyone.
* The CLI never uploads a salt or your forecast before you send the commit. It checks its hash encoding against the contract's `computeCommitHash` using a separate throwaway salt and dummy forecast. Do not share your salt before the commit deadline: anyone holding it can learn your forecast.

A restored receipt copied back into `~/.forewit/` by hand keeps whatever permissions the copy got, so keep backups somewhere private (a password manager or an offline note).

## Lost salt means forfeit

Without the salt your commit cannot be revealed. A commit that is not revealed by the reveal deadline is scored as a forfeit: every non void question counts with the worst possible Brier score. Back up each receipt with `node agent/forewit.mjs receipt --show-salt` (without the flag the salt stays hidden, so an agent running the CLI never sees it), and come back during the reveal window.

## Tests

```bash
node --test agent/test/
```

The tests check keccak256 vectors, the golden commit hash vector, function selectors, full calldata and result decoding against viem (installed at the repository root as a dev dependency only), probability clamping, receipt matching, the CLI refusals, round file titles and their chain cross check, and that a secret file on this machine ends up readable by the current user only. Execute mode is tested against a fake `baw` script (`test/fixtures/fake_baw.mjs`, selected by the test only variable `FOREWIT_BAW_BIN`): the happy path, PENDING_CONFIRMATION, each error code, previews with a wrong target, value or calldata, a non TTY stdin, and every answer other than yes. `agent` is tested against a fake LLM on localhost (OpenAI and Anthropic shapes): the happy path through execute, malformed model output refused, the salt and wallet never in the LLM request, a piped yes refused before the LLM, the chain or baw is touched, and `agent --reveal`. `schedule` is tested as a pure plan for Windows, macOS and Linux and in print mode; the tests never install a schedule.

## Risk warning

Forecasting scores only. Not financial advice. Forewit does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.
