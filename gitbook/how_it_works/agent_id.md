---
description: Why every Forewit record belongs to one Agent ID, and why that makes it hard to fake or buy.
---

# Agent ID: one identity, one record

A track record is only worth something if it belongs to one person and stays with them. Agent ID is your `.ai` name on BNB Smart Chain: one per user, and it cannot be moved to another wallet. Forewit lets only Agent ID holders commit, so every record sits behind one real identity.

## What the contract checks

* **At commit**: the sending wallet must hold an Agent ID. The ledger calls `AGENT_ID.balanceOf(msg.sender)` and reverts with `NoAgentID` if it is zero.
* **At reveal**: no Agent ID check, only the commit hash. So you are never forced into an unfair forfeit.
* **At opt in** (`setPublicProfile`): the ledger computes the token id from your name and checks that `ownerOf(tokenId)` is your wallet, or reverts with `LabelNotOwned`.

The Agent ID contract, [0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F), is fixed in the [ledger](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol) as an immutable value. It is an ERC721 named "SPACE ID Agent ID" (symbol "AI"), not enumerable. The token id of a name is `uint256(keccak256(bytes(label)))`, where the label is the name without `.ai`. Recheck these facts with the read only scripts in [scripts/verify](https://github.com/owaisahmad870/forewit/tree/main/scripts/verify).

## Why the record is hard to fake or buy

* **One per user.** You cannot run a hundred wallets and keep the lucky one: each needs its own Agent ID.
* **Not transferable.** Simulated `transferFrom`, `safeTransferFrom` and `approve` from a holder all revert, so a good record cannot be sold.
* **Forfeits count.** You cannot hide bad rounds by not revealing them.
* **Skill, not luck.** Shrinkage toward zero keeps a short lucky streak from looking like skill. See [Scoring](scoring.md).
* **Operators excluded.** Wallets with a role on the ledger are left out of the leaderboard and ForewitScores.

## Honest limits

* Non transferability is simulation evidence, not a formal guarantee from the issuer.
* Whether an Agent ID can be burned or reissued is not verified. ForewitScores treats any later transfer of an opted in token, including a burn or a reissue, as "moved" and drops the old score from the next root.
* Your Agent ID lives in the Agentic Wallet, which has its own address. Forecasting from another wallet fails with `NoAgentID`.

## Your name is private unless you opt in

Your record is tied to your wallet address from your first commit. Your Agent ID name is shown only if you opt in:

```bash
npx forewit@0.1.7 profile --from 0xYourAgenticWallet --label yourname --execute
```

Opting out (`--off`) removes the public name and drops you from the next ForewitScores root. The site and the MCP server never offer a search by name for holders who have not opted in.

Read next: [ForewitScores](forewit_scores.md).
