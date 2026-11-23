# Agent ID Crowd: method v1 (pre registered 23 Nov 2026, before any mainnet round)

The Agent ID Crowd is one probability per question, combined from every revealed forecast in the round. It is computed off chain by indexer/lib/crowd.mjs from chain data only, so anyone can recompute it. The crowd is always compared with the market baseline and with the simple mean, and the result is shown even when the crowd loses.

## Inputs (no look ahead)
* The revealed forecasts of the round (Revealed events), in basis points.
* For each forecaster, the record from rounds that were fully resolved and scored BEFORE this round's commit deadline: resolved rounds r, sumSkill, baselineQuestions. Nothing from the round itself or later rounds is used.

## Combination
1. Clamp each probability to [100, 9900] bps (1% to 99%) and convert to log odds: L = ln(p / (1 minus p)).
2. Weight per forecaster:
   * fewer than 3 prior resolved rounds: w = 1 (equal weight while there is no track record);
   * 3 or more: w = 0.1 + max(0, s) / s_ref, where s = sumSkill / (baselineQuestions + 20) is the shrunk mean skill per question (the leaderboard score) and s_ref is the mean of s over established forecasters with s > 0 in this round. If no established forecaster has s > 0, every established forecaster gets w = 0.1.
3. Crowd log odds = sum(w x L) / sum(w); crowd probability = 1 / (1 + e^(minus log odds)).
4. Extremizing: none in v1 (factor 1). A factor may only be adopted by a new pre registered version, chosen on past resolved rounds, never on the rounds it is then scored on.
5. A question needs at least 1 revealed forecast; otherwise the crowd has no value for it and it is excluded from crowd scoring.

## Scoring the crowd (same rule as forecasters)
* Brier per question in bps squared against the onchain outcome; Void questions skipped.
* Reported side by side over the same questions: crowd Brier, simple mean Brier (equal weight log odds of all reveals), market baseline Brier, with the number of questions n, and broken down by round kind and category (crypto versus non crypto, per the v3 prediction).

## Why this design
* Equal weights until a track record exists avoids rewarding luck in the first rounds; shrinkage (K = 20) and the 0.1 floor keep one lucky forecaster from dominating.
* Log odds pooling is the standard choice for combining probabilities; extremizing is left out until past data can justify it.
