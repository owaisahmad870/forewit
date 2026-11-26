---
description: Why your forecast is sealed before the deadline, why the salt stays on your device unless you choose auto reveal, and what happens if it is lost.
---

# Commit and reveal

## The picture: a sealed envelope

You seal your answers in an envelope and pin it to a public board before the deadline. Nobody sees inside. After the deadline you open it in public, and everyone checks it is the card you sealed. So nobody can copy the best forecasts or the crowd.

* The envelope is the **commit hash**, posted onchain.
* The card is your **forecast**: one probability per question.
* The seal is your **salt**: a random secret that only you hold.

```mermaid
sequenceDiagram
    participant D as Your device
    participant L as ForecastLedger
    Note over D: make a random 32 byte salt<br/>save the receipt locally
    D->>L: commit(round, hash of forecast and salt)
    Note over L: only the hash is public
    Note over D,L: commit deadline
    D->>L: reveal(round, forecast, salt)
    L->>L: recompute the hash and compare
    Note over L: match: forecast stored and later scored
```

## What the hash binds

The contract's own `computeCommitHash`:

```solidity
keccak256(abi.encode(COMMIT_TYPEHASH, block.chainid, address(this), roundId, forecaster, packed, salt))
```

One hash fits exactly one chain, ledger, round, wallet, forecast and salt. Nobody can reuse your commit elsewhere or reveal a different forecast for you. Source: [ForecastLedger.sol](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol).

## Your salt

Without a salt, anyone could hash every likely forecast and find yours. The salt is 32 random bytes, so guessing is hopeless, as long as it stays secret:

* The tool makes the salt on your computer and saves it in a reveal receipt in the `.forewit` folder in your home folder, readable only by your account, before anything can be sent.
* It never uploads your salt or forecast before the deadline. The one exception is auto reveal, which you turn on yourself.
* It refuses to reveal before the commit deadline, and `receipt` hides the salt unless you add `--show-salt`.

Back up every receipt right after you commit, into a password manager or an offline note:

```bash
npx forewit@0.1.7 receipt --from 0xYourAgenticWallet --show-salt
```

On a new computer, save the backup as a `.json` file in the `.forewit` folder; the tool finds it by its hash. If you commit twice in a round, it picks the receipt that matches the commit onchain.

{% hint style="warning" %}
Without the salt your commit cannot be revealed, by you or anyone. A commit not revealed by the reveal deadline is a **forfeit**: every non Void question in that round counts with the worst possible Brier score (1 in probability units). Revealing is never worse than forfeiting.
{% endhint %}

## Auto reveal (opt in)

A second copy of your card rides along behind a time lock that nobody, Forewit included, can open before the deadline. After the deadline a helper opens it and reveals for you.

* Turn it on with `--auto-reveal` on `commit`, with `auto_reveal: true` on the MCP tool `prepare_commit`, or by answering yes in `forewit start`.
* The tool encrypts a copy of your forecast and salt with drand timelock (tlock, the drand quicknet network run by the League of Entropy) to a drand round about 60 seconds after the commit deadline, and appends it to the commit calldata. The ledger ignores trailing calldata, so the commit hash is unchanged.
* After the deadline the Forewit keeper decrypts it, checks it against your onchain commit with `computeCommitHash`, and calls `revealFor`. You pay no gas and need no second step. Anyone may call `revealFor(roundId, forecaster, packed, salt)`; it is safe because the hash binds your wallet, so only your exact forecast can be revealed, for you.
* Your local receipt is still your backup. If `status` still shows not revealed about an hour after the deadline, reveal yourself.

{% hint style="info" %}
Trust assumption: the drand network does not release a round early. A colluding threshold of drand operators could read forecasts early, but never change them, because the commit hash is already onchain.
{% endhint %}

## Rules the contract enforces

* Commit only before the commit deadline, and only from a wallet that holds an Agent ID.
* Reveal only from the commit deadline to the reveal deadline.
* Reveal once. The forecast must match the hash exactly, with every probability at most 100%.
* Pausing the contract can stop new commits, but never reveals or scoring ([docs/OWNER_PERMISSIONS.md](https://github.com/owaisahmad870/forewit/blob/main/docs/OWNER_PERMISSIONS.md)).

Read next: [Scoring](scoring.md).
