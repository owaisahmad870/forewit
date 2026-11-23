# Security status (ForecastLedger v1, pre deploy)

Last updated 23 Nov 2026. Nothing is deployed.

## Test gates
* Ledger v1.1 (23 Nov 2026, per round resolution wait): 74 Solidity tests pass: 53 unit, 5 window guard, 4 resolution wait, 8 fuzz and golden (fuzz at 2000 runs each), 3 BSC mainnet fork, and 1 invariant campaign (4 invariants, 256 runs of depth 64; every run must reach reveal and scoring, checked in afterInvariant; passed on 5 random seeds), 3 BSC mainnet fork tests.
* Coverage of src/ForecastLedger.sol: 100% lines (276/276), statements (390/390), branches (90/90) and functions (38/38). An earlier 94.4% came from one combined constructor test; splitting it into one deployment per test fixed the measurement.
* Solidity and JavaScript parity (JavaScript, not TypeScript; npm run golden asserts 15 values and runs in CI): test_goldenCommitHash, test_goldenScoring_withBaseline and test_goldenScoring_noBaseline match scripts/golden_vectors.mjs (hash, Brier, skill, forfeit). See docs/SCORING.md.
* Fork limits: the RPCs we use keep no archive state, so fork tests run at the latest block. Predict.fun's CTF rejects prepareCondition from outside callers, so the full round uses real open conditions and mocks only the two payout reads at resolution time; real payout reads are covered by test_fork_realResolvedCondition. The fork runs Foundry's own EVM, so it proves interface and state compatibility, not the cancun target. Partial cancun evidence: the runtime bytecode contains PUSH0 (315) and MCOPY (1), and a simulated create on live BSC mainnet (eth_estimateGas and eth_call, 23 Nov 2026) succeeded with 3,599,991 gas and 15,551 bytes of runtime code. Full proof: the testnet deploy. Fork gate: test_fork_fullRound skips when all its hard coded open conditions have resolved; a skip counts as a failed gate on deploy day, so refresh the list first.

## Slither 0.11.6 triage (counted by impact from the JSON report)
* First run, 23 Nov 2026: 1 High (uninitialized-state), 8 Medium (incorrect-equality 1, uninitialized-local 7), 15 Low, 6 Informational. All were false positives or intended, and each was resolved in code:
  * uninitialized-state on _questions: Slither missed writes through a storage reference; createRound now writes _questions[roundId][i] directly.
  * incorrect-equality on AGENT_ID.balanceOf(msg.sender) == 0: intended (any balance above zero passes); suppressed inline with a reason.
  * uninitialized-local: zero defaults now written explicitly.
* Malformed data check proven by mutation: with plain try/catch restored, test_malformedCtfData_emptyAndShort_neverBlockRevealOrVoid fails (the reveal reverts); with _tryDenominator it passes.
* Current run (v1.1): 0 High, 0 Medium, 10 Low (calls-loop 2, timestamp 8), 9 Informational (assembly 1, cyclomatic-complexity 1, naming-convention 7):
* calls-loop (Low, 2): createRound calls view functions on immutable allowlisted CTFs, bounded by 16 questions. _seal and voidStale read payoutDenominator through _tryDenominator, a staticcall that copies at most 32 bytes and treats a revert or return data shorter than 32 bytes as unresolved. Plain try/catch was not enough: Solidity does not catch a decode failure of malformed return data (Owais condition 1). Tests: test_revertingCtf_neverBlocksRevealOrVoid, test_malformedCtfData_emptyAndShort_neverBlockRevealOrVoid (0, 1 and 31 bytes), test_malformedCtfData_oversizedNonzero_readsFirstWord. A caller cannot use a low gas limit to force the failure branch: the call gets 63/64 of the remaining gas, and the 1/64 left could not finish the rest of the transaction, so a starved call makes the whole transaction revert.
* assembly (Informational): _tryDenominator, memory safe, writes only the scratch word at 0x00.
* timestamp (Low, 8): intended. Windows are hours long; BSC blocks are subsecond.
* cyclomatic-complexity (Informational) on createRound: accepted; each branch is a documented input check with its own test.
* naming-convention (Informational, 5): immutables in capitals and the role constants follow OpenZeppelin style.

## Aderyn
* Not run yet. Aderyn 0.6.8 has no Windows build and failed to compile from source here (missing dlltool), and its release has no Linux binary attached (only checksums). .github/workflows/ci.yml builds it from the release tag on Ubuntu and uploads the report; it runs on the first push (Owais condition 7).

## Independent review
* Not done yet (milestone 3, before mainnet).

## Gas (forge gas report, unit test medians, Foundry local EVM)
* Rerun 23 Nov 2026 after the staticcall and profile changes.
* commit: median 100,920, first ever commit is the max (new commit slot plus new stats slot). This is above the spec target of a few tens of thousands; the floor is two new storage slots (about 44k) plus the Agent ID check.
* reveal: median 83,161 (the first reveal of a round also pays the seal, up to 232,368 in the tests; the keeper's baseline reveal normally pays it).
* createRound: 210,582 median (3 questions), 981,719 for 16 (v1.1 stores the resolution wait in one more slot).
* At 0.05 gwei (BSC gas price on 23 Nov 2026) one commit plus one reveal is about 190k gas, about 0.0000095 BNB per user per day.
