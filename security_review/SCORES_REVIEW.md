# ForewitScores independent review

## Scope
* Commit 57e77e469c9ebea0d9c502607a3584540b029f33 (main, HEAD at review time, 24 Nov 2026).
* contracts/src/ForewitScores.sol, contracts/src/examples/ForewitGate.sol, contracts/script/DeployScoresMainnet.s.sol, indexer/scores.mjs. The spec docs/SCORES.md was read only after the findings were formed. ForecastLedger was read only where the scores depend on it (setPublicProfile, _applyScore).

## Method
* Line by line read of the four files, then a parity check of the leaf and tree rules against OpenZeppelin MerkleProof and StandardMerkleTree, then the spec.
* Existing suites rerun: forge test on test/ForewitScores*: 44 passed (unit, fuzz, invariant). The node test runner on indexer/test/scores.test.mjs: 11 passed. Golden roots (1, 2, 3 and 100 leaves, alternating sign skill) and a logs fixture root are asserted with the same constants in Solidity and JavaScript, so negative int256 encoding agrees across languages.
* Slither (counted by impact from its json output; ledger, libs, tests, scripts and mocks filtered): 0 High, 0 Medium, 2 Low timestamp, 8 Informational naming. Matches the spec.
* Throwaway PoCs in contracts/test/review_tmp/ (4 Foundry tests, 1 node script), all behaving as described below, deleted after the review. No fork test run, no onchain transaction, .env not read.

## Confirmed sound
* Leaf: keccak256(bytes.concat(keccak256(abi.encode(uint256, int256, uint256)))), identical to StandardMerkleTree with types uint256, int256, uint256 (ForewitScores.sol:146 to 148, scores.mjs:14 and 92). The 96 byte inner encoding plus the outer hash means no 64 byte internal node can pass as a leaf (fuzz testFuzz_secondPreimage_internalNodeIsNoLeaf).
* Sorted pair hashing via MerkleProof.verifyCalldata matches the library; a single leaf root equals the leaf with an empty proof; an empty tree is never postable (zero root and zero leafCount revert; buildTree returns null).
* Epoch 0 and ids above latest are unknown through the unchecked wrap in _known (ForewitScores.sol:139 to 143); verify and verifyAt return false, getEpoch reverts. verify uses only the latest epoch and fails closed when it is revoked, with no fallback. A stale root cannot be passed off as latest: snapshotBlock is strictly increasing and below block.number.
* No payable function, no receive, no external call after the constructor, no loop over storage. Gas griefing is limited to callers paying for their own proof.
* Roles: the constructor grants DEFAULT_ADMIN_ROLE only to admin (AccessControlDefaultAdminRules, 1 day delay) and ROUND_MANAGER_ROLE only to keeper. The deploy script requires three distinct nonzero addresses, a deployer with no role, an admin without the manager role, and LEDGER and AGENT_ID wired as expected. The LEDGER constant equals the agent/config.mjs mainnet ledger.
* skill and n are recomputable from logs alone: every Scored and Forfeited event carries questions, skillSum and baselineUsed, and ForecastLedger._applyScore adds to baselineQuestions and sumSkill exactly when baselineUsed is true (ForecastLedger.sol:616 to 648). BigInt and Solidity int256 division both truncate toward zero.
* Option B holds in code: a leaf, and any tokenId in the leaves file, exists only for a forecaster whose last ProfileUpdated is public with a nonzero labelId, and the ledger proved ownerOf(labelId) == forecaster in that transaction (ForecastLedger.sol:338 to 350). Excluded entries carry address and reason only. Node PoC: a holder who opted out has no tokenId anywhere in the output.
* Superseded roots: verifyAt on an older unrevoked epoch stays true by design (history), so a consumer that accepts a caller chosen epoch lets holders pick their best old score. The gate uses verify (latest only) and is not affected.
* Operator exclusion compares lowercased addresses on both sides (indexer/lib/flags.mjs:15 to 16, scores.mjs:55 and 57), and LEDGER_EVENTS matches the ForecastLedger event declarations (ForecastLedger.sol:133 to 150).
* The gate binds the leaf to AGENT_ID.ownerOf(tokenId) == msg.sender and accepts only the latest unrevoked root, so another holder's public proof or an old root cannot be used.

## Findings

### L1 (Low): the reissue window is not bounded by one day as T5 claims
* Evidence: ForewitScores.sol:122 to 124, ForewitGate.sol:188 to 192, scores.mjs:74. PoC test_poc_reissueWindow: after "alice" is burned and reminted to another wallet, the old leaf still verifies 10 days later with no new post, and the new owner claims the gate pass with the previous holder's score (MAX_AGE 30 days).
* The leaf binds to tokenId = keccak256(label), so a name reissued by the issuer carries the previous holder's score. The window lasts until the next root that excludes it. Roots follow round settlements, so after the last round (cap 8 Dec) or during a keeper outage the window is open ended for direct verify users; the gate is bounded only by MAX_AGE.
* Second path: the indexer detects a move only through a Transfer log out of the holder. If the real Agent ID changes ownerOf without such a log (expiry style reissue; unverified, R4), the old holder keeps the leaf in every later root too. Node PoC case "noTransfer" shows the leaf persisting. Hypothesis, not checked here: the mainnet Agent ID emits a standard ERC721 Transfer with tokenId indexed on burn and mint (only the mock was exercised).
* Fix options: correct T5 to "until the next root, open ended after the last round; bounded for gates by MAX_AGE"; and, cheap and onchain, have consumers also require ForecastLedger.profileLabelId(msg.sender) == tokenId, or confirm with the organizer that labels are never reissued.

### L2 (Low): the keeper key alone can irreversibly revoke every honest historical epoch
* Evidence: ForewitScores.sol:99 to 108. PoC test_poc_keeperRevokesHistory: the keeper revokes epoch 1, verifyAt on it turns false, and no unrevoke path exists for anyone.
* The keeper is a hot key on GitHub Actions shared with the ledger's round manager. A stolen key can wipe the verifiable history (no funds at risk; current data can be reposted, history cannot). T2 and T6 describe a stolen key posting fake roots but not erasing history.
* Fix options: let the keeper revoke only the latest epoch and leave history revokes to the admin; or state the residual in T2.

### L3 (Low): the keeper self check is not independent of its RPC
* Evidence: scores.mjs:110 to 134, docs/SCORES.md 5.1. Build and recompute run the same code against the same RPC. A provider that silently drops logs in a middle range (seen on the publicnode testnet RPC, 24 Nov 2026) yields a wrong root that the self check confirms. The RoleGranted guard only catches loss of the earliest range.
* Fix: run the post recompute against RPC_MAINNET_FALLBACK (a second provider) and alert on any difference.

### I1 (Info): a gate pass survives a revoke
* Evidence: ForewitGate.sol:193. PoC test_poc_passSurvivesRevoke. passed[tokenId] keeps the epoch of a revoked root and the gate offers no view that checks it. The spec tells consumers to recheck getEpoch(epoch).revoked; an isValid(tokenId) view in the example would show that pattern.

### I2 (Info): MAX_AGE measures postedAt, not data age
* Evidence: ForewitGate.sol:192. PoC test_poc_freshPostOldSnapshot: a root posted now over a snapshotBlock a year old passes MAX_AGE. Needs a malicious or buggy keeper. T3 says consumers check postedAt or snapshotBlock age; the example checks only the former.

### I3 (Info): the deploy role read back runs on the forge simulation
* Evidence: DeployScoresMainnet.s.sol:243 to 251. The require calls after stopBroadcast read the local simulated state, not the mined contract. Read defaultAdmin, hasRole and LEDGER with cast call on chain after the receipt, as was done for the ledger.

### I4 (Info): recompute edge cases
* scores.mjs:176 to 182: ok is true for a revoked epoch (the revoked flag is printed but not part of ok); LEDGER is taken from the scores contract without pinning it to the known mainnet ledger; the accounted check is true by construction of buildLeaves; the file check compares the root only, not leaves and proofs.

### I5 (Info): opt out is not retroactive
* Leaves files of earlier epochs (web/public/data/scores/<epoch>.json) and the ProfileUpdated logs keep the tokenId to wallet pair after a holder opts out. T10 should say so, and the site and MCP should not search old files by name.

### I6 (Info): example gate details
* ForewitGate.sol:177 to 183: no zero address or sanity checks on constructor inputs; when the latest epoch is revoked, claim reverts with BadProof rather than a revoked error.

## Spec match
* Code matches docs/SCORES.md sections 2 to 6 (option B membership, leaf and tree layout, contract surface, gate checks in order). The threat model is honest except T5 (L1) and the omissions in L2 and L3.

Open High: 0, Open Medium: 0
