# Security status (ForecastLedger v1.2, pre deploy)

Last updated 23 Nov 2026. Nothing is on mainnet.

## Independent review and v1.2 fixes (23 Nov 2026)
* Independent Fable review (fresh context, packet only, adversarially verified): 0 High, 1 Medium, 8 Low, 17 Info. Report and PoCs: security_review/.
* Fixed in v1.2 (Owais approved fix package 1): M1 and L4 (setBaseline posts the baseline in clear, once, only in the last 15 minutes before the commit deadline; no hindsight veto, no early baseline), L8 (the pauser role moves with the admin seat).
* Mitigated off chain: L1 (archived books, baseline_missing flag, operator wallets never ranked), L2 and L3 (identityChanged flag; burn or reissue asked to the organizers), L7 (keeper never voids while a resolution is pending).
* Accepted residual risks: L5, L6, L7 as R1 to R4 in docs/THREAT_MODEL.md.
* v1.2 gates: 79 Solidity tests (incl. 3 BSC fork), coverage 100% lines, statements, branches, functions; Slither 0 High, 0 Medium; Aderyn in CI; testnet END TO END OK on instance D, and again on instance E after the Forewit rename (labels and comments only); delta review passed (0 High, 0 Medium; safe to deploy given the accepted residual risks R1 to R4 in docs/THREAT_MODEL.md).

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

## Aderyn 0.6.8 triage (CI run 45210857725, 23 Nov 2026; built in GitHub Actions with its pinned nightly-2025-09-20, report kept as a CI artifact)
* Result: 2 High, 10 Low, all triaged; none needs a code change.
* H-1 reentrancy, state change after an external call (createRound, commit, setPublicProfile): false positive. Every call is to a function declared view (getOutcomeSlotCount, payoutDenominator, balanceOf, ownerOf), which Solidity issues as STATICCALL, so the callee cannot change state or reenter in a way that changes it; targets are immutable and allowlisted.
* H-2 unsafe casting (uint32 questions, int64 skill in _applyScore): false positive. questions is at most MAX_QUESTIONS (16); a round's skill is bounded by 16 x 1e8 in absolute value; test_headroom proves a 1e9x margin for the stats widths.
* OpenForecasts (v2, 25 Nov 2026, CI Aderyn 0.6.8 at 8433821): H-1 at commit and finalize (OpenForecasts.sol lines 228 to 232, 289 to 291) is the same false positive: balanceOf, getOutcomeSlotCount, payoutDenominator and payoutNumerators are view functions on the immutable Agent ID and the allowlisted Conditional Tokens, issued as STATICCALL. H-2 at line 338 (int64 skill): a forecast's skill is within plus or minus 1e8, so the int64 sum cannot overflow before about 9e10 forecasts; uint64 sumBrier likewise.
* Slither, all three contracts (25 Nov 2026): 0 High, 0 Medium; 18 Low (16 timestamp: windows and deadlines by design; 2 calls in a loop: v1 batch scoring, bounded by MAX_BATCH).
* L-1 centralization: the documented role design (docs/OWNER_PERMISSIONS.md); nobody can change scores or outcomes.
* L-7 state change without event: test mocks only (MockAgentID, MockConditionalTokens).
* L-8 unchecked return of _grantRole in the constructor: it returns false only when the role is already held, impossible at construction.
* L-2 costly operations in loops, L-6 revert in loop: bounded by 16 questions or 100 batch entries by design. L-3, L-4, L-5, L-9, L-10: style; no behaviour impact.

## Independent review
* Not done yet (milestone 3, before mainnet).

## Gas (forge gas report, unit test medians, Foundry local EVM)
* Rerun 23 Nov 2026 after the staticcall and profile changes.
* commit: median 100,920, first ever commit is the max (new commit slot plus new stats slot). This is above the spec target of a few tens of thousands; the floor is two new storage slots (about 44k) plus the Agent ID check.
* reveal: median 83,161 (the first reveal of a round also pays the seal, up to 232,368 in the tests; the keeper's baseline reveal normally pays it).
* createRound: 210,582 median (3 questions), 981,719 for 16 (v1.1 stores the resolution wait in one more slot).
* At 0.05 gwei (BSC gas price on 23 Nov 2026) one commit plus one reveal is about 190k gas, about 0.0000095 BNB per user per day.

## Operational security checklist (24 Nov 2026; items borrowed from the SEAL frameworks, DarkNavySecurity web3-skills and Plamen checklists, read only, nothing installed)
* Done: GitHub secret scanning with push protection, Dependabot alerts and updates, private vulnerability reporting, rulesets on main and v* tags, actions pinned to commit SHAs, npm releases by trusted publishing with provenance, pre commit scan for .env values, private keys and local paths (worktrees included).
* Done: incident runbook with severity levels, SEAL 911 contact, Safe hash verification, announcement template (docs/INCIDENT.md); keys and incidents page (gitbook/trust/keys_and_incidents.md).
* Done on branch v32-topic-rounds (merges after the round 1 seal): keeper alert on every role, pause, admin seat and root revoke event on both contracts.
* Done: commit hash binds chain id, ledger address, round, forecaster, forecast and salt (DarkNavy transaction ordering item 5).
* Done: admin handover to a Safe rehearsed in a mainnet fork test (contracts/test/AdminHandoverFork.t.sol); Safe 1.4.1 code hash verified on BSC.
* Open, needs Owais: an alert channel (create a "Keeper alerts" issue and set ALERT_ISSUE_NUMBER; today keeper alerts only reach the job log); fund ADMIN with about 0.002 BNB; decrypt check of the admin keystore and its copies; security keys (FIDO2) on GitHub, npm, Cloudflare, Porkbun and X.
* Open, needs Owais (DNS for forewit.xyz, checked 24 Nov 2026): DNSSEC off (enable in Cloudflare, then add the DS record at Porkbun); no CAA record (allow only the authorities Cloudflare uses); registrar transfer lock is on (clientTransferProhibited at Porkbun).
* Open: a GitHub environment for MAINNET_KEEPER_PRIVATE_KEY limited to the main branch (the secret must be set again by Owais inside the environment).
* Open: the 2 of 3 Safe on three separate devices, then the announced admin handover (accept before about 5 Dec 2026).
