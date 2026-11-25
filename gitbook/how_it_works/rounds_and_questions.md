---
description: How a daily round runs, and the fixed rule that picks its questions.
---

# Daily rounds and question selection

## The timetable

* About 03:00 UTC: the keeper opens a daily round and picks its questions.
* Until 23:00 UTC the same day: you commit. A new commit before then replaces your old one. The market baseline is posted in the last 15 minutes.
* The next 24 hours: the reveal window.
* Questions resolve on Predict.fun within 72 hours of the commit deadline, and the round is scored once the reveal deadline has passed and all have resolved.
* A question still unresolved 7 days after the reveal deadline (120 days for long horizon rounds) can be set to Void by anyone.
* On mainnet the contract enforces a commit window of at least 2 hours and a reveal window of at least 12 hours, each at most 7 days ([ForecastLedger.sol](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol)).

## Where questions come from

Every question is a binary market on [Predict.fun](https://predict.fun), identified onchain by its conditionId on an allowlisted Conditional Tokens contract. The outcome comes from the chain, never from a website. A question is always shown as its event question plus label, for example `Highest temperature in Tokyo on November 25? · 15°C`.

## The selection rule (v3.1)

A fixed, pre registered rule that anyone can rerun from the archived data ([docs/QUESTION_SELECTION.md](https://github.com/owaisahmad870/forewit/blob/main/docs/QUESTION_SELECTION.md)).

Every question must:

* Have exactly two outcomes (Yes or Up, No or Down) and be unresolved.
* Sit on a Conditional Tokens contract in the ledger's allowlist.
* Not be sports or esports.
* Not be politics (Elections, Trump, or Politics tags), except macro and central bank markets tagged Economy or Fed.
* If it is not a daily crypto market: have a two sided order book, a spread of at most 10 points, and at least 100 USD of volume in 24 hours.
* Be the only market from its event in the round.

By round type:

* Daily rounds: every daily crypto Up or Down market (Bitcoin, Ethereum, BNB) plus liquid event markets, each ending 6 to 72 hours after the commit deadline and no later than 8 Dec 2026; 3 to 8 questions.
* Long horizon rounds: liquid event markets tagged macro, crypto and finance, tech and AI, or science and weather, each ending 72 hours to 100 days after the commit deadline; 3 to 8 questions.

Rules are versioned and announced before the next round. A round never changes its rules after it opens. A question that resolves before the round is sealed, or pays out split, is Void and skipped for everyone.

Read next: [Commit and reveal](commit_and_reveal.md).
