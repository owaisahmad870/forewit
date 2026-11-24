DELTA REVIEW REPORT: ForecastLedger v1.2 (setBaseline in clear, pauser moves with admin)

1. SCOPE AND METHOD

* Scope: only the change in DELTA.diff and its interactions: setBaseline (window, once, canonical, access, seal interaction, scoring with and without a baseline), removal of commitBaseline, revealBaseline, the BASELINE identity and ReservedAddress, the _acceptDefaultAdminTransfer override against OpenZeppelin AccessControlDefaultAdminRules, and the changed tests.
* Sources: only the delta packet (DELTA.diff, contracts, THREAT_MODEL.md, FINDINGS_BEING_FIXED.md). Keeper, indexer, site and README are outside the packet and were not read.
* Method: three independent lenses (baseline, admin, regression) each read the code, ran the project tests and wrote their own PoC tests in a private copy of the project. Every finding was then given to a separate verifier with a fresh copy whose job was to refute it; the verifier reran the PoC where one existed.
* This report is a synthesis of those results. I did not rerun forge for it. Duplicates across lenses are merged.
* The accepted residual risks (lazy seal, ordering around the seal, voidStale timing, identity reissue) are not reported again, except where the change touches them (finding 3).

2. STATUS OF M1, L4, L8

M1 baseline withholding: FIXED for the hindsight veto, NOT fixed for liveness. All three lenses agree.
* Hindsight veto closed. setBaseline (src/ForecastLedger.sol 281 to 291) reverts BaselineWindow at or after commitDeadline, and reveals need the deadline to have passed, so the baseline status is final before any reveal or outcome exists. commitBaseline and revealBaseline are gone, so there is no later decision point.
* Evidence: test_baseline_atOrAfterDeadlineReverts, test_missingBaseline_scoresSkillZero, lens tests testFuzz_neverAfterDeadline (2000 runs), test_boundaries, test_shortCommitWindow, test_pauseDoesNotBlockBaseline, all PASS. The window check is written as an addition, so no underflow.
* Variant (b) fixed: a non canonical vector reverts NonCanonical and does not burn the one shot slot (test_baseline_otherReverts).
* Variant (e), keeper downtime: not fixed, and tighter. See finding 1.
* Variants (c) and (d), admin grants itself ROUND_MANAGER or revokes the keeper: still possible as standard role powers, now limited to the 15 minutes before the deadline and blind to forecast contents (test_secondManagerBurnsSlot PASS). Disclosed in THREAT_MODEL item 13.
* "Decided blind" means blind to forecast contents only; the manager still sees who committed and the market.

L4 baseline early or last look: PARTLY FIXED. The lenses disagree on the label.
* Baseline lens: not fixed (partly). Admin lens (code read only) and regression lens: fixed.
* Reconciled position: the early or stale half is closed by the contract, which enforces [commitDeadline minus 15 minutes, commitDeadline) (test_baseline_beforeWindowReverts, test_baseline_set, test_boundaries PASS). The last look half is bounded to at most 15 minutes, not removed, and the baseline is now public before commits close. See finding 2.
* On a deployment with a commit window of 15 minutes or less (test networks only; chain 56 enforces 2 hours) the lower bound is empty.

L8 pauser after admin transfer: FIXED for the completed two step transfer. All three lenses agree.
* The override (lines 518 to 526) reads the previous admin before super, then moves PAUSER_ROLE only if the previous admin held it. The only caller is acceptDefaultAdminTransfer, which requires the pending admin and a passed schedule, so nobody gains PAUSER_ROLE without also becoming admin.
* Evidence: test_adminTransfer_movesPauserRole and test_adminTransfer_leavesOtherPausersAlone PASS; lens tests (10 of 10 in AdminDelta.t.sol, test_transfer_edgeCases, test_probe_transfer_sanity) PASS: cancel and early accept and stranger accept move nothing, new admin already a pauser works, self transfer keeps the role, paused state survives and the new admin can unpause, a pending delay change does not interfere. Cancel, rollback and delay change never reach the override. No external calls, so no reentrancy.
* Not covered by the fix: the renounce path, pausers on other addresses, other roles of the old admin. These were refuted as findings (section 4) and remain documentation suggestions.

3. CONFIRMED NEW FINDINGS

No High. No Medium.

Finding 1. Low (close to Info): a missed 15 minute baseline window is permanent.
* Location: src/ForecastLedger.sol setBaseline 281 to 291; _applyScore useBaseline branch 619 to 640; THREAT_MODEL items 13 and 24.
* What: setBaseline is the only writer of the baseline, valid only in the last 15 minutes before commitDeadline, once, by ROUND_MANAGER. There is no late path, no permissionless path and no admin repair. If the keeper, its RPC, its gas key or the chain fails for those 15 minutes, the round scores skill 0 and baselineQuestions 0 for everyone, for good. Brier is untouched. No attacker is needed.
* Also: the slot is one shot, so a wrong but canonical vector (for example all zeros from a keeper bug) cannot be corrected even inside the window. It shifts every forecaster by the same constant, so it cannot reorder a round.
* Why Low and not Medium: the loss is round wide, neutral, decided before any reveal or outcome, and visible onchain (no BaselineSet event).
* Verifier correction: the old flow also needed a transaction before commitDeadline, so the comparison with a 12 hour outage is overstated. What shrank is the slack for that transaction, from the whole commit window to 15 minutes, which is the cost of the L4 fix.
* PoC: <review workspace>\delta_packet\delta_baseline\test\poc\DeltaBaseline.t.sol (test_missedWindow_isPermanent, test_secondManagerBurnsSlot, test_boundaries) and <review workspace>\delta_packet\delta_regression\test\poc\DeltaRegression.t.sol (test_probe_missedWindow_isPermanent). All PASS, rerun by two verifiers.
* Fix, minimum (no contract change): keeper sends at window open with retries on two RPCs, alert when no BaselineSet by 10 minutes before the deadline, and one line in THREAT_MODEL item 13 saying a missed window is permanent and the outage budget is 15 minutes.
* Fix, optional contract change: let ROUND_MANAGER overwrite the baseline until commitDeadline. It stays before any reveal, so M1 stays closed, and it lets the keeper correct a bad post. It does not help a full 15 minute outage.
* Not recommended: a grace period after commitDeadline. The manager would see early reveals, which partly reopens M1.

Finding 2. Low or Info (verifiers split): last look inside the window, with the baseline now public.
* Location: setBaseline 281 to 291 and commit 307 to 320; THREAT_MODEL items 2 and 13.
* What: commits and overwrites stay open until the deadline, after the baseline is posted in clear. A bot that commits the live market mid just before the deadline earns expected skill equal to the squared price move since the snapshot. No role is needed.
* Severity split: one verifier kept Low (unprivileged, systematic, touches the skill ranking, item 2 uncorrected); the other set Info (strictly smaller than the old L4, nothing made worse). Both agree no contract change is needed.
* Discounted by the verifier: the claim that seeing the baseline makes the edge "selectable" (same expected skill as copying every question) and the zero risk copy padding (nothing onchain uses baselineQuestions or a round count as a threshold; any effect depends on offchain ranking rules outside the packet).
* Documentation: item 2 ("a copied market price scores about zero skill") holds only for a copy at snapshot time; both verifiers agree it overstates. They split on whether item 13 ("removes ... L4") overstates.
* PoC: same two files, test_lastLook_afterPublicBaseline and test_probe_lastLook_insideWindow, PASS (baseline 5000 at window open, commit 8000 one second before the deadline, outcome Yes, sumSkill plus 21,000,000). The 3000 bps move is illustrative; the realistic edge over 5 to 15 minutes was not measured.
* Fix: correct item 2, add the bounded last look to the residual risks, show the baseline post time per round, post as late as the retry budget allows, and make sure offchain thresholds do not reward exact baseline copies.

Finding 3. Info: stale wording, and posting the baseline no longer seals the round.
* Location: src/ForecastLedger.sol line 380 (sealRound NatSpec still lists a "baseline reveal" as a seal trigger), line 96 (Stats comment "revealed baseline"), line 608 (_checkScorable comment ties baseline finality to the reveal deadline; the check itself is correct); THREAT_MODEL header (v1, 65 tests, review pending), items 18 and 20.
* The verifier found three stale source comments, not four.
* Behaviour change behind it: the old revealBaseline called _seal; setBaseline runs before the deadline and cannot seal (test_baseline_set now asserts isSealed false). Residual risk R1 (lazy seal) loses one automatic trigger and now rests on the explicit sealRound call or the first reveal. Slightly worse, not a new issue.
* PoC: DeltaRegression.t.sol test_probe_baselineRound_notSealed_forfeitEscapes PASS (this path is exactly R1).
* Fix: update the three comments and items 18, 20 and the header before the mainnet deploy, because comment edits change the verified source. Confirm the keeper calls sealRound explicitly after the deadline.

Finding 4. Info: the invariant suite never runs paused or with a baseline.
* Location: test/ForecastLedgerInvariant.t.sol Handler.togglePause lines 223 to 227. The file is not in DELTA.diff, so the pause gap is pre existing.
* What: vm.prank(admin) is consumed by the ledger.paused() view call, so pause and unpause are sent by the handler and every call reverts in every run; fail_on_revert is false, so it is silent. The handler also has no setBaseline action. Do not cite the invariant run as evidence about pause or baseline scoring.
* Changed tests: no protection weakened. Removed assertions belong only to removed code. Access, unknown round, canonical, once and both window edges are still asserted. Small gap: no success assertion at commitDeadline minus 1 or at exactly the window start in the project tests (lens tests cover it).
* PoC: <review workspace>\delta_packet\delta_admin\test\poc\AdminDelta.t.sol (PrankConsumedTest.test_prankConsumedByView) PASS.
* Fix: bool p = ledger.paused(); vm.prank(admin); if (p) ledger.unpause(); else ledger.pause(); add a handler action that warps into the window and calls setBaseline; add a success assertion at commitDeadline minus 1. The fix was not applied, so whether the invariants hold once really paused is untested.

4. REFUTED FINDINGS

* Renouncing the admin seat leaves PAUSER_ROLE on the old key (raised by all three lenses): mechanics reproduce, but it is a deliberate operator action, pre existing, outside what L8 promised, and the holder can renounce the role itself. Keep one runbook line: renounce PAUSER_ROLE before renouncing admin, or never renounce.
* Side pauser grants and the old admin's ROUND_MANAGER_ROLE survive the transfer (two lenses): documented design (item 25, with a test), needs admin powers before the handover, recoverable at once with revokeRole. Keep one runbook line: after accepting, list role holders from logs and revoke unknown ones; keep admin and round manager on separate addresses.
* ABI and interface housekeeping (getRound shape, new and removed events and errors, storage layout, local variable named "at" in Base.t.sol): accurate, no security impact, fresh non upgradeable deploy. Keeper, indexer and site ABIs must follow; not checked. The two stale comments listed there are confirmed under finding 3.

5. TEST SUITE RESULT AS REPORTED

* Baseline lens work folder: forge test --no-match-contract Fork, 86 passed, 0 failed (includes its PoC file, 10 of 10).
* Admin lens: 85 of 85 passing excluding the fork file, plus its PoC file 10 of 10.
* Regression lens: states 76 non fork tests in the project.
* These three counts are not reconciled; the differences probably come from PoC files in each work folder.
* Invariants: 4 pass in every run, with the togglePause caveat in finding 4.
* Fork tests: not run by anyone (no RPC allowed).
* Verifiers reran single PoC tests or the invariant file, not the full suite.

6. VERDICT

The delta is safe to deploy given the accepted residual risks, on these conditions:
* No new High or Medium. M1 hindsight veto, the early half of L4 and L8 are fixed with passing tests.
* Before the mainnet deploy: fix the three stale source comments (they change the verified source).
* Before the mainnet deploy: correct THREAT_MODEL item 2 (last look bounded, baseline public), item 13 or 24 (a missed window is permanent, outage budget 15 minutes), items 18 and 20, and the header.
* Operations: keeper posts from window open with retries on two RPCs, alerts on a missing BaselineSet, and calls sealRound explicitly after the deadline.
* If the owner adopts the overwrite until deadline change from finding 1, it needs its own short delta check.
* Open choice for the owner on finding 2: accept and disclose (recommended, no contract change), or also adopt the overwrite change to post later.

Not checked: keeper code (retries, alerts, explicit seal), README, indexer and site ABIs, fork tests, and the realistic size of the last look edge on market data. This synthesis did not rerun forge; all results are as reported by the lenses and verifiers, and the test counts differ between them.