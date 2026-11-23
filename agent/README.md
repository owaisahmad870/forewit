# PRESCIENT agent toolkit

Play PRESCIENT daily forecast rounds with your Binance Agentic Wallet and Agent ID.

> Forecasting scores only. Not financial advice. PRESCIENT does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.

Every transaction this toolkit prepares has value 0 and goes to one pinned contract. PRESCIENT never asks for funds and pays nothing out; the only cost is network gas.

This folder holds:

* `prescient.mjs`: a zero dependency Node CLI (Node 26 or newer) that reads rounds from the chain, computes commits, stores salts safely and prints the exact `baw` commands.
* `SKILL.md`: a Claude Code skill with the preflight, the round flow and the hard rules for agents.
* `llms.txt`: a short machine readable summary for any agent.
* `config.mjs`: the pinned networks and ledger addresses. The CLI has no flag to change them.

## Quickstart

You need Node 26, the Binance Agentic Wallet CLI (`baw`, npm package `@binance/agentic-wallet`), an Agent ID, and Developer Mode turned on in the Binance App (Agentic Wallet, Settings, Developer Mode; it has its own daily limit and lasts 7 days).

From the repository root:

```bash
# 1. See the current round and its questions
node agent/prescient.mjs round

# 2. Check your probabilities (percentages, one per question, clamped to 1% to 99%)
node agent/prescient.mjs forecast --p 72,15,50

# 3. Your wallet address: the binanceChainId 56 entry
baw wallet address --json

# 4. Commit: saves your salt, then prints the baw preview and execute commands
node agent/prescient.mjs commit --from 0xYourAgenticWallet --p 72,15,50

# 5. Back up the reveal receipt somewhere private
node agent/prescient.mjs receipt --from 0xYourAgenticWallet

# 6. After the commit deadline, before the reveal deadline
node agent/prescient.mjs reveal --from 0xYourAgenticWallet

# Any time
node agent/prescient.mjs status --from 0xYourAgenticWallet
```

Common flags: `--network mainnet|testnet` (testnet until the mainnet ledger is pinned) and `--round N` (default: the latest round).

The CLI is dry run only. It never runs `baw` and never sends a transaction. For each commit or reveal it prints a preview command of this form, which you run yourself:

```bash
baw contract-call preview --binanceChainId 56 --from <wallet> --to <pinned ledger> --value 0 --inputData <calldata> --json
```

Then read `parsedTx`, `simulationResult` and `risks`, and only if you agree run `baw contract-call execute --requestId <requestId> --json`. If the result is `PENDING_CONFIRMATION`, approve it in the Binance App and do not resend. A risk block (351803) is final: do not work around it.

`baw` signs on BSC mainnet (chain 56) only. On testnet the CLI also prints the raw `to`, `value` and `data` so you can send the same call from any testnet wallet.

## How salts are stored and protected

A commit is a hash of your probabilities and a random 32 byte salt. The salt keeps your forecast hidden until the deadline, and you need it again to reveal.

* `commit` makes the salt with `crypto.randomBytes(32)` and writes a reveal receipt (round, wallet, probabilities, packed value, salt, commit hash, deadlines) to `~/.prescient/` before it prints anything else. If saving fails, nothing is printed and you have nothing to send.
* Each commit gets its own file, named after the chain, ledger, round, wallet and commit hash. Committing again in the same round never overwrites an older salt, and `reveal` picks the receipt whose hash matches the commit that is actually onchain.
* Writes are atomic: a temporary file in the same folder is written, flushed, locked and then renamed into place.
* POSIX (Linux, macOS): the folder is mode 0700 and each file 0600, checked after writing.
* Windows: the CLI runs `icacls` from `System32` (no shell) to remove inherited permissions and every other entry on the folder and the file, granting full control only to the account reported by `whoami`. It then reads the permissions back and fails closed (deletes the file and stops) if any other principal remains, including SYSTEM, Administrators, Users, Authenticated Users or Everyone.
* The CLI never uploads a salt or your forecast before you send the commit. It checks its hash encoding against the contract's `computeCommitHash` using a separate throwaway salt and dummy forecast. Do not share your salt before the commit deadline: anyone holding it can learn your forecast.

A restored receipt copied back into `~/.prescient/` by hand keeps whatever permissions the copy got, so keep backups somewhere private (a password manager or an offline note).

## Lost salt means forfeit

Without the salt your commit cannot be revealed. A commit that is not revealed by the reveal deadline is scored as a forfeit: every non void question counts with the worst possible Brier score. Back up each receipt with `node agent/prescient.mjs receipt`, and come back during the reveal window.

## Tests

```bash
node --test agent/test/
```

The tests check keccak256 vectors, the golden commit hash vector, function selectors, full calldata and result decoding against viem (installed at the repository root as a dev dependency only), probability clamping, receipt matching, the CLI refusals, and that a secret file on this machine ends up readable by the current user only.

## Risk warning

Forecasting scores only. Not financial advice. PRESCIENT does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.
