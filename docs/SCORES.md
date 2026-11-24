# ForewitScores spec (v1)

**Summary (read first):**
* ForewitScores is a small separate contract: no funds, not upgradeable, AccessControlDefaultAdminRules like ForecastLedger. ForecastLedger stays untouched.
* After a round is settled the keeper posts one Merkle root over every eligible Agent ID's score. Anyone calls verify(tokenId, skill, n, proof) to check a score onchain.
* skill is the leaderboard score made exact for integers: sumSkill / (baselineQuestions + 20), truncated toward zero, in bps squared per question. n is baselineQuestions. Both come from ForecastLedger events only.
* Every root is recomputable from BSC logs alone (no archive state needed). The indexer publishes the leaves; a script rebuilds them from chain logs and checks the onchain root.
* Roots are append only. A wrong root is replaced by a newer corrected entry, then revoked; nothing is overwritten.
* Status 24 Nov 2026: built and tested, not deployed. Membership is option B (decided 24 Nov 2026 by Owais): only holders who opted in with a public label get a leaf. Code: contracts/src/ForewitScores.sol, contracts/src/examples/ForewitGate.sol, contracts/script/DeployScoresMainnet.s.sol and DeployScoresTestnet.s.sol, indexer/scores.mjs (build and recompute), tests in contracts/test/ForewitScores*.t.sol and indexer/test/scores.test.mjs.
* Spec changes made while building are marked CHANGE 24 Nov 2026 below.

## 1. What a score is

### 1.1 Source (verified in code, 24 Nov 2026)
* indexer/lib/crowd.mjs: shrunkSkill(rec) = Number(rec.sumSkill) / (Number(rec.baselineQuestions) + SHRINK_K), SHRINK_K = 20. Unit: bps squared per question (docs/SCORING.md).
* ForecastLedger._applyScore adds to Stats only when the round's baseline was set: baselineQuestions += questions, sumSkill += skill. The same numbers are in every Scored and Forfeited event (questions, skillSum, baselineUsed).
* So the score is derivable from onchain data alone. The one part that is not reproducible bit for bit is the JavaScript float division. The web app also shows a third variant (web/src/lib/data.ts divides by 1e8 to get Brier units). Neither is used here.

### 1.2 Minimal fix: integer score (the onchain definition)
* n = baselineQuestions = sum of `questions` over the forecaster's Scored and Forfeited events with baselineUsed true.
* sumSkill = sum of `skillSum` over the same events (int256).
* skill = sumSkill / (n + 20), integer division truncated toward zero. Solidity signed division and JavaScript BigInt division both truncate toward zero, so they agree.
* Unit: bps squared per question (1 unit = 1 / 1e8 of Brier). Range: minus 1e8 to plus 1e8, because the skill of one question is bounded by plus or minus 1e8.
* Positive skill means the forecaster beat the market price on average, after shrinking small samples toward zero. Forfeits count (SCORING.md).
* Truncation changes the float score by less than 1 unit (1 / 1e8 of Brier); ranking order on the site is unaffected in practice. The site keeps its own display; the onchain value is this integer.
* Golden vectors (from SCORING.md):
  * reveal with baseline: sumSkill 24,750,000, n 3: skill = 24,750,000 / 23 = 1,076,086.
  * forfeit with baseline: sumSkill minus 250,000,000, n 3: skill = minus 10,869,565.
  * no baseline rounds only: sumSkill 0, n 0: skill 0.
  * truncation: sumSkill minus 1, n 0: skill 0 (not minus 1).
* Ranking eligibility on the site also needs 5 rounds. The leaf carries only skill and n (the requested verify signature). A consumer that needs rounds reads ForecastLedger.getStats(holder) live.

## 2. Who gets a leaf

### 2.1 Snapshot
* Every root has a snapshotBlock. Leaves are built only from logs with blockNumber at or below snapshotBlock.
* The keeper uses the latest finalized block (BSC fast finality) at build time, so no reorg can change a posted snapshot. Verified 24 Nov 2026 on bsc-rpc.publicnode.com (mainnet): the "finalized" tag answers, 2 blocks behind head. Unverified on the keyed RPCs; indexer/scores.mjs falls back to head minus 15 blocks when the tag fails.
* Score and forfeit are permissionless and per forecaster, so "the round is scored" is not one chain state. The snapshot block, not the round, defines the data. roundId is recorded only as the reason for the post.
* No historical state calls (getStats or ownerOf at a past block): our RPCs keep no archive state (CLAUDE.md, Rejected). Logs only.

### 2.2 Membership (option B, decided 24 Nov 2026 by Owais)
A forecaster address gets a leaf when all hold at snapshotBlock:
* at least one Scored or Forfeited event on the ForecastLedger;
* not an operator: holds no ForecastLedger role per RoleGranted and RoleRevoked events (same rule as the leaderboard, review L1); the log scan starts at the ledger deploy block so the constructor grants are seen;
* its last ProfileUpdated event has isPublic true and labelId nonzero;
* the token labelId has no Transfer out of the address after that ProfileUpdated (ordered by block, then log index).
Excluded forecasters are listed in the leaves file with a reason: operator, not_public, moved. The excluded list carries the address and the reason only, never a tokenId or labelId. Scored forecasters always equal leaves plus excluded.
* CHANGE 24 Nov 2026: two forecasters bound to one tokenId (reachable on testnet, where the mock burns and remints without events). The forecaster with the later ProfileUpdated keeps the leaf, because the ledger proved ownerOf for it more recently; the other is excluded as moved. Deterministic from logs, so the recompute agrees. buildTree still refuses a repeated tokenId as a last guard.

### 2.3 tokenId to holder
* Agent ID tokenId = uint256(keccak256(bytes(label))), label without ".ai" (notes/knowledge.md, verified on 4 of 4 holders). Agent ID is not enumerable, so the mapping comes from logs.
* The ledger only lets a wallet commit with Agent ID balanceOf above zero, so every scored forecaster held a token when it committed.
* Rule: tokenId = labelId of the forecaster's last ProfileUpdated event. The ledger checked ownerOf(labelId) == forecaster in that same transaction, so the binding is proven onchain at that block. Moves after it: Agent ID Transfer logs filtered by that tokenId (indexed topic) up to snapshotBlock. This works on testnet too (the mock emits no Transfer, so a mock burn is not seen; testnet only).
* Option A (every scored holder, mint log scan) was not chosen: privacy (T10), an unverified mint event, and no testnet path.
* One token per wallet is the issuer's rule (one claim per user).
* Agent ID transfers and approve revert (simulation evidence). Burn or reissue by the issuer is unverified (THREAT_MODEL R4, organizer question); the mock allows burn. A token that moved gets no leaf from the next root on.
* The leaf has no address and no label. Binding to the current holder is the consumer's job: AGENT_ID.ownerOf(tokenId) == msg.sender (section 6).

## 3. Leaf and tree encoding
* Leaf values: (uint256 tokenId, int256 skill, uint256 n).
* Leaf hash: keccak256(bytes.concat(keccak256(abi.encode(tokenId, skill, n)))). Double hashing plus a 96 byte inner encoding means no leaf can be confused with a 64 byte internal node (second preimage defence).
* Tree: exactly the OpenZeppelin StandardMerkleTree layout (@openzeppelin/merkle-tree, StandardMerkleTree.of(values, ["uint256", "int256", "uint256"]) with default sortLeaves true). Internal nodes hash the sorted pair (commutative keccak), as OpenZeppelin MerkleProof.verifyCalldata expects (OpenZeppelin contracts 5.7.0 is already in contracts/lib).
* Consequences of that layout:
  * the root depends only on the set of leaves, not their order in the file;
  * an odd node count needs no duplication (array layout);
  * a single leaf tree has root = leaf hash and an empty proof;
  * duplicate leaves cannot occur (one leaf per tokenId; the build fails if a tokenId repeats).
* An empty set is never posted (postRoot refuses a zero root and a zero leaf count).
* The recompute script must match the library on golden trees (1, 2, 3 and 100 leaves) checked in both JavaScript and Foundry.

## 4. Contract surface (signatures only)
* Inherits AccessControlDefaultAdminRules (same admin delay as ForecastLedger). No Pausable: there is nothing to pause, and revoke covers bad data.
* ROUND_MANAGER_ROLE = keccak256("ROUND_MANAGER_ROLE"), granted to the mainnet keeper (the same keeper wallet as the ledger's round manager).
* Immutables: LEDGER (the mainnet ForecastLedger), AGENT_ID (checked equal to LEDGER.AGENT_ID() in the constructor).
* Constants: SHRINK_K = 20, SCORE_VERSION = 1 (documentation for consumers; not used in verify), ADMIN_TRANSFER_DELAY = 1 day (same as the ledger).
* Storage: Epoch[] with fields root (bytes32), snapshotBlock (uint64), roundId (uint64), leafCount (uint32), postedAt (uint48), revoked (bool). Two slots per epoch. Epoch ids start at 1; the latest epoch is the last one appended.
* constructor(address admin, address keeper, address ledger, address agentId). CHANGE 24 Nov 2026: agentId added. With three arguments the "agent id mismatch reverts" check of section 9 could not exist; now the constructor reverts with AgentIdMismatch unless ledger.AGENT_ID() == agentId, which catches a wrong ledger address at deploy. Also reverts on a zero address or a ledger without code.
* postRoot(uint64 roundId, uint64 snapshotBlock, bytes32 root, uint32 leafCount), only ROUND_MANAGER_ROLE. Reverts when root is zero, leafCount is zero, snapshotBlock >= block.number, or snapshotBlock is not strictly greater than the previous epoch's snapshotBlock. Appends; emits RootPosted(epoch indexed, roundId indexed, root, snapshotBlock, leafCount).
* revokeRoot(uint256 epoch, string reason): the admin may revoke any epoch; the keeper (ROUND_MANAGER_ROLE) only the newest two, the bad root and the corrected root that supersedes it, else KeeperRevokeTooOld (CHANGE 24 Nov 2026, review L2: a stolen hot keeper key cannot erase history). Reverts on an unknown or already revoked epoch. Irreversible. Emits RootRevoked(epoch indexed, reason).
* Value: no payable function and no receive or fallback, so any call with value reverts (tested).
* latestEpoch() view returns the epoch id (0 before the first post).
* getEpoch(uint256 epoch) view returns the record; reverts UnknownEpoch for 0 or an id above latestEpoch. verify and verifyAt never revert on an unknown epoch, they return false.
* verify(uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) view returns bool: true only if the latest epoch exists, is not revoked, and the proof matches its root. It never falls back to an older epoch.
* verifyAt(uint256 epoch, uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) view returns bool: same check against one named epoch (history, audits). False if revoked or unknown.
* leafHash(uint256 tokenId, int256 skill, uint256 n) pure returns bytes32, for tooling.
* Why latest follows snapshotBlock and not roundId: long rounds settle after later daily rounds, so round ids are not in settlement order. "Root per round id" is kept as the roundId field and the indexed event.

## 5. Keeper flow, correction and recompute
* Trigger: after the keeper finishes a round's settlement (every revealer scored, every non revealer forfeited), it builds the tree at the finalized block, runs the recompute check on its own output, then posts.
* After the post it reads RootPosted and compares it to the published leaves file. A mismatch pages via healthchecks.io.
* Leaves file: web/public/data/scores/<epoch>.json and latest.json, with chainId, ledger, scores address, agentId, epoch, roundId, snapshotBlock, root, method string ("forewit scores v1: skill = sumSkill / (baselineQuestions + 20), truncated toward zero"), leafCount, leaves [{tokenId, forecaster, skill, n, proof}] and excluded [{forecaster, reason}]. Numbers are decimal strings. CHANGE 24 Nov 2026: no mintTx (option B needs no mint scan); epoch is null in the built file and the keeper fills it after the post.
* Recompute script: node indexer/scores.mjs recompute --network mainnet --scores <address> [--epoch n] [--file leaves.json] (CHANGE 24 Nov 2026: lives in indexer/scores.mjs next to the builder, not scripts/scores/recompute.mjs). Input network and epoch (default latest); the ledger deploy block is built in for mainnet (135450390), --from-block elsewhere. It reads the epoch onchain, rebuilds every leaf from ForecastLedger and Agent ID logs up to snapshotBlock by the canonical rule of section 2.3 (no leaves file needed), checks that scored forecasters = leaves plus excluded, rebuilds the tree, and exits 0 only if the root equals the onchain root. Optionally diffs against the published file.
* Wrong root (keeper error): the keeper first posts a corrected root with a newer snapshotBlock, which becomes latest, so honest holders keep verifying; then the keeper or the admin calls revokeRoot(bad epoch, reason) so verifyAt on it fails too. Revoke first only when no corrected root can be built yet (for example a stolen key, T2); then verify returns false until the repost (fail closed). Earlier correct epochs and verifyAt on them are unaffected. Consumers that stored an epoch id recheck getEpoch(epoch).revoked. Actions consumers already took on a revoked root cannot be undone by us; section 6 gives them an optional delay.
* /proof shows the root history: epoch, roundId, snapshotBlock, leaf count, revoked flag and the recompute status.

### 5.1 Keeper integration (wired 24 Nov 2026: keeper.mjs duty "scores", run at the end of every tick)
* After the settlement of a round (every revealer scored, every non revealer forfeited), call build({ network, ledger, roundId }) from indexer/scores.mjs. It picks the finalized block, fetches ledger logs from the deploy block (FROM_BLOCK) and Agent ID Transfer logs for the opted in tokenIds, and returns the leaves file object.
* If root is null (no opted in holder yet), skip the post and log it; postRoot refuses an empty set anyway.
* If the latest onchain epoch already has this root and leafCount, skip (nothing changed). Otherwise call postRoot(roundId, snapshotBlock, root, leafCount) with the keeper key (ROUND_MANAGER_ROLE on ForewitScores). snapshotBlock must exceed the previous epoch's, which a later finalized block always does unless two posts share a block: then wait one block.
* Independent check before posting (review L3, decided 24 Nov 2026): build on one explicit provider with no fallback (NodeReal), recompute on a second explicit provider (Ankr), and post only if root, leafCount and the number of ledger logs match; then cross check every leaf's n and skill sums against ForecastLedger.getStats by eth_call. Any mismatch: post nothing and alert. Measured 24 Nov 2026: NodeReal, Ankr and publicnode returned identical log counts over 1,000 and 5,000 blocks and over the ledger's life; publicnode errors on long ranges instead of truncating.
* After the receipt: read RootPosted, set epoch in the file, write web/public/data/scores/<epoch>.json and latest.json, then run recompute({ network, scores, epoch }) on the second provider and alert through healthchecks.io unless ok is true.
* Watchdog: a settled round with no root after 2 hours alerts (T3).
* Correction: post the corrected root first, then revokeRoot(bad epoch, reason) (section 5).

## 6. Example consumer (ForewitGate, signatures and checks only)
* Purpose: gate something on a minimum Forewit skill, for example a non transferable "Calibrated" badge or an allowlist. Holds no funds.
* Immutables: SCORES, AGENT_ID, MIN_SKILL (int256, 0 means "beats the market so far"), MIN_N (20, the leaderboard minimum), MAX_AGE (for example 3 days), optional MIN_AGE (for example 1 hour, see threat T2).
* claim(uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) checks, in order (MIN_AGE unset):
  * AGENT_ID.ownerOf(tokenId) == msg.sender (proofs are public; without this anyone could use someone else's proof);
  * LEDGER.profileLabelId(msg.sender) == tokenId, the caller is the wallet that opted in this name on ForecastLedger (narrows a reissue, T5);
  * SCORES.verify(tokenId, skill, n, proof) is true;
  * skill >= MIN_SKILL and n >= MIN_N;
  * the latest epoch's postedAt is at most MAX_AGE old;
  * then records passed[tokenId] = latest epoch and emits an event.
* Built: contracts/src/examples/ForewitGate.sol, the basic variant above (MIN_SKILL, MIN_N, MAX_AGE; passed[tokenId] = epoch, event Passed). CHANGE 24 Nov 2026: the MIN_AGE variant below is specified but not built; its tests in section 9 are therefore open.
* With MIN_AGE set, claim takes an epoch argument and uses SCORES.verifyAt(epoch, ...) instead: the epoch's postedAt must be at least MIN_AGE and at most MAX_AGE old, and no newer unrevoked epoch may already be MIN_AGE old (so a holder cannot pick an older, better score). This keeps gates open right after each post instead of locking everyone out for MIN_AGE.
* An agent off chain does the same with one eth_call to verify plus ownerOf. The site's "verify onchain" button does exactly this.

## 7. Threat model
* T1 Wrong root (keeper bug): the keeper self checks before posting and compares after; anyone can run the recompute script; /proof shows the result. Fix: a corrected epoch, then revoke the bad one (section 5). Residual: the bad root verified until the correction.
* T2 Malicious root (stolen keeper key or insider): there are no funds to take, but fake scores verify until revoked. A stolen keeper key can revoke at most the newest two epochs; older history can only be revoked by the admin (review L2). Defences: public recompute, admin revokes the keeper role and the bad epochs, consumers can set MIN_AGE so a root must survive a watch window before it counts. Residual: consumers without MIN_AGE that acted before the revoke.
* T3 Stale root (keeper down): verify keeps answering for the last good root, which is still true as of its snapshot. Consumers check postedAt or snapshotBlock age (MAX_AGE). healthchecks.io alerts when a settled round has no root after 2 hours.
* T4 Replay of an old proof: verify checks only the latest root; a proof built for an older tree does not match a new root unless that leaf and its whole path are unchanged, in which case the claim is still exactly true. verifyAt is history by explicit choice. A proof is a public bearer statement about a tokenId, so consumers must bind it to msg.sender via ownerOf (section 6).
* T5 Holder transfer or reissue: Agent ID transfers revert (simulation evidence), so a score cannot be bought by moving the token. The real Agent ID emits a standard ERC721 Transfer from zero with the tokenId indexed on mint (checked on mainnet 24 Nov 2026, block 135270306), and the indexer treats any Transfer of the token to another wallet after the opt in (transfer, burn, or a reissue mint from zero) as moved, so the old leaf is dropped from the next root (delta review D1, test in indexer/test/scores.test.mjs). Residual (review L1): until that next root, which is open ended after the last round or during a keeper outage, a direct verify of a reissued name still returns the previous holder's score. ForewitGate narrows this: besides ownerOf it requires ForecastLedger.profileLabelId(caller) == tokenId, so a new owner must first opt in that name on the ledger, and MAX_AGE bounds the age of the root. A new owner who does opt in still passes on the stale leaf until the next root. Consumers should check both ownerOf and profileLabelId, as the gate does. Whether names can be reissued at all is an open organizer question (R4).
* T6 Keeper key loss: no funds at risk. The lost key can revoke at most the newest two epochs, which the admin or the new keeper repairs by posting a fresh root. The admin revokes ROUND_MANAGER_ROLE from the lost key and grants it to a new key; history stays. Admin key loss: same two step AccessControlDefaultAdminRules model as the ledger; worst case the contract freezes at its last root and a new ForewitScores is deployed with no ledger change.
* T7 Second preimage and type confusion: double hashed 96 byte leaves versus 64 byte internal nodes; fixed types (uint256, int256, uint256).
* T8 Score gaming: inputs are the ledger's own scores; one Agent ID per user; operators excluded; forfeits count; shrinkage toward zero for small samples. Same limits as the leaderboard (THREAT_MODEL.md).
* T9 Data availability: if the leaves file is lost, anyone rebuilds it from logs; the root alone is enough to verify a rebuilt proof.
* T10 Privacy (red line 9): leaves are keyed by tokenId = keccak256(label), so anyone can hash a name and find its score. Under option A the published leaves file also lists the forecaster address (and the mint hint) next to each tokenId, so hashing a name returns a wallet: that is Agent ID packaged as a name to wallet lookup, red line 9 almost word for word. Dropping the address from the file does not fix it, because the recompute needs it and logs reveal it. Option B, chosen 24 Nov 2026 (decision 1), limits the file to holders who published their name themselves. The site and MCP never offer name search for holders who have not opted in.
* T11 Gas griefing: verify is a view with a caller supplied proof; the caller pays its own calldata. postRoot cost is constant in the number of leaves.

## 8. Gas and cost
Prediction (before code, BSC gas price 0.05 gwei per notes/knowledge.md):
* Deploy: about 1.0M to 1.4M gas, about 0.00006 BNB.
* postRoot: about 80,000 gas steady state (21,000 base, 2 new slots 44,200, role check and previous epoch reads about 4,200, calldata about 2,300, event about 2,500, overhead); about 97,000 for the first post. About 0.000004 BNB per post.
* revokeRoot: about 35,000 gas.
* verify as a view, 100 leaves (7 proof steps): about 8,000 gas (3 cold reads 6,300, hashing about 1,000). Inside a consumer transaction about 15,000 gas including the external call and about 3,600 gas of proof calldata. Each doubling of leaves adds one step, about 650 gas.

Observed 24 Nov 2026 (forge test --gas-report, same figures with --isolate; solc 0.8.39, optimizer 200 runs; cold storage, the measured call alone in its test):
* Deploy: 1,467,881 gas, 7,077 bytes, slightly above the predicted range. Basis: forge's Deployment Cost, which tracked the real ledger deploy closely (report 3,570,621 versus 3,574,338 gas used onchain), so expect about 1.47M to 1.48M in the real transaction, about 0.00007 BNB at 0.05 gwei.
* postRoot: 79,804 steady, 94,483 first. Basis: gas inside the call; a gasleft probe around an external call gave 84,513, which agrees once the cold account access is added. A transaction adds 21,000 base and about 1,500 calldata, so about 102,000 steady and 117,000 first, about 25% above the prediction. About 0.000005 BNB per post.
* revokeRoot: 34,371 (prediction 35,000, same basis caveat: plus 21,000 as a transaction).
* verify as a view, 100 leaves, 7 steps: 9,827 (prediction 8,000).
* ForewitGate.claim with a 2 step proof: 68,815 (writes passed, emits Passed). ForewitGate deploy 489,417.
* Logging predicted versus observed in notes/ledger.md is left to the orchestrator.

## 9. Test plan
* Unit (Foundry): constructor (agent id mismatch reverts); roles (only the keeper posts; keeper or admin revokes; others revert); postRoot guards (zero root, zero count, future or current block, non increasing snapshotBlock); epoch records and events; verify true for every leaf of a golden tree; false for wrong tokenId, skill, n or proof; false before the first post; false when the latest epoch is revoked (no fallback); verifyAt on old, revoked and unknown epochs; revoke twice and unknown epoch revert; admin two step transfer.
* Golden vectors: a JavaScript script builds trees of 1, 2, 3 and 100 leaves with @openzeppelin/merkle-tree and prints roots and proofs; Foundry tests check the same values (same pattern as scripts/golden_vectors.mjs). Score golden vectors from section 1.2 in both languages.
* Fuzz: random leaf sets of 1 to 64 leaves built by a Solidity test helper with the same layout; every leaf verifies, any one bit change in tokenId, skill, n or a proof element fails. Invariant: epoch count only grows, snapshotBlock strictly increases, a revoked epoch never verifies.
* Recompute equals onchain root: on testnet instance E, run a round with the keeper, post a root, run the recompute script from logs only, require an exact match; repeat on mainnet after every post (keeper job plus a CI check on the public repo).
* Consumer: ForewitGate unit tests (wrong holder, low skill, low n, stale root, revoked root: done; with MIN_AGE: open, variant not built) and one BSC fork test against the real Agent ID ownerOf with a known holder (open).
* Status 24 Nov 2026: 44 Foundry tests (37 unit including golden roots, a logs fixture root, deploy guards and gas; 6 fuzz at 2,000 runs; 1 invariant suite with 2 invariants) and 11 node tests in indexer/test/scores.test.mjs pass. Golden roots for 1, 2, 3 and 100 leaves and the logs fixture root are asserted with the same constants in both languages, plus one library proof checked by verify. Coverage 100% lines, statements, branches and functions for ForewitScores and ForewitGate. Slither 0.11.6: 0 High, 0 Medium on the new files (2 Low timestamp, both false or intended; 8 Informational naming, same style as the ledger). Aderyn not run. The indexer tests are not in CI yet (no workflow step runs indexer/test).
* Live smoke 24 Nov 2026 (read only): build on mainnet from the deploy block found the constructor RoleGranted logs and no scored forecaster yet (empty set, no root). On testnet, bsc-testnet-rpc.publicnode.com silently returns no logs for instance E's blocks (144466773 on), and the other public testnet RPCs refuse; fetchLogs now throws when no RoleGranted is found instead of building an empty set. The cached instance E logs (2 scored, both operator wallets) decode to 2 operator exclusions. A testnet recompute needs a keyed testnet RPC.
* Static analysis: Slither (counted by impact from --json) and Aderyn in CI, every finding triaged in docs/SECURITY.md; 100% line coverage; then an independent review with no open High or Medium before deploy.
* Deploy only after ForecastLedger is live on mainnet and only with Owais's explicit yes (action, cost, addresses shown first).

## 10. Considered and dropped
* Holder address in the leaf with ownerOf inside verify: closes the reissue window of T5 but adds an external call to every verify and puts addresses in the leaf. Dropped; consumers check ownerOf themselves.
* A view only adapter (score computed live from getStats(ownerOf(tokenId)), no keeper, no root): trustless and cheaper, but it gives no history, no snapshot a proof can refer to, and no root to carry to other chains or later ledgers. The spec asks for roots; kept as a note for open decision 2.
* Pausable: nothing to pause; revoke is enough.

## 11. Open decisions for the owner
1. Membership. DECIDED 24 Nov 2026 by Owais: option B (section 2.2). Original note: option A (written as the default in section 2.2 because it is the launch prompt wording): every scored Agent ID holder gets a leaf. Option B: only forecasters whose last ProfileUpdated has isPublic true and a label. A makes the reputation portable for everyone, but the leaves file then maps hashed names to wallets for people who never opted in (T10), which is red line 9 and the MASTER_PROMPT rule "no search by arbitrary name"; it also rests on an unverified mint event and cannot be tested on instance E. B is privacy safe, needs no Agent ID log scan (the ledger already proved ownerOf at opt in), and works on testnet; gates only work for opted in users. Recommended: B for v1; opting in is one transaction we already have.
2. Whether verify should also accept a live path (getStats based) for holders not yet in a root. Recommended: no for v1 (keep one definition of truth).
3. New dev dependency @openzeppelin/merkle-tree for the keeper and recompute script. DONE 24 Nov 2026: 1.0.8 pinned as a root devDependency; it brings 31 packages with its transitive dependencies (not 1 as estimated). npm warns that its uuid 9 dependency is deprecated.
4. What happens if ForewitScores is late. done_when item 4 needs it live on mainnet with one verify call. The pre registered line in notes/ledger.md stops new scope if there is no testnet root with a recompute match by 1 Dec 2026; whether to then skip the mainnet deploy is Owais's call, not pre decided.
