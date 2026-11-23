# Question selection rule (v2, pre registered 23 Nov 2026)

The keeper applies this rule mechanically each day (keeper/keeper.mjs select) and archives the raw API response and its output, so anyone can rerun it. Changes are versioned and announced before the next round; a round never changes rules after it opens. No round has opened under v1, which v2 replaces.

## A market is eligible when all of these hold
1. Binary: getOutcomeSlotCount(conditionId) == 2 on the CTF, and unresolved (payoutDenominator == 0).
2. Its CTF is in the ledger allowlist, matched from the API fields: isYieldBearing false gives the standard CTF; isYieldBearing true gives the yield bearing CTF, or the yield bearing neg risk CTF when isNegRisk is true. The chain check in rule 1 must pass on exactly that CTF.
3. Outcome layout: indexSet 1 named Yes or Up and indexSet 2 named No or Down. The Yes slot is indexSet 1, slot 0. Any other naming is skipped.
4. Resolution time: the category endsAt is between 6 and 72 hours after the round's commit deadline (v2; v1 was 24 to 72 hours).
5. Hard cap for the hackathon (approved by Owais 23 Nov 2026): endsAt no later than 8 Dec 2026 00:00 UTC.
6. Crypto Up/Down markets (marketVariant CRYPTO_UP_DOWN or UP_DOWN): at most 3 per round, daily "Up or Down on <date>" markets first. They are exempt from rule 7 because their measured window often starts after selection.
7. Every other market: two sided order book, spread at most 10 points, at least 100 USD of 24 hour volume.
8. At most one market per event (category); 5 to 8 questions per round, most traded first after the crypto picks.

## Why v2 (data, 23 Nov 2026)
* Full census of 17,303 open mainnet markets: rule v1 left 657 candidates, all sports, only 14 with 100 USD or more of 24 hour volume (9 events).
* Daily BTC, ETH and BNB Up or Down markets are listed 2 days ahead and measured from 17:00 UTC to 17:00 UTC; the BTC one trades about 52k USD on its live day. With a 23:00 UTC commit deadline they resolve about 18 hours later.

## Pre registered prediction (Owais, 23 Nov 2026)
* Crypto question skill versus the market averages about zero; any measurable skill comes from non crypto questions. Checked on the hackathon rounds by category, with sample sizes.

## Backstops in the contract
* A question resolved before the round is sealed is Void.
* Each round sets its resolution wait at creation (1 to 120 days; the keeper uses 7 days for daily rounds). After the reveal deadline plus that wait, anyone may void a question still unresolved onchain.
