---
description: Every power the Forewit team holds over the two contracts, and what nobody can do.
---

# Owner permissions

Short version: the team can run rounds and post score roots. Nobody, the team included, can edit a forecast, a score or an outcome, or touch anyone's funds. The contracts hold none.

Both contracts are non upgradeable: no proxy, no selfdestruct, no delegatecall, no payable function.

## Who holds which role (read back onchain, 24 Nov 2026)

* Admin: [0xF3b4728B30F0F380d77dE9d025E33680F66591bD](https://bscscan.com/address/0xF3b4728B30F0F380d77dE9d025E33680F66591bD). Default admin on both contracts, and pauser on ForecastLedger. A single key today, not a multisig.
* Keeper: [0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18](https://bscscan.com/address/0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18). Round manager on both contracts. A hot key that runs the daily jobs from GitHub Actions.
* Deployer: [0x6732027E7f908E274bF4360Ce19cC182F82d008C](https://bscscan.com/address/0x6732027E7f908E274bF4360Ce19cC182F82d008C). Deployed both contracts and holds **no role**.

These wallets are "operators". They are never ranked and never get a ForewitScores leaf.

## ForecastLedger

[0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6)

* Round manager (keeper) can:
  * create rounds, choosing questions by the published selection rule and each round's resolution wait (1 to 120 days, fixed at creation);
  * post the market baseline in clear, once per round, only in the last 15 minutes before the commit deadline. The baseline sets every forecaster's skill for that round (not their Brier score).
* Pauser (admin) can pause new rounds and new commits. Pause never blocks reveal, revealFor, seal, finalize, voidStale, score or forfeit, so nobody is trapped.
* Admin can grant and revoke roles instantly. Only the admin seat itself moves by a two step transfer with a 1 day delay, and the pauser role moves with it.

## ForewitScores

[0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)

* Round manager (keeper) can post a new root (append only) and revoke only the newest two epochs: a bad root and the correction that replaces it.
* Admin can revoke any epoch and grant or revoke roles. Same two step admin transfer with a 1 day delay.
* There is no pause: there is nothing to pause, and revoke covers bad data.
* A revoke is permanent. A revoked epoch never verifies again.

## Nobody, including the admin, can

* edit or delete commits, reveals, outcomes or scores;
* set a market outcome (outcomes come only from Conditional Tokens payouts onchain, or Void);
* edit or delete a posted root (only revoke it);
* move any asset, because the contracts hold none and ask for no approvals.

## Fixed forever at deploy

* ForecastLedger: the Agent ID contract, the allowlist of 3 Predict.fun Conditional Tokens contracts, and minimum windows of 2 hours to commit and 12 hours to reveal (enforced on BSC mainnet). Maximum windows (7 days), the resolution wait bounds, at most 16 questions, batches of at most 100, and the commit hash scheme are compile time constants.
* ForewitScores: `LEDGER`, `AGENT_ID` (checked equal to the ledger's at deploy), `SHRINK_K` 20, `SCORE_VERSION` 1.

## OpenForecasts (v2, any market, 0xa034D7B62d04c8c4ac57a8C62047015C00DD6404)
* KEEPER (0xD1460596715c9f39a6EFBfd2760F62A4bF586C38) can post the market price for a forecast once, only within 120 seconds of its commit and before any reveal, or void a forecast within the same 120 seconds (reason codes in docs/OPEN_FORECASTS.md). It cannot touch a forecast after that, and cannot set outcomes or scores.
* PAUSER (the admin wallet) can pause new commits only. Reveal, finalize and score keep working while paused. Only the admin can unpause.
* DEFAULT_ADMIN can grant and revoke roles, including granting itself KEEPER. The admin seat moves by a two step transfer with a 1 day delay. Unlike ForecastLedger, PAUSER does not move with it: the handover grants PAUSER to the new admin and revokes it from the old one.
* Nobody, the admin included, can edit commits, reveals, outcomes (they come only from the Conditional Tokens payouts) or scores, and the contract holds no assets. Constants (the 120 second windows, the 3 day reveal window, the 1 to 99 percent reveal range, the Conditional Tokens allowlist and the Agent ID contract) have no setter.
* A price at 0 or 100 percent never counts on the site, so a stolen keeper key cannot mint skill that way.

## ForewitStart (free start, 0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A)
* No owner, no admin, no roles, no upgrade, no pause: nobody can change or stop it after deploy (26 Nov 2026, block 135826721, verified on BscScan and Sourcify).
* `start()` and `mint()` are the same free call (value 0): once per wallet, Agent ID holders only. It records the start time and a player number. No token is created, even if a wallet labels the call "Mint", and it holds no funds.
* A start is not a forecast and carries no score; the site counts starts apart from forecasts.

## Planned

After the hackathon, move the admin to a multisig or renounce roles that are not essential. This will be announced before it happens.

Source: [`docs/OWNER_PERMISSIONS.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/OWNER_PERMISSIONS.md), [`contracts/src/ForewitScores.sol`](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForewitScores.sol), [`docs/SCORES.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/SCORES.md) section 4.
