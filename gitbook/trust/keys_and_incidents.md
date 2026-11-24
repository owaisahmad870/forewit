---
description: Every key and secret around Forewit, who holds it, what a leak or loss would do, and what we do if one leaks.
---

# Keys, secrets and incidents

Short version: your keys never leave the Binance app, and your salts never leave your own computer or your own private repository. Forewit runs no server that holds a user secret. The team's own keys can run rounds and post score roots, but cannot edit a forecast, a score or an outcome, and the contracts hold no funds.

## Your secrets

* **Wallet keys.** Created and kept by the Binance Agentic Wallet in the Binance app. Forewit never sees them and never asks for them. If someone asks you for a key, seed phrase or recovery code in Forewit's name, it is not us.
* **Wallet session.** Created when the official Binance Agentic Wallet CLI signs in, stored on the computer or cloud sandbox where it ran (`~/.baw`). A leaked session could ask the wallet to send within the wallet's own limits, so keep only a little BNB for gas in the Agentic Wallet you use with Forewit and sign out at the end of every session.
* **Pairing code.** Shown once by the official CLI, checked by you in the Binance app, valid for a few minutes. Never type it anywhere else. Forewit never sees it.
* **Salt and receipt.** Created at random by the forewit CLI on your side when you commit. Kept in `~/.forewit/` (readable only by your account) and, on the phone path, in your own private repository. If it leaks before the commit deadline, someone could read your forecast early. If you lose it, you cannot reveal and that round counts as a forfeit. After the reveal it is public anyway.

## The team's keys

* **Admin** ([0xF3b4728B30F0F380d77dE9d025E33680F66591bD](https://bscscan.com/address/0xF3b4728B30F0F380d77dE9d025E33680F66591bD)). An encrypted keystore kept offline, with offline backups. Can grant and revoke roles and pause new rounds and commits. A leak would let someone hand out roles or pause new rounds; it could still not edit any forecast, score or outcome. The admin seat itself moves only by a two step transfer with a 1 day delay. Plan: move it to a multisig that needs 2 of 3 signatures on separate devices, announced before it happens.
* **Keeper** ([0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18](https://bscscan.com/address/0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18)). A hot key stored as an encrypted GitHub Actions secret, used by the daily jobs. Holds the round manager role on both contracts and a small amount of BNB for gas.
* **Deployer** ([0x6732027E7f908E274bF4360Ce19cC182F82d008C](https://bscscan.com/address/0x6732027E7f908E274bF4360Ce19cC182F82d008C)). Deployed both contracts and holds no role, so a leak changes nothing onchain.
* **Service tokens** (RPC providers, Cloudflare Pages, health checks, the Predict.fun read key). Stored as encrypted GitHub Actions secrets. None of them can touch the contracts or any user data. A leak is fixed by rotating the token.
* **npm releases** are published from GitHub Actions through trusted publishing with provenance, so there is no long lived npm token to steal. You can check any release against its source commit on npm.

## If the keeper key leaks

What an attacker could do until the role is revoked:

* create rounds outside the selection rule;
* post a wrong market baseline for an open round in its last 15 minutes, before our keeper does, which would distort skill for that round (Brier scores are unaffected);
* post a wrong ForewitScores root, or revoke one of the two newest roots.

What an attacker could never do: edit or delete any commit, reveal, outcome or score, block anyone's reveal, or move any asset.

What we do:

1. The admin revokes the round manager role from the leaked key on both contracts. Revoking is instant.
2. The admin grants the role to a fresh keeper key, and the GitHub secret is replaced.
3. Any wrong root is revoked by the admin, and the correct root is posted again.
4. We publish the affected rounds and transactions on the [changelog](../reference/changelog.md) and on X within 24 hours.

## If the admin key leaks

The admin cancels any pending admin transfer, revokes every role it did not grant, and moves the admin seat to a fresh key or the multisig. The 1 day delay on admin transfers gives that time. We publish the incident the same way.

## If you find a problem

Report it privately through [GitHub security advisories](https://github.com/owaisahmad870/forewit/security/advisories/new). Please do not open a public issue for a security problem. See also [Owner permissions](owner_permissions.md) and [Privacy](privacy.md).
