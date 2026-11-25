# Open forecasts (Forewit v2, pre registered 25 Nov 2026, before any v2 forecast exists)

Owais, 25 Nov 2026: "any market, any question, any time ... using its agentic wallet". Rounds stay for v1 (the ledger at 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6 keeps running unchanged, so its finalized daily rounds count as before). v2 adds a second contract, OpenForecasts, where a forecaster picks any binary Predict.fun market at any time.

## What a forecast is
* One forecast per wallet per market (conditionId). No cancel, no overwrite. The commit binds the chain, the contract, the market, the forecaster, the probability (1 to 99 percent, in basis points) and a random salt.
* Committing needs an Agent ID, a Conditional Tokens contract on the allowlist (Predict.fun's three), a market with exactly 2 outcome slots and no payout reported yet.
* The commit carries a copy of the forecast sealed with the drand time lock to the market's end time plus a margin (an argument of the call, emitted in the event). Nobody, Forewit included, can read it before then. After the market resolves onchain, anyone may reveal with the salt; the keeper reveals from the sealed copy.

## Market price (the baseline)
* Rule v2.1 (25 Nov 2026, before the first v2 forecast). The market price is Predict.fun's own chance history (GET /v1/markets/{id}/timeseries, 1 minute points): the last 1 minute bucket that ended at or before the commit's block time and is at most 3 minutes old, for the forecast's outcome. It counts only if the live book middle, read when the keeper posts, is within 3 points of it, so a commit timed right after a price jump gets no price. Nothing posted after the commit can raise or lower it (final review of H1, 25 Nov 2026: a price read from the book after the commit could be planted with the forecaster's own orders). The keeper posts it within 120 seconds of the commit; the contract refuses it later, after the market is finalized, or after the forecast is revealed.
* A price counts only when the market traded at least 100 USD in the last 24 hours (the v1 liquidity floor) and the price is strictly between 0 and 100 percent.
* No price for a commit in the last 60 seconds of the market's life, when the outcome may be nearly known (final review M5). Rule v2.2 (owner decision, 25 Nov 2026, for commits from 20:00 UTC that day): the earlier limit of the last 20 percent of the market's life (rule v2.1) is dropped; commits before that time keep rule v2.1.
* Residual risk, stated plainly: someone who trades a thin market before committing can move its price history, paying real trades and fees; the same holds for any market price.
* A forecast without such a price counts for nothing in the record (no accuracy, no count, no scoring day). It is still scored onchain and shown on the owner's card as "not counted". Re-review M1: so a forecast slipped in during a keeper gap can never help a record.
* Per wallet, the keeper pays for at most 50 new forecasts a day (price and reveal), and those come first in every pass; beyond that a forecast gets no price (so it counts for nothing) and the owner reveals it.

## Void
* The contract cannot see when Predict.fun stopped trading a market. The keeper voids, only within 120 seconds of the commit and only on positive evidence (an API outage never voids), with a reason code:
  * 1: committed at or after the market's end time (category tradingSession.closesAt, else endsAt);
  * 2: the market's trading status was not OPEN when read within 15 seconds of the commit;
  * 3: no such market, or its condition, Conditional Tokens contract or outcome layout does not match the commit;
  * 4: a reveal start (revealNotBefore) later than the market end plus 5 minutes, or with no published end time (re-review N1: no delaying a losing forecast's forfeit). The contract also refuses any reveal start without a sealed copy.
* The evidence behind every decision is archived, so anyone can recompute it. A void forecast is never scored.

## Resolution, reveal and score
* Outcomes come only from the Conditional Tokens payouts onchain (Yes, No, or Void for a split), recorded by a public finalize call that also stamps the resolution time.
* Reveal window: 3 days after the later of the onchain resolution time and the time the sealed copy opens (revealNotBefore, at most 120 days after the commit), so a market that resolves early never turns an auto reveal into a forfeit. Revealed forecasts are scored; unrevealed ones are scored as a forfeit (worst Brier), as in v1. Scoring waits until 120 seconds after the commit, so it can never race a void.
* A revealed probability must be 1 to 99 percent (100 to 9900 basis points).
* Auto reveal is refused for a market that publishes no end time; the owner then reveals from their receipt.

## Record (Owais decision 25 Nov 2026: one merged record)
* v1 round forecasts and v2 open forecasts form one track record per wallet and one leaderboard.
* Per question, skill = market Brier minus the forecaster's Brier, counted only where a market price exists (v1 baseline, v2 price posted within 120 s by rule v2.1). Merged score = (v1 sumSkill + v2 sumSkill) / (v1 baseline questions + v2 baseline forecasts + K), K = 20.
* Ranking eligibility: at least 20 scored questions with a market price across both, and at least 5 distinct scoring days (v1 rounds or v2 resolution days), replacing v1's 5 rounds rule for the merged board.
* Forfeits count in both (worst Brier). Void forecasts and split payouts never count.
* Planned, not built yet: a ForewitScores root that carries the merged numbers. Until it ships, roots are v1 only and the merged record lives in the published snapshot.
* /proof counts distinct Agent ID holders across both contracts.

## Commit fields
* commit(ctf, conditionId, slot, marketId, commitHash, revealNotBefore, sealedCopy). marketId is the Predict.fun market id, emitted so the keeper can read the price; the contract trusts only ctf and conditionId.

## Market data and the Predict.fun terms
* Predict.fun's terms forbid scraping and redistributing their data, so Forewit does not publish market lists or prices for everyone.
* Each user browses and searches markets in their own agent with their own free API key from https://developers.predict.fun (set PREDICT_API_KEY). The site and connector publish only aggregate counts per market group.
* Live prices on forewit.xyz are shown only for markets a Forewit user has a forecast on, fetched with Forewit's own key, cached, and labelled as Predict.fun data.

## Gas (measured on v1 calls, 25 Nov 2026)
* Keeper per forecast: baseline about 55k, reveal about 85k, finalize about 48k (once per market), score about 55k: about 240k gas, about 0.000012 BNB at 0.05 gwei. 1,000 forecasts cost about 0.012 BNB. The v2 keeper uses its own wallet and its own job, so it can never starve the v1 deadline duties.

## Trust, stated plainly
* The keeper role can post one price per forecast within 120 seconds and void within 120 seconds, nothing else. The admin can grant itself the keeper role (an AccessControl admin), so the admin is trusted for those two actions too; the admin can never edit a commit, a reveal, an outcome or a score.
* Auto reveal: a drand, RPC or gas error is retried on the next keeper pass (one alert); only an unreadable or mismatching sealed copy is given up, and the owner can still reveal by hand.
