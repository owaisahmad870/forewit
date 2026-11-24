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

## Delta review 24 Nov 2026 (40a8373)

### Scope and method
* Diff 57e77e4 to 40a8373 on contracts/src, docs/SCORES.md and contracts/test/ForewitScores.t.sol: revokeRoot role rule (keeper limited to the newest two epochs, KeeperRevokeTooOld) and the ForewitGate opt in check (LEDGER.profileLabelId(msg.sender) == tokenId). Read together with the rest of ForewitScores.sol, ForewitGate.sol, ForecastLedger.setPublicProfile and indexer/scores.mjs buildLeaves. The L1 and L2 text above was read only after the view below was formed.
* forge test from contracts/ with BSC_RPC_URL set to the primary mainnet RPC: 126 passed, 0 failed, 13 suites (fork suites included).
* Throwaway PoCs in contracts/test/review_tmp/ (7 tests, one fuzz at 2,000 runs), all passed as described below, deleted after.
* Read only chain checks: profileLabelId(address) answers on the mainnet ledger 0xd11e...09B6 (returns 0 for an unused address), so the gate wiring works against the deployed bytecode. Agent ID block 135270306 has a Transfer from zero to 0x4Db4...282C with the tokenId indexed (mint log confirmed). No transaction sent, .env not printed.
* Slither 0.11.6 on each contract, counted by impact from --json. Raw: 1 High and 9 Medium, all in OpenZeppelin Math.sol (mulDiv, invMod), not reachable from our code. In scope (src only, deduplicated across both runs): 0 High, 0 Medium, 3 Low timestamp, 9 Informational naming. The new Low on revokeRoot line 105 (epoch + 1 < _epochs.length) is a false positive: no timestamp is involved. The runner printed exit 127 but both json files are fresh and cite the new line 105.

### L2 status: fixed as designed
* The check `!isAdmin && epoch + 1 < _epochs.length` lets the keeper revoke exactly epochs length minus 1 and length; no off by one. Fuzz testFuzz_keeperNeverBelowLenMinusOne (length 1 to 40, any epoch) agrees.
* Sequences do not widen it: test_stolenKeeperBound posts 10 honest roots, the keeper revokes 10 and 9, then ten rounds of post junk and revoke junk; epochs 1 to 8 stay unrevoked and every keeper revoke of them reverts. Worst case for a stolen keeper key: the two newest honest epochs are lost to verifyAt for good, plus the usual fake or blocked latest root until the admin acts.
* The admin path is unchanged and unrestricted. Epoch 0 and unknown ids still revert UnknownEpoch before the new check, so `epoch + 1` cannot overflow.
* Correction flow (section 5) works when the keeper revokes right after posting the corrected root (bad epoch = length minus 1). test_correctionAfterInterveningPost: if any other post lands first (a later round, a second correction), the keeper gets KeeperRevokeTooOld and only the admin can revoke.

### L1 status: narrowed, not closed (stays Low, documented residual)
* claim now needs ownerOf(tokenId) == msg.sender and profileLabelId(msg.sender) == tokenId. test_reissue: after "alice" is burned and reminted to dave, alice gets NotHolder, dave gets NotOptedIn, and after one setPublicProfile(true, "alice") by dave the claim passes on alice's stale leaf. T5 states this residual.
* That opt in emits ProfileUpdated for dave, and buildLeaves binds the label to the latest binder over every wallet (scored or not), so the next root drops alice's leaf. The gate window is therefore bounded by the next root after the new owner's opt in, and by MAX_AGE.
* No new blocking: profileLabelId is keyed by msg.sender and only its owner can set it; setPublicProfile checks ownerOf, so nobody else can bind or clear a holder's name (test_holderNotBlockable). Every leaf holder had profileLabelId == tokenId at the snapshot, so legitimate claims still pass. A holder who later opts out or sets a public profile with no label is refused (test_privateWithLabelClears); that matches option B, since the next root drops them too.
* No non holder can pass: the ownerOf check is unchanged and comes first. tokenId 0 would match an unset profile, but ownerOf(0) needs a label hashing to zero, so it is unreachable.
* External call: LEDGER is immutable, read from SCORES.LEDGER() at deploy, and profileLabelId, ownerOf, verify, latestEpoch and getEpoch are all declared view, so claim makes only static calls before its single write. No reentrancy surface.

### D1 (Info): T5 cites the wrong log as evidence
* docs/SCORES.md T5 says the mint Transfer from zero lets the indexer see a reissue and drop the old leaf. indexer/scores.mjs:74 only marks a forecaster moved on a Transfer whose from is that forecaster, or when another wallet rebound the label later. A mint log to a new owner matches neither. Detection rests on the burn emitting Transfer(old holder, zero), which is still unverified on mainnet (R4), or on the new owner opting in.
* If a reissue happens without a burn log and the new owner never opts in, the old leaf stays in every later root. The gate is safe in that case (old holder fails ownerOf, new owner fails NotOptedIn), but a direct verify consumer that checks only ownerOf is not.
* Fix: in buildLeaves treat any Transfer of that tokenId after the opt in as moved (drop the from filter), and reword T5 to rest on that rule.

### D2 (Info): docs not fully updated for the new rules
* Sections 5 and 5.1 still say the keeper revokes the bad epoch; add that this needs the admin once another post has landed after the corrected root, so the keeper should revoke immediately after the corrected post.
* T6 says the admin or the new keeper repairs a lost key's revokes by posting a fresh root. That restores the latest root only: the two revoked epochs never verify again under verifyAt, and postRoot is keeper only (the admin must first grant itself or a new key ROUND_MANAGER_ROLE).
* Section 6 immutables omit LEDGER. Section 9 still says "keeper or admin revokes", 44 Foundry tests and Slither 2 Low and 8 Informational. The claim gas figure in section 8 (68,815) predates the extra static call.
* The commit rewrote docs/SCORES.md from CRLF to LF, so a 12 line change shows as a 332 line diff; review with --ignore-cr-at-eol.

### Unchanged
* I1 to I6 above are not addressed by this commit and stay open as Informational. L3 is a keeper process change in docs/SCORES.md 5.1 (two providers); not code, not reviewed here.

Delta: Open High: 0, Open Medium: 0
