# Owner permissions (ForecastLedger, ForewitScores and OpenForecasts)

ForecastLedger is non upgradeable: no proxy, no selfdestruct, no delegatecall, no payable function. It holds no funds and no tokens and asks for no approvals.

## Roles
* ROUND_MANAGER can create rounds, choosing questions by the published selection rule (docs/QUESTION_SELECTION.md) and each round's resolution wait (1 to 120 days, fixed at creation and published before any commit), and posts the market baseline in clear, once, only in the last 15 minutes before the commit deadline. The baseline sets every forecaster's skill for that round (not Brier); its raw order books are archived and operator wallets are never ranked.
* PAUSER can pause new commits and new rounds. Pause never blocks reveal, revealFor, seal, finalize, voidStale, score or forfeit.
* DEFAULT_ADMIN can grant and revoke roles instantly (only the admin seat itself moves by a two step transfer with a 1 day delay). When that transfer completes, the old admin's PAUSER_ROLE moves to the new admin.

## Nobody, including the admin, can
* edit or delete commits, reveals, outcomes or scores;
* set a market outcome (outcomes come only from the Conditional Tokens payouts onchain, or Void);
* move any asset, because the contract holds none.

## Fixed forever at deploy (immutable, no setter exists)
* AGENT_ID: the Agent ID contract used for the commit gate.
* The allowlist of up to 4 Conditional Tokens contracts.
* MIN_COMMIT_WINDOW and MIN_REVEAL_WINDOW: the shortest commit and reveal windows a round may have. On BSC mainnet (chain 56) the constructor refuses anything below 2 hours and 12 hours, and the mainnet deploy script fails before broadcasting if the configured windows are lower. Short windows exist only on test networks for fast end to end tests.
* Maximum windows (7 days each), the resolution wait bounds (1 to 120 days), MAX_QUESTIONS (16), MAX_BATCH (100) and the commit hash scheme are compile time constants.

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

## Plan after the hackathon
* Move DEFAULT_ADMIN to a multisig, or renounce roles that are not essential. This will be announced before it happens.
