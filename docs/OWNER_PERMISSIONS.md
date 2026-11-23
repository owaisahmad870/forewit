# Owner permissions (ForecastLedger)

ForecastLedger is non upgradeable: no proxy, no selfdestruct, no delegatecall, no payable function. It holds no funds and no tokens and asks for no approvals.

## Roles
* ROUND_MANAGER can create rounds, choosing questions by the published selection rule (docs/QUESTION_SELECTION.md) and each round's resolution wait (1 to 120 days, fixed at creation and published before any commit), and can commit and reveal the baseline.
* PAUSER can pause new commits and new rounds. Pause never blocks reveal, revealFor, seal, finalize, voidStale, score or forfeit.
* DEFAULT_ADMIN can grant and revoke roles, using a two step transfer with a 1 day delay.

## Nobody, including the admin, can
* edit or delete commits, reveals, outcomes or scores;
* set a market outcome (outcomes come only from the Conditional Tokens payouts onchain, or Void);
* move any asset, because the contract holds none.

## Fixed forever at deploy (immutable, no setter exists)
* AGENT_ID: the Agent ID contract used for the commit gate.
* The allowlist of up to 4 Conditional Tokens contracts.
* MIN_COMMIT_WINDOW and MIN_REVEAL_WINDOW: the shortest commit and reveal windows a round may have. On BSC mainnet (chain 56) the constructor refuses anything below 2 hours and 12 hours, and the mainnet deploy script fails before broadcasting if the configured windows are lower. Short windows exist only on test networks for fast end to end tests.
* Maximum windows (7 days each), the resolution wait bounds (1 to 120 days), MAX_QUESTIONS (16), MAX_BATCH (100) and the commit hash scheme are compile time constants.

## Plan after the hackathon
* Move DEFAULT_ADMIN to a multisig, or renounce roles that are not essential. This will be announced before it happens.
