# Question selection rule (v3, pre registered 23 Nov 2026)

The keeper applies this rule mechanically (keeper/keeper.mjs select --kind daily|long; logic in keeper/lib/selection.mjs, tests in keeper/test/selection.test.mjs) and archives the raw API response and its output, so anyone can rerun it. Changes are versioned and announced before the next round; a round never changes rules after it opens. No real round has opened under v1 or v2.

## Common to every round
1. Binary: getOutcomeSlotCount(conditionId) == 2 on the CTF, and unresolved (payoutDenominator == 0).
2. Its CTF is in the ledger allowlist, matched from the API fields: isYieldBearing false gives the standard CTF; isYieldBearing true gives the yield bearing CTF, or the yield bearing neg risk CTF when isNegRisk is true. The chain check in rule 1 must pass on exactly that CTF.
3. Outcome layout: indexSet 1 named Yes or Up and indexSet 2 named No or Down. The Yes slot is indexSet 1, slot 0.
4. No sports: any marketVariant starting with SPORTS_ or ESPORTS_ is excluded (Owais decision, 23 Nov 2026).
5. Liquidity for every non crypto question: two sided order book, spread at most 10 points, at least 100 USD of 24 hour volume.
6. At most one market per event (category); daily crypto first, then the most traded.
7. End time is the category endsAt (the API has no end time on the market).

## Daily rounds (resolution wait 7 days)
* Questions: every daily crypto Up or Down market ("Bitcoin/Ethereum/BNB Up or Down on <date>", marketVariant CRYPTO_UP_DOWN or UP_DOWN), with no cap, plus non sports event markets passing rule 5. Hourly and other intraday crypto markets are excluded.
* Daily crypto markets are exempt from rule 5, because their measured window often starts after selection; their baseline is still the mid at the commit deadline (last trade if a side is empty, flagged).
* Window: endsAt between 6 and 72 hours after the commit deadline, and no later than 8 Dec 2026 00:00 UTC (hackathon cap).
* Size: at least 3 questions (the keeper alerts below 3), at most 8.

## Long horizon rounds (resolution wait 120 days)
* Questions: non sports event markets only (no crypto Up or Down), passing rule 5.
* Window: endsAt more than 72 hours and at most 100 days after the commit deadline, so the 120 day resolution wait after the reveal deadline covers the oracle step.
* Size: at least 3, at most 8. No 8 Dec cap: these rounds are not part of the 7 completed rounds target.

## Pre registered predictions
* Crypto question skill versus the market averages about zero; any measurable skill comes from non crypto questions (Owais, 23 Nov 2026). Checked by category with sample sizes.

## History
* v1 (24 to 72 h, all categories): census showed only 14 liquid candidates out of 17,303 open markets, all sports.
* v2 (6 to 72 h, at most 3 crypto, sports allowed): replaced the same day by v3 before any round.
* v3 (this): sports excluded, daily crypto uncapped, minimum 3 questions, long horizon rounds added.

## Backstops in the contract
* A question resolved before the round is sealed is Void.
* Each round sets its resolution wait at creation (1 to 120 days). After the reveal deadline plus that wait, anyone may void a question still unresolved onchain.
