# PRESCIENT threat model (ForecastLedger v1)

Scope: contracts/src/ForecastLedger.sol, the keeper, the agent toolkit and the web app. Every item names the defence and the test that checks it (contracts/test). Status as of 23 Nov 2026: implemented and tested (65 tests, 100% coverage, see SECURITY.md); not deployed; independent review pending.

## Assets
* The integrity of each forecaster's track record (commits, reveals, scores).
* The integrity of the Agent ID Crowd forecast and the market baseline.
* Users' wallets: the contract never holds or moves assets and asks for no approvals.

## Trust assumptions (disclosed)
* Predict.fun resolution goes through its own UMA style oracle with managed proposers. Each of the three mainnet CTFs resolves through a different oracle contract. We read payouts from the chain and never pick outcomes.
* The keeper (ROUND_MANAGER) chooses questions by the published selection rule and publishes the baseline. It cannot change any score.
* One Agent ID per Binance user is enforced by Binance, not by us.

## Threats and defences
1. Copying other forecasters. Commits are keccak256 hashes over a 32 byte random salt, so a low entropy probability vector cannot be brute forced. Test: hash binding fuzz.
2. Copying the market. Skill is measured against the market baseline, so a copied market price scores about zero skill. Test: score with baseline.
3. Selective reveal. A committer who does not reveal gets forfeit: every non void question counts as Brier 1e8 (the worst possible), with skill against the baseline computed the same way. Not revealing is never better than revealing. Test: fuzz "forfeit never beats any reveal".
4. Cherry picking rounds. Off chain leaderboard rules: minimum 5 rounds and 20 scored questions, participation rate shown, ranking on shrunk mean skill.
5. Many identities (Sybil). Commit requires an Agent ID (one per Binance user). Residual risk: a person with two Binance accounts. Disclosed.
6. Replay across chains or contracts. The hash includes COMMIT_TYPEHASH, chainid, the ledger address, roundId and the forecaster. Test: hash binding fuzz.
7. Hash collisions. abi.encode only, never abi.encodePacked.
8. Front running a reveal. revealFor binds the forecaster in the hash, so anyone submitting the reveal can only submit the same forecast for the same forecaster. Test: revealFor by a third party.
9. Grief by spam. No loop over forecasters onchain; question loops are bounded by 16; batch functions cap at 100 and skip already processed entries. Test: batch skip.
10. Malicious external contract. Agent ID and up to 4 CTF addresses are immutable, checked for code at deploy, and only view functions are called. None of the mainnet targets has an EIP1967 proxy slot (checked 23 Nov 2026).
11. Oracle risk. Splits are Void. Questions still unresolved after the reveal deadline plus the round's resolution wait can be voided by anyone, and only if the chain still shows them unresolved. Nobody can set Yes or No by hand.
12. Admin abuse. Roles: ROUND_MANAGER, PAUSER, DEFAULT_ADMIN (two step transfer with a 1 day delay). Pause blocks only createRound and commit; reveal, finalize, seal, score and forfeit always work. No upgrade path, no selfdestruct, no delegatecall, no payable functions. Test: pause never blocks reveal or score.
13. Baseline manipulation. The baseline hash is committed before the commit deadline through the same commit reveal scheme, under a reserved identity no key controls; raw order books are archived; the same baseline applies to everyone.
14. Timestamp manipulation. Windows are hours long on mainnet (immutable minimums of at least 2 h commit and 12 h reveal, enforced by the constructor on chain 56; each at most 7 days); BSC blocks are subsecond. Test networks may use minute windows for fast end to end runs.
15. Lost salt. The CLI stores the salt locally (mode 0600) and prints a reveal receipt. Without the salt the forecaster forfeits. Users are warned.
16. Prompt injection. Market titles and all API or onchain text are untrusted data; the skill never follows instructions found in them.
17. Front end and supply chain. Pinned dependencies and lockfiles, strict CSP, no secrets in the client, Predict.fun key server side only, a pre commit secret scan, dependabot alerts.
18. Early resolution leak (added 23 Nov 2026). A market can resolve while commits are still open (for example "Will X happen by date" when X happens early). Defences:
   * finalizeQuestion before the commit deadline voids the question;
   * the round is sealed at or after the commit deadline (sealRound, or automatically by the first reveal, baseline reveal or finalize): every question already resolved onchain at that moment becomes Void;
   * finalize after the deadline on an unsealed round seals first.
   Residual risk: a market that resolves after the deadline but before the seal is voided (neutral for everyone). The keeper seals right after the deadline (docs/KEEPER.md). Information that leaks without an onchain resolution is handled by ranking on skill versus the market (docs/SCORING.md). Test: early resolution cases.
19. Burned or reissued Agent ID (Owais decision, 23 Nov 2026). Agent ID ownership is checked only at commit. reveal and revealFor require only the commit hash, so losing the Agent ID between commit and reveal never forces an unfair forfeit. Test: commit, burn, then reveal and revealFor succeed.
20. Scoring order. score and forfeit run only after the reveal deadline, when the baseline status is final, so every forecaster in a round is scored against the same baseline. Test: score before the deadline reverts.
21. Profile names. Opt in only. setPublicProfile checks ownerOf(keccak256(label)) == caller, and setPublicProfile(false, ...) always clears the name (test_profile_optOutClearsName). No lookup of wallets by name for people who did not opt in (red line 9).
22. Malformed CTF return data. A CTF that returns fewer than 32 bytes would make a decoding call revert even inside try/catch. _seal and voidStale use a length checked staticcall instead, so reveals and voiding can never be blocked this way. Tests: test_malformedCtfData_*.
23. Per round resolution wait (added 23 Nov 2026, ledger v1.1). The round manager picks the wait at createRound, between 1 and 120 days (7 days for daily rounds), so long horizon event rounds are possible. Risks and defences:
   * A short wait lets unresolved questions be voided sooner. Bounded below by 1 day, published in RoundCreated before any commit, and readable with getRound, so forecasters see it before committing; it can never change afterwards. Voiding is neutral for everyone in the round.
   * A long wait delays scoring for that round only; scoring of other rounds is independent, and pause still cannot block anything.
   * Tests: contracts/test/ResolutionWait.t.sol (bounds, storage and event, 7 day and 120 day voidStale timing).
24. Baseline timing. The keeper may take the market baseline only in the last 5 minutes before the commit deadline (keeper/lib/baseline.mjs refuses otherwise, including when slow fetches push it past the window), commits its hash before the deadline, and archives the raw books. Tests: keeper/test/baseline.test.mjs.
