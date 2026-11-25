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

## Record
* v2 forecasts form their own record (accuracy, skill where a baseline exists, count, calibration). They are kept out of the v1 ranked leaderboard and the ForewitScores root, because self chosen questions are not comparable with a common round. A combined view may come later as a separately pre registered rule.
* /proof counts distinct Agent ID holders across both contracts.

## Gas (measured on v1 calls, 25 Nov 2026)
* Keeper per forecast: baseline about 55k, reveal about 85k, finalize about 48k (once per market), score about 55k: about 240k gas, about 0.000012 BNB at 0.05 gwei. 1,000 forecasts cost about 0.012 BNB. The v2 keeper uses its own wallet and its own job, so it can never starve the v1 deadline duties.
