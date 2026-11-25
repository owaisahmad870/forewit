# Open forecasts (Forewit v2, pre registered 25 Nov 2026, before any v2 forecast exists)

Owais, 25 Nov 2026: "any market, any question, any time ... using its agentic wallet". Rounds stay for v1 (the ledger at 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6 keeps running unchanged, so its finalized daily rounds count as before). v2 adds a second contract, OpenForecasts, where a forecaster picks any binary Predict.fun market at any time.

## What a forecast is
* One forecast per wallet per market (conditionId). No cancel, no overwrite. The commit binds the chain, the contract, the market, the forecaster, the probability (1 to 99 percent, in basis points) and a random salt.
* Committing needs an Agent ID, a Conditional Tokens contract on the allowlist (Predict.fun's three), a market with exactly 2 outcome slots and no payout reported yet.
* The commit carries a copy of the forecast sealed with the drand time lock to the market's end time plus a margin (an argument of the call, emitted in the event). Nobody, Forewit included, can read it before then. After the market resolves onchain, anyone may reveal with the salt; the keeper reveals from the sealed copy.

## Market price (the baseline)
* The keeper records the Predict.fun order book middle for that market as soon as it sees the commit, and posts it onchain. The contract accepts it only within 120 seconds of the commit's block time.
* Skill against the market counts only when that price was posted in time and the book was two sided with a spread of at most 10 points. Otherwise the forecast is scored on accuracy (Brier) only, like the v1 Open board. This covers thin and very short markets.

## Void
* The contract cannot see when Predict.fun stopped trading a market. The keeper voids a forecast committed at or after the market's end time as published by the Predict.fun API (archived with the commit), or when the book was closed. Anyone can recompute this from the archive. A void forecast is never scored.

## Resolution, reveal and score
* Outcomes come only from the Conditional Tokens payouts onchain (Yes, No, or Void for a split), recorded by a public finalize call that also stamps the resolution time.
* Reveal window: 3 days after that onchain resolution time. Revealed forecasts are scored; unrevealed ones are scored as a forfeit (worst Brier), as in v1.

## Record (Owais decision 25 Nov 2026: one merged record)
* v1 round forecasts and v2 open forecasts form one track record per wallet and one leaderboard.
* Per question, skill = market Brier minus the forecaster's Brier, counted only where a market price exists (v1 baseline, v2 price within 120 s on a two sided book). Merged score = (v1 sumSkill + v2 sumSkill) / (v1 baseline questions + v2 baseline forecasts + K), K = 20.
* Ranking eligibility: at least 20 scored questions with a market price across both, and at least 5 distinct scoring days (v1 rounds or v2 resolution days), replacing v1's 5 rounds rule for the merged board.
* Forfeits count in both (worst Brier). Void forecasts and split payouts never count.
* The ForewitScores root carries the merged numbers from the first root built after OpenForecasts goes live; roots before that stay v1 only.
* /proof counts distinct Agent ID holders across both contracts.

## Commit fields
* commit(ctf, conditionId, slot, marketId, commitHash, sealedCopy). marketId is the Predict.fun market id, emitted so the keeper can read the price; the contract trusts only ctf and conditionId.

## Market data and the Predict.fun terms
* Predict.fun's terms forbid scraping and redistributing their data, so Forewit does not publish market lists or prices for everyone.
* Each user browses and searches markets in their own agent with their own free API key from https://developers.predict.fun (set PREDICT_API_KEY). The site and connector publish only aggregate counts per market group.
* Live prices on forewit.xyz are shown only for markets a Forewit user has a forecast on, fetched with Forewit's own key, cached, and labelled as Predict.fun data.

## Gas (measured on v1 calls, 25 Nov 2026)
* Keeper per forecast: baseline about 55k, reveal about 85k, finalize about 48k (once per market), score about 55k: about 240k gas, about 0.000012 BNB at 0.05 gwei. 1,000 forecasts cost about 0.012 BNB. The v2 keeper uses its own wallet and its own job, so it can never starve the v1 deadline duties.
