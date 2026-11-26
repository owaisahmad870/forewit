# Scoring (ForecastLedger v1)

## Per question, onchain
* Probabilities are in basis points: p from 0 to 10000. The outcome o is 10000 for Yes and 0 for No.
* Brier = (p minus o) squared, in bps squared: 0 is perfect, 1e8 (100,000,000) is the worst possible.
* Void questions (a split payout, a resolution seen before the round was sealed, or a question still unresolved after the reveal deadline plus the round's resolution wait) are skipped by everyone.
* Baseline Brier: the same formula applied to the market baseline: the order book mid prices posted in clear by the keeper in the last 15 minutes before the commit deadline (contract enforced; the keeper targets 5 minutes before), last trade price if a side is empty (flagged in the archive). A round without a baseline scores skill 0 for everyone and is flagged baseline_missing.
* Skill = baseline Brier minus own Brier. Positive skill means the forecaster beat the market price on that question.
* Forfeit (committed, never revealed): every non void question counts as Brier 1e8, and skill is computed against the baseline the same way. Revealing is never worse than forfeiting.

## Per forecaster, onchain cumulative sums (getStats)
* questionsScored, sumBrier: all scored or forfeited non void questions.
* baselineQuestions, sumBaselineBrier, sumSkill: only questions from rounds where the baseline was revealed.
* roundsCommitted, roundsRevealed, roundsForfeited, lastRound.

## Leaderboard ranking (off chain, recomputable from chain data)
* Rank only on skill versus the market, never on raw Brier.
* Score = sumSkill / (baselineQuestions + K) with K = 20 (shrinks small samples toward zero skill).
* To be ranked: at least 5 rounds and 20 baseline scored questions. Show the participation rate (roundsRevealed / roundsCommitted) and the sample size next to every score.
* Why skill and not raw Brier: raw Brier mostly measures how easy the questions were. A question whose answer becomes effectively known before the deadline (news breaks but the market has not resolved yet, an early resolution leak the seal cannot see) gives everyone a low raw Brier, so it inflates raw Brier for whoever happened to forecast that round. The market baseline was set at the same deadline with the same information, so the leak lowers the baseline Brier just as much and skill stays near zero. Skill rewards only information beyond the market price.
* Raw Brier, calibration (10 bin reliability diagram), log score and the Murphy decomposition are shown on profiles as diagnostics, never used for rank.

## Golden vectors (Solidity and JavaScript must agree)
* Reference: scripts/golden_vectors.mjs. Solidity: test_goldenCommitHash, test_goldenScoring_withBaseline, test_goldenScoring_noBaseline in contracts/test/ForecastLedgerFuzz.t.sol.
* Round of 4 questions with outcomes Yes, No, Void, Yes. Forecast [8000, 3000, 9000, 6500], baseline [6000, 5000, 5000, 7000]:
  * reveal with baseline: 3 questions, Brier 25,250,000, baseline Brier 50,000,000, skill 24,750,000;
  * reveal without baseline: 3 questions, Brier 25,250,000, skill 0;
  * forfeit with baseline: 3 questions, Brier 300,000,000, baseline Brier 50,000,000, skill minus 250,000,000.
* Commit hash for chain 56, ledger 0x1111111111111111111111111111111111111111, round 7, forecaster 0xcBa4eE480E307a3fCBCbE6A25E3823595ade61D5, forecast [9000, 2000, 10000], salt keccak256("golden"): 0x343e0813665598bb9ba88edb81220fe30cefbae1b52416242dc72e11c1d192b8.
