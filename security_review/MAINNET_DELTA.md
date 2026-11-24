# MAINNET DELTA REVIEW: ForecastLedger build for BSC mainnet

## Scope
* contracts/src/ForecastLedger.sol, contracts/src/interfaces/IAgentID.sol, contracts/src/interfaces/IConditionalTokens.sol, contracts/script/DeployMainnet.s.sol.
* Commit c1b3006d7315d52e8e6f7b94d913b45b46bec03d on main. No file under contracts/ was modified in the working tree at review time.
* Focus: loss or corruption of scores, copying or changing a forecast after seeing others, liveness of reveal and scoring, role setup at deploy, chain 56 assumptions, deploy script guards.
* Out of scope: keeper, agent, MCP, indexer and web code.

## Method
* Full manual read of the contract, both interfaces and the mainnet deploy script before opening any earlier report.
* forge test from contracts/ with only BSC_RPC_URL exported: 78 passed, 0 failed, 1 skipped (79 total). The skipped test is ForecastLedgerFork test_fork_fullRound, which skips because its hardcoded unresolved mainnet conditions have all resolved since.
* Two PoC tests written in contracts/test/review_tmp/MainnetDelta.t.sol, run, then the folder was deleted (both PASS, listed under the findings).
* Slither on src/ForecastLedger.sol (lib and mocks filtered), counted by impact from the JSON output: High 0, Medium 0, Low 10 (timestamp 8, calls in loop 2), Informational 9 (naming 7, assembly 1, complexity 1). All Low items are the intended deadline checks and the bounded view calls to allowlisted CTFs in createRound and _seal.
* Afterwards compared with security_review/REPORT.md, security_review/DELTA_REPORT.md and docs/THREAT_MODEL.md.
* No transaction was sent and nothing was broadcast.

## What holds (checked, no finding)
* Copying and changing forecasts: the commit hash binds chain id, ledger address, round, forecaster, vector and salt (ForecastLedger.sol:456 to 462). A copied hash cannot be revealed by the copier, revealFor can only replay the exact reveal, and commits are closed at the deadline (line 309) before any reveal opens (line 542).
* Selective reveal: a forfeit scores MAX_BRIER on every non void question (line 627), which is never better than any reveal, and anyone can call forfeit once the round is resolved.
* Score integrity: no function edits commits, reveals, outcomes or stats; per round sums are bounded by 16 times 1e8, far inside uint64 and int64 (lines 633 to 640); mask arithmetic is correct for 16 questions (line 611).
* Liveness: pause gates only createRound and commit (lines 246, 307); reveal, seal, finalize, voidStale, score and forfeit ignore pause. _seal and voidStale use a length checked staticcall (lines 591 to 598), so a reverting or malformed CTF cannot block reveals or voiding. Batches are capped at 100 and loops at 16 questions, well inside the BSC block gas limit.
* Roles in the contract: the constructor grants DEFAULT_ADMIN and PAUSER only to admin and ROUND_MANAGER only to roundManager (lines 202, 230, 231); msg.sender receives nothing. OpenZeppelin rejects a zero admin; the contract rejects a zero manager. The pauser moves with a completed admin transfer (lines 519 to 526).
* Chain 56: all timing uses block.timestamp in seconds, never block numbers, so subsecond BSC blocks do not matter; the constructor enforces at least 2 h commit and 12 h reveal windows when block.chainid is 56 (lines 207 to 210); the cancun bytecode already ran on BSC testnet per notes. The interfaces match the three functions read from Gnosis style CTFs, and createRound requires exactly 2 slots and an unresolved condition (lines 265, 266).
* Deploy script: hard fails off chain 56 and below 2 h and 12 h before reading any key (DeployMainnet.s.sol:18 to 28); addresses are constants; the constructor checks that the Agent ID and every CTF have code and that the CTF list has no duplicates.

## Findings

### L1. Low: the deploy script lets the deployer end with every role, and lets admin equal round manager
* Location: contracts/script/DeployMainnet.s.sol:25 to 36.
* What: run() reads MAINNET_ADMIN and MAINNET_ROUND_MANAGER from env with no check against vm.addr(key) or against each other, and makes no assertion after deploying. A wrong or copied env value (for example the deployer address pasted into MAINNET_ADMIN) deploys a ledger whose deployer holds DEFAULT_ADMIN, PAUSER and ROUND_MANAGER. That breaks the stated requirement that the deployer ends with no roles, and a single hot key would then control pause, round creation and the baseline. Admin equal to manager is the same gap REPORT.md already flagged (its fix "require admin != manager in DeployMainnet.validate") and it is still not applied.
* Evidence: PoC test_poc_deployerCanEndAsAdminAndManager (chain id 56, etched code at the four constant addresses, MAINNET_ADMIN and MAINNET_ROUND_MANAGER set to the deployer): PASS, with defaultAdmin() equal to the deployer and hasRole true for ROUND_MANAGER_ROLE and PAUSER_ROLE.
* Fix (script only, no contract change, so the verified source is unchanged): in run(), compute address deployer = vm.addr(key) and require admin != deployer, manager != deployer and admin != manager; optionally refuse the known testnet deployer and keeper addresses from notes/knowledge.md; after the deploy, require !hasRole(DEFAULT_ADMIN_ROLE, deployer), !hasRole(PAUSER_ROLE, deployer), !hasRole(ROUND_MANAGER_ROLE, deployer), defaultAdmin() == admin and hasRole(ROUND_MANAGER_ROLE, manager). Add a test for each require.

### L2. Low (accepted risk R2, still present): the first sealer decides for questions that resolve after the deadline
* Location: ForecastLedger.sol finalizeQuestion 364 to 372, sealRound 381 to 385, _seal 569 to 586.
* What: until the round is sealed, any question that resolves onchain after the commit deadline is voided by the seal. Any address can seal, so a forecaster who sees a question resolve against them before anyone has sealed or revealed can void it for everyone. The effect is round wide, not targeted, and closes as soon as anyone seals.
* Evidence: PoC test_poc_lateSealVoidsPostDeadlineResolution (q0 resolves Yes one hour after the deadline, bob who forecast 10 percent calls sealRound, q0 becomes Void): PASS.
* Status: matches THREAT_MODEL residual risk R2, which describes it correctly. THREAT_MODEL item 18 still calls the same effect "neutral for everyone", which contradicts R2 and this PoC (see I1). Mitigation stays operational: the keeper seals within seconds of the deadline and the watchdog alerts on a missing seal; selection avoids markets that resolve right after the deadline.

### I1. Info: threat model wording out of date
* docs/THREAT_MODEL.md line 37 (item 18) says a post deadline, pre seal resolution is voided "neutral for everyone"; R2 at line 52 says it is a selective void. Align item 18 with R2.
* The header (line 3) still says 65 tests and "independent review pending"; the suite now has 79 tests.
* Earlier DELTA_REPORT finding 3 (stale source comments at lines 96, 380, 608) is fixed in the current source, and THREAT_MODEL item 2 now describes the bounded last look.

### I2. Info: no live chain 56 end to end evidence in this run
* test_fork_fullRound skipped because every hardcoded candidate condition has resolved. test_fork_agentIdFacts and test_fork_realResolvedCondition passed, so the Agent ID reads and a resolved CTF read work against chain 56 state, but a full round over currently open mainnet conditions was not exercised. Refresh the candidate list and rerun before the deploy.

### I3. Info: finalizeQuestion trusts payoutNumerators
* Location: ForecastLedger.sol:373. If an allowlisted CTF reported a nonzero denominator while payoutNumerators reverted, that question could neither be finalized nor voided (voidStale reverts AlreadyResolved), and the round could never be scored. For the Gnosis code and the slot count check at createRound this cannot happen, and the CTFs have no EIP1967 slot, so this is a trust assumption on immutable allowlisted contracts, not a defect.

### I4. Info: Agent ID is a trusted external input
* commit only checks AGENT_ID.balanceOf > 0 (line 312). Notes record the contract as non transferable and not a standard proxy, but with an owner holding unidentified admin functions; burn or reissue would allow two addresses per person (THREAT_MODEL R4, open organizer question). Unchanged from earlier reviews.

### I5. Info: earlier informational items still present by design
* Stats.lastRound is the first committed round id, not the highest (REPORT I12), line 316.
* A missed 15 minute baseline window is permanent and scores skill 0 for the round (DELTA_REPORT finding 1), lines 281 to 291; documented in THREAT_MODEL item 24.

## Verdict
* Contract: no new High or Medium. The deploy script needs the L1 guard before the mainnet broadcast, which does not touch the verified contract source.

Open High: 0, Open Medium: 0
