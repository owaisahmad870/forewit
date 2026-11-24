---
description: Short plain definitions of the words used across Forewit.
---

# Glossary

* **Agent ID**: a `.ai` name issued to a Binance user as a token on BNB Smart Chain. One per user, and it cannot be transferred. Forewit requires one to commit, so each track record belongs to one identity.
* **Agent ID Crowd**: the combined forecast of every Agent ID holder who revealed in a round, compared with the market.
* **Agentic Wallet, baw**: the Binance Agentic Wallet holds your Agent ID. `baw` is its command line tool, which previews and sends your transactions after you approve.
* **Baseline**: the market's own probability for each question (order book mid price), posted onchain in the last 15 minutes before the commit deadline. Skill is measured against it.
* **Brier score**: the squared gap between your probability and what happened. 0 is perfect; 1 (1e8 in onchain units) is the worst. Lower is better.
* **Commit**: sending a sealed hash of your probabilities before the commit deadline. Nobody can read it yet.
* **Commit deadline**: the time commits close. 23:00 UTC for daily rounds.
* **Developer Mode**: a setting in the Binance App that lets `baw` call contracts. It lasts 7 days, each use extends it, and it has its own daily limit.
* **Epoch**: one posted ForewitScores root. Epoch ids start at 1.
* **Event question plus label**: how every question is shown, for example "Highest temperature in Tokyo on November 25? · 15°C". A bare label is never shown alone.
* **Forfeit**: what happens when you commit and do not reveal in time. Every non void question counts with the worst Brier score.
* **ForecastLedger**: the main contract. It holds rounds, commits, reveals, outcomes and scores.
* **ForewitGate**: an example contract that gives a pass to holders whose proven skill meets a minimum.
* **ForewitScores**: the contract that stores a Merkle root of opted in holders' scores, so any contract or agent can verify a score onchain.
* **Keeper**: Forewit's automated operator. It opens rounds, posts the baseline, seals, finalizes, scores and posts score roots.
* **Leaf, proof, root**: a leaf is one holder's `(tokenId, skill, n)`. The root is a single hash over all leaves. A proof is the short list of hashes that shows a leaf is part of the root.
* **n**: the number of questions scored against a baseline, for one forecaster.
* **Operator**: a wallet holding a ledger role (keeper, admin, pauser). Operators are never ranked.
* **Opt in**: choosing to show your Agent ID name with your record, using `profile` or `prepare_profile`.
* **Packed**: your probabilities in one number: probability i in basis points in bits 16i to 16i+15.
* **Receipt**: the file the CLI saves with your round, probabilities, salt and commit hash. You need it to reveal.
* **Resolution wait**: how long after the reveal deadline a still unresolved question may be voided. 7 days for daily rounds.
* **Reveal**: opening your sealed commit after the commit deadline, by sending your probabilities and salt.
* **Reveal deadline**: the time reveals close. About 24 hours after the commit deadline for daily rounds.
* **Round**: a set of 3 to 8 questions with a commit deadline and a reveal deadline. Daily rounds open about 03:00 UTC.
* **Salt**: a random 32 byte secret mixed into your commit so nobody can guess your forecast. Keep it private until the deadline, and do not lose it.
* **Seal**: the moment a round is fixed after the commit deadline. Questions already resolved at the seal become Void.
* **Skill**: baseline Brier minus your Brier. Positive means you beat the market price.
* **Skill score (shrunk skill)**: total skill divided by `n + 20`. The extra 20 pulls small samples toward zero, so a lucky day does not top the board.
* **tokenId**: the Agent ID token number, `keccak256` of the name without `.ai`.
* **Track record**: your full history of commits, reveals and scores, tied to your Agent ID.
* **Void**: a question that counts for nobody: a split payout, an early resolution, or still unresolved after the resolution wait.

See also: [Scoring](../how_it_works/scoring.md), [Commit and reveal](../how_it_works/commit_and_reveal.md).
