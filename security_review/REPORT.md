INDEPENDENT SECURITY REVIEW: ForecastLedger
Final report, 23 Nov 2026

1. SCOPE AND METHOD

* Sources: only the review packet at <review workspace>\review_packet (contracts/src, mocks, interfaces, tests, scripts, lib, and THREAT_MODEL.md). No triage notes, prior audits, ledgers, keeper, indexer, agent or web code were read.
* Target: src/ForecastLedger.sol, Solidity 0.8.39, evm cancun, Foundry, run locally and offline.
* Lenses: score manipulation, liveness and DoS, seal and void timing, admin powers, integer bounds and storage; plus reveal and forfeit edge cases and the per round resolutionWait across all lenses.
* Two finder rounds per lens. Reports were merged and deduplicated into 30 items.
* Adversarial verification: each item was handed to skeptics told to refute it. The three items reported as Medium got 3 independent skeptics each; all other items got 1. No item was reported as High.
* Final severity rule: the most common severity among the skeptics, ties to the higher. No ties occurred.
* Limits: everything ran on mocks only. No fork tests, no network, no transactions. The real Agent ID token and the real Predict.fun CTFs are therefore unverified. This writing step re ran no test; results are as recorded by finders and skeptics.
* The contract was not changed. All fixes below are recommendations awaiting owner approval. Where possible a "contract frozen" option is given next to the contract option.

2. SUMMARY

* Items examined: 30. Confirmed: 26. Refuted: 4.
* Final severity of confirmed findings: High 0, Medium 1, Low 8, Info 17.
* Reported versus final: 3 items were reported Medium, 1 stays Medium (baseline withholding), 2 were downgraded to Low (baseline content, double commit). 3 items reported Low were downgraded to Info (pause in the commit window, repeated condition in overlapping rounds, lazy stats).
* No finding puts funds at risk (the contract holds none). No unprivileged outsider can alter another forecaster's Brier score. The material issues concern skill versus the baseline, which the round manager can influence, and several threat model statements that are stronger than the code.
* Headline: THREAT_MODEL trust assumption "the keeper cannot change any score" is false for skill. It is true for Brier.

3. CONFIRMED FINDINGS

MEDIUM

M1. Round manager can withhold the baseline after seeing all reveals and outcomes, erasing the round's skill for everyone; also lost for good on keeper downtime
* Final severity: Medium. Skeptic severities: Low, Medium, Medium. Vote: 3 of 3 upheld. Reproduced by all three.
* Location: src/ForecastLedger.sol revealBaseline (lines 291 to 302), commitBaseline (280 to 287), _applyScore useBaseline branch (621, 633 to 642), _checkScorable (611 to 614); inherited grantRole and revokeRole with no delay.
* Description: sumSkill, sumBaselineBrier and baselineQuestions are written only when baselineRevealed is true. revealBaseline is optional, ROUND_MANAGER only, carries no penalty, and is valid only inside the reveal window (12 hours to 7 days); afterwards it reverts RevealNotOpen forever. There is no late path, no permissionless path and no admin repair. _checkScorable ignores a committed but unrevealed baseline, so scoring proceeds with skill 0 for everyone and a forfeit costs nothing in skill terms. Forecaster reveals are public from the commit deadline and markets can resolve inside the reveal window, so the manager chooses with full hindsight whether the round counts for skill.
* Variants: (a) never committing a baseline; (b) committing the hash of a non canonical vector (for example 10001) that can never be revealed, which is deniable but involves no hindsight; (c) DEFAULT_ADMIN grants itself ROUND_MANAGER in the same block and burns the one shot baseline slot with a garbage hash; (d) DEFAULT_ADMIN revokes the keeper during the reveal window; (e) a plain keeper outage across the reveal window, which needs no malice and cannot be repaired onchain.
* Skeptic corrections: variants (c) and (d) are standard AccessControl powers and count as Low or Info disclosure items, not as support for Medium. The outage variant (e) is the strongest part. The Medium rating rests on mean skill being the ranking metric and the Crowd versus Market headline, which the packet cannot confirm; if skill were informational only this drops to Low. Mitigating: privileged role or outage needed, effect is round wide and all or nothing, the manager cannot pick a different value or target one forecaster, sumBrier is untouched, and the state is detectable (BaselineCommitted without BaselineRevealed).
* Exploit: 1. Manager commits the baseline hash as usual. 2. After the commit deadline it reads all Revealed events, waits for markets that resolve in the reveal window, and computes every forecaster's skill offchain. 3. If the result is unwelcome it never calls revealBaseline. 4. After the deadline everyone has skill 0 and baselineQuestions 0 for that round, permanently. Cost zero.
* PoC: <review workspace>\review_packet\work_admin_r1\test\poc\AdminBaseline.t.sol
* Command: export PATH="$HOME/.foundry/bin:$PATH"; cd "<review workspace>/review_packet/work_admin_r1" && forge test --match-path "test/poc/AdminBaseline.t.sol" -vv
* Result: 6 passed, 0 failed. With reveal: alice plus 24e6, bob minus 56e6, carol (forfeit) minus 75e6. With the keeper silent: all three have skill 0 and baselineQuestions 0, identical sumBrier. Four further PoCs of the same issue exist in work_score_r1, work_liveness_r1, work_timing_r1 and work_bounds_r1; the skeptics did not run those.
* Recommended fix (pick one):
  * Option 1: drop the secrecy. Post the baseline vector in clear in commitBaseline before the commit deadline (canonical check there, baselineRevealed set at once) and delete revealBaseline. Smallest complete fix; removes both the discretion and the liveness dependency. Trade off: forecasters can copy a visible baseline, which scores about zero skill.
  * Option 2: make revealBaseline permissionless (the hash binds it, as with revealFor) and have the keeper publish or escrow the salt right after the commit deadline. Permissionless alone only fixes liveness if the salt is really published.
  * Option 3: in _checkScorable, revert while baselineCommit is nonzero and unrevealed, and allow a late baseline reveal after the deadline.
  * In all cases, and as the full answer if the contract stays frozen: a dashboard flag for "committed but not revealed", a pre registered offchain rule for such rounds, the keeper archiving vector and salt so skill can be recomputed offchain, and disclosure under Owner permissions. The admin paths (c) and (d) are not closed by any option: disclose them or restrict commitBaseline to one fixed keeper per round.

LOW

L1. Round manager sets the size and sign of skill: the baseline vector is arbitrary and can be chosen after seeing who committed
* Final severity: Low (reported Medium). Skeptic severities: Low, Low, Low. Vote: 3 of 3 upheld. Reproduced by all three.
* Location: src/ForecastLedger.sol commitBaseline (280 to 287), revealBaseline (291 to 302), _applyScore (630 to 642).
* Description: nothing onchain ties the baseline to a market price or a time. commitBaseline accepts any nonzero hash from round creation to the commit deadline; revealBaseline checks only the hash and that each slot is at most 10000. Inside one round the baseline cancels out, but skill is summed across rounds and forecasters take part in different rounds. Committed events show the manager who is in a round before it commits the baseline. A manager, or DEFAULT_ADMIN through an instant self grant (that path was not verified by the skeptics), can post a poor baseline in rounds its own or a friendly wallet enters and an accurate one elsewhere. commitBaseline is also one shot and usable by any ROUND_MANAGER holder for any round, so a wrong hash can never be corrected.
* Why Low: it is a trusted role misusing a power the threat model already assigns to it ("publishes the baseline"); no funds; Brier, outcomes, reveals and forfeits are untouched; the abuse is public and permanent (BaselineCommitted time, BaselineRevealed vector) and can be compared with archived books; content cannot be checked onchain without a price oracle. Why still a finding: "cannot change any score" is false for skill, and the defences in items 13 and 24 are offchain only.
* Exploit: manager creates round N and at once commits a baseline of 5000 on a question the market prices at 9500; its own wallet commits 9500, a plain market copy; the question resolves Yes. That wallet gets sumSkill plus 24,750,000 while an honest forecaster with the same forecast against an honest baseline gets 0 with the same Brier.
* PoC: <review workspace>\review_packet\work_admin_r2\test\poc\BaselineContent.t.sol
* Command: cd "<review workspace>/review_packet/work_admin_r2" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --match-path test/poc/BaselineContent.t.sol
* Result: 1 passed (test_poc_managerMintsSkillWithArbitraryBaseline).
* Recommended fix: contract option: commitBaseline reverts unless block.timestamp is at or after commitDeadline minus a BASELINE_WINDOW constant (5 to 15 minutes); this removes "baseline at creation" but not the content lever. Frozen option, needed in any case: correct the threat model (the keeper can move skill, not Brier), have the indexer recompute skill from archived books and flag baselines beyond a tolerance, rank on raw Brier alongside skill, and publish a rule keeping ROUND_MANAGER wallets off the leaderboard.

L2. One Agent ID can hold two live commits in a round (burn and reissue)
* Final severity: Low (reported Medium). Skeptic severities: Low, Low, Low. Vote: 3 of 3 upheld. Reproduced on MockAgentID only.
* Location: src/ForecastLedger.sol commit (318 to 332, balanceOf gate at line 324 only), _reveal (555 to 568, no Agent ID check by design per threat 19), forfeit; Stats keyed by address.
* Description: the gate is AGENT_ID.balanceOf(msg.sender) at commit time only, and commits, flags, reveals and Stats are keyed by address, never by tokenId. If the identity can leave wallet A and reach wallet B inside one commit window, one person holds two commits in the same round. Threat 3 ("not revealing is never better than revealing") holds per address, not per person.
* UNVERIFIED PRECONDITION: that the real Agent ID can be burned or released and reissued to another wallet within a commit window (2 hours to 7 days). Only the mock, where anyone can mint and burn, shows it. If the real token cannot do this, the finding is Info.
* Skeptic corrections to the original claim: "repeatable each round" did not hold. In a skeptic's 3 round test the main wallet ended with 2 forfeits and skill below a plain market copier; a clean record over n binary rounds needs about 2^n wallets, and the offchain minimum of 5 rounds and 20 scored questions excludes one round winners. The 16 question variant with two complementary extreme vectors gave no gain (both scored 8e8 with negative skill). Selective reveal adds nothing over revealing both. The real residue: one identity can place two or more entries in a single round, which gives a cherry picked one round score and double weight in the crowd aggregate. This is close to the disclosed residual in threat 5 (two Binance accounts) but cheaper if reissue is fast.
* PoC: <review workspace>\review_packet\work_score_r1\test\poc\DoubleCommitSelectiveReveal.t.sol
* Command: cd "<review workspace>/review_packet/work_score_r1" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --offline --match-path "test/poc/*"
* Result: PASS, test_poc_oneIdentityTwoCommitsRevealWinner. Skeptic counter tests (multi round and 16 question): <review workspace>\review_packet\verify_2_1\test\poc\Skeptic2.t.sol (no command recorded).
* Recommended fix: first verify with the issuer or a read only fork script whether reissue inside a commit window is possible and how fast. If yes, contract option: take a tokenId or label in commit and allow one committing address per tokenId per round. Frozen option: indexer dedupes by label or tokenId using Transfer logs, requires the Agent ID to be held by the same wallet since before round creation, and shows forfeits of wallets that shared a tokenId. Document that threat 3 holds per address.

L3. Track record is keyed by wallet address, not by Agent ID, so a burned and reissued Agent ID starts a clean record (hypothesis for the real token)
* Final severity: Low. Skeptic: Low. Vote: 1 of 1 upheld. Reproduced on the mock.
* Location: src/ForecastLedger.sol commit (balanceOf gate, line 324) and the _stats mapping (line 116).
* Description: same mechanism as L2 with a different impact: resetting a poor history across rounds, which weakens the claim of a track record nobody can fake or buy. Nothing records a tokenId at commit. Not disclosed in threat 19 (reveal fairness only) or threat 5.
* Exploit: build a poor record on wallet A, burn or release the Agent ID, claim it on wallet B, and reappear with empty getStats once the minimum rounds are met again.
* Limits: the skeptic's test asserts roundsCommitted only, not a wiped Brier; real token behaviour is unverified. The old record stays onchain under the old address.
* PoC (skeptic's own): <review workspace>\review_packet\verify_3_0\test\Skeptic30.t.sol
* Command: run inside the verify_3_0 folder: forge test --match-contract Skeptic30 (1 passed).
* Recommended fix: frozen option: indexer joins records by tokenId (ownerOf history and profile label) and shows a reissued identity with its earlier addresses. Contract option, only if reopened: record the tokenId at commit.

L4. Baseline commit has no earliest time and is one shot: a later copy of the market books positive skill (last look)
* Final severity: Low. Skeptic: Low. Vote: 1 of 1 upheld. Reproduced.
* Location: src/ForecastLedger.sol commitBaseline (280 to 287), commit (318 to 332), _applyScore (618 to 651); THREAT_MODEL items 2, 13, 24.
* Description: commitBaseline accepts a hash from the first second of the round and can never be refreshed. The "last 5 minutes" rule exists only in the keeper. Forecasters can commit and overwrite until the deadline, so they always act after the snapshot. Copying the market after the snapshot earns expected skill equal to the squared price move since the snapshot. Threat 2 ("a copied market price scores about zero skill") holds only for a copy at snapshot time. With the keeper rule honoured the edge is small but systematic and open to any Agent ID holder with a bot; with an early baseline it is large. Related: L1 (manager chosen baseline content).
* Exploit: a bot reads the order book seconds before commitDeadline and commits that price for every question. Probe: baseline 5000 at creation, market copy 8000 committed 20 hours later, outcome Yes, skill plus 21,000,000.
* PoC: <review workspace>\review_packet\work_score_r2\test\poc\Probe.t.sol
* Command: cd "<review workspace>/review_packet/work_score_r2" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --match-path "test/poc/Probe.t.sol" --match-test test_probe_lastLook_marketCopyHasPositiveSkill
* Result: PASS.
* Recommended fix: contract option: require block.timestamp at or after commitDeadline minus BASELINE_WINDOW in commitBaseline, or let ROUND_MANAGER post the baseline in clear in a short fixed window right after commitDeadline (commits are closed, so no hiding is needed; this also resolves M1). Frozen option: disclose the residual last look in threat 2, correct "cannot change any score" to "cannot change Brier scores; the baseline sets skill", and show the baseline commit time per round. The realistic 5 minute edge was not measured on market data.

L5. Lazy seal with no time bound: in a round nobody seals during the reveal window, the first finalize voids every honestly resolved question, so a forfeit costs nothing
* Final severity: Low. Skeptic: Low. Vote: 1 of 1 upheld. Reproduced.
* Location: src/ForecastLedger.sol finalizeQuestion unsealed branch (380 to 384), _seal (571 to 588), forfeit and _applyScore (627); THREAT_MODEL items 3 and 18.
* Description: the seal runs only on reveal, revealFor, revealBaseline, sealRound or finalizeQuestion at or after the commit deadline. voidStale, score and forfeit never seal and never require isSealed. If none of the sealing calls happens during the reveal window, the first finalizeQuestion, however late, seals then and voids every question resolved by then, including ones that resolved legitimately after the commit deadline. A non revealer is then forfeited over zero questions (sumBrier 0, questionsScored 0, roundsForfeited plus 1). Threat 3 is false in this state.
* Skeptic correction: the original report said there is no positive selection. That is wrong: a lone committer holds a free option (reveal when the market moved in her favour, which seals and scores; stay silent when it moved against her, and the late finalize voids everything), at the price of visible forfeit marks.
* Precondition is narrow: zero reveals, no baseline reveal and no sealRound for the whole reveal window, so lone or fully colluding committers plus keeper downtime. No honest revealer's score changes. Test gap: testFuzz_forfeitNeverBeatsReveal always includes a sealing reveal.
* PoC: <review workspace>\review_packet\work_liveness_r2\test\poc\LazySeal.t.sol
* Command: cd "<review workspace>/review_packet/work_liveness_r2" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --match-path test/poc/LazySeal.t.sol
* Result: PASS, 2 of 2. Reveal path gives sumBrier 162000000; silent path gives both questions Void and a forfeit with sumBrier 0.
* Recommended fix: contract option: refuse forfeit and forfeitBatch (or _checkScorable) on an unsealed round, and in finalizeQuestion void on the unsealed path only while block.timestamp is at or before revealDeadline, with an explicit rule afterwards. Frozen option: keeper calls sealRound in the first block at or after the commit deadline, with a watchdog on a missing RoundSealed event; tell forecasters anyone can call sealRound; count zero question forfeits against participation offchain; correct threats 3 and 18.

L6. Whoever orders transactions around the seal chooses whether a question that resolves near the commit deadline counts or is voided
* Final severity: Low. Skeptic: Low. Vote: 1 of 1 upheld. Reproduced with the skeptic's own test.
* Location: src/ForecastLedger.sol _seal, sealRound, finalizeQuestion (unsealed branch).
* Description: between the commit deadline and the first seal, any question that becomes resolved onchain is voided; once sealed, the same resolution scores normally. Sealing is permissionless, so the race belongs to whoever lands first. A void is selective, not neutral: it removes a question on which some gain and others lose, so the threat model wording "voided (neutral for everyone)" is inaccurate. Bounded to one dropped question; the window is normally seconds and widens if the keeper is late and nobody reveals. Distinct from L5 (resolutions long after the deadline).
* Exploit: a forecaster with a bad locked forecast on question i waits for the resolution to land while the round is unsealed, then seals: question i is Void. With a good forecast the same person calls sealRound first. The idea that a forecaster can trigger the oracle's final report is a hypothesis (the adapter is outside the packet) and does not raise severity.
* PoC (skeptic's own): <review workspace>\review_packet\verify_6_0\test\SealRace.t.sol (2 tests pass; no command recorded).
* Recommended fix (no contract change): keeper seals in the first block at or after the deadline with a watchdog; selection rule avoids markets whose oracle can finalize within a margin after the commit deadline; reword the threat model to call this a selective void.

L7. voidStale is discretionary and not neutral per forecaster: after the wait, any loser can void a pending question just before it resolves
* Final severity: Low. Skeptic: Low (between Info and Low). Vote: 1 of 1 upheld. Code reading only, no test run.
* Location: src/ForecastLedger.sol voidStale (401 to 409), finalizeQuestion.
* Description: once revealDeadline plus resolutionWait has passed and the CTF is still unresolved, anyone can void the question at a moment of their choosing; if it resolves, anyone can finalize; whichever lands first is permanent. Threat 23 says voiding is "neutral for everyone", which holds in aggregate but not per forecaster. A short wait (minimum 1 day, the manager's choice per round) widens this, and a wait that is short relative to the market horizon also voids forfeit penalties. Until one of the two calls happens the whole round cannot be scored or forfeited, for up to the reveal window plus 120 days. The boundary itself is consistent and tested. The attacker can only void, never set Yes or No, and the wait is published in RoundCreated before any commit.
* Exploit: the wait is over, the outcome is publicly known to be Yes but the oracle transaction is pending, alice revealed 1000 bps. She calls voidStale before the report lands (or front runs it); her 0.81 Brier never counts. One transaction, no privilege.
* PoC: none. The existing test_voidStale confirms voidStale succeeds whenever the denominator is 0 after the wait.
* Recommended fix: frozen option: keep the keeper rule of 7 days or more for daily rounds, state the minimum in the published rules, keep resolutionWait well beyond the worst case dispute path, have the keeper check that no resolution is pending before calling voidStale, and reword threat 23. Contract option: raise MIN_RESOLUTION_WAIT or restrict voidStale to the round manager for a grace period.

L8. PAUSER_ROLE stays with the old admin after the two step admin transfer
* Final severity: Low. Skeptic: Low. Vote: 1 of 1 upheld. Reproduced with the skeptic's own test.
* Location: src/ForecastLedger.sol constructor line 232 (_grantRole(PAUSER_ROLE, admin)); inherited acceptDefaultAdminTransfer.
* Description: the constructor grants PAUSER_ROLE to the first admin as a separate role; the admin transfer moves only DEFAULT_ADMIN_ROLE. After a rotation (often because the old key is suspect) the old address can still pause createRound and commit, and the new admin cannot unpause until it grants itself PAUSER_ROLE or revokes the old holder. No escalation, only incomplete revocation; recovery is immediate because role grants have no delay; reveal, finalize, seal, score and forfeit are unaffected.
* Exploit: the old admin key pauses right before a commit deadline after the handover; commits for that round are blocked until the new admin sends revokeRole, grantRole and unpause.
* PoC (skeptic's own): <review workspace>\review_packet\verify_13_0\test\StalePauser.t.sol
* Command: run inside the verify_13_0 folder: forge test --match-contract StalePauserTest (passes).
* Recommended fix: frozen option: document the rotation runbook in README "Owner permissions" (new admin grants PAUSER to itself and revokes the old holder, ideally before the handover). Contract option: override _acceptDefaultAdminTransfer to move PAUSER_ROLE with the admin seat.

INFO

I1. Pausing inside a commit window freezes commits and overwrites for that round
* Final severity: Info (reported Low). Vote: 1 of 1 upheld. Reproduced with the skeptic's own test.
* Location: commit whenNotPaused (line 318), pause (line 305).
* Description: pause does not extend commit deadlines and an overwrite is a commit, so both are blocked; there is no withdraw or cancel. commitBaseline is not pause gated. A pauser can shut out newcomers and hold existing committers to stale forecasts. Nobody is forced into a forfeit (the earlier forecast can still be revealed) and shut out forecasters take no penalty. Threat 12 does not spell out this selective effect.
* PoC (skeptic's own): <review workspace>\review_packet\verify_8_0\test\poc\PauseSkeptic.t.sol (test_pauseInCommitWindow passes; no command recorded).
* Fix: disclose under Owner permissions and add an offchain rule that a round paused during its commit window is excluded from the leaderboard. Contract options if reopened: pause blocks only createRound, or existing committers may overwrite while paused, or a withdrawCommit before the deadline.

I2. The same condition may appear in overlapping rounds, so round N reveals leak into round N+1 commits
* Final severity: Info (reported Low). Vote: 1 of 1 upheld. Code reading only, no test run.
* Location: createRound duplicate check (lines 262 to 264).
* Description: DuplicateCondition is checked only within one round. With daily rounds, round N's reveal window overlaps round N+1's commit window. Skeptic note: avoiding the overlap does not close the leak, since reveals are public forever; this is a selection policy matter. The copied forecasts are a day old and scored against a fresh baseline.
* Fix: keeper selection rule (no condition from a round whose reveal deadline has not passed, or no repeats at all), or accept and document.

I3. Stats are lazy: a non revealer shows a clean record until every question is final and someone calls forfeit
* Final severity: Info (reported Low). Vote: 1 of 1 upheld. Reproduced.
* Location: forfeit, forfeitBatch, _checkScorable (lines 424 to 463, 611 to 614), getStats.
* Description: scores and forfeits are applied only when called and only once every question is final; one slow question holds the whole round for up to the reveal window plus 120 days. The delay is symmetric (revealers are delayed equally) and the pending state is computable from public data, so no ranking advantage was demonstrated. There is no onchain list of committers, so forfeits depend on the keeper replaying Committed logs.
* PoC: <review workspace>\review_packet\work_score_r2\test\poc\Probe.t.sol
* Command: cd "<review workspace>/review_packet/work_score_r2" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --match-path "test/poc/Probe.t.sol" --match-test test_probe_lazyForfeit_statsCleanWhileOneQuestionPending
* Fix (no contract change): indexer treats "committed, not revealed, reveal deadline passed" as a pending forfeit; keeper runs forfeitBatch over all Committed addresses as soon as a round is scorable; document that getStats alone is not a ranking source.

I4. Question oracle and yesSlot are not bound onchain; outcome integrity rests on the allowlisted CTFs refusing outside prepareCondition
* Vote: 1 of 1 upheld. Code reading only.
* Location: createRound (lines 258 to 269).
* Description: createRound accepts any 2 slot unresolved conditionId on an allowlisted CTF and any yesSlot; marketId is event only. On a vanilla Gnosis CTF anyone can prepare a condition with themselves as oracle. The only packet evidence that the Predict.fun CTFs reject outside prepareCondition is a comment in test/ForecastLedgerFork.t.sol. A wrong yesSlot inverts the outcome for the round with no onchain remedy, though it is visible in RoundCreated before anyone commits. Not reachable by outsiders.
* Fix: a fork check that prepareCondition and reportPayouts revert for arbitrary callers on all mainnet CTFs; dashboard and an independent script recompute conditionId from (oracle, questionId, 2) against an oracle allowlist and check yesSlot per RoundCreated; show each question's oracle; document under Owner permissions. Optional contract hardening: derive conditionId onchain against an immutable oracle allowlist.

I5. _tryDenominator fails open: a failed or gas starved staticcall is read as unresolved
* Vote: 1 of 1 upheld. Negative result reproduced.
* Location: _tryDenominator (lines 593 to 600), used by _seal and voidStale.
* Description: a failed, short or out of gas payoutDenominator call returns 0. In _seal that would skip a void; in voidStale it would void a resolved question. By the 63/64 rule the callee would have to cost roughly 90k gas (seal) or several hundred thousand (voidStale) for a caller to starve it and still finish. Safety rests on the getter being cheap, which the contract does not enforce and which was not measured on the real CTFs.
* PoC (negative sweeps): <review workspace>\review_packet\work_liveness_r1\test\poc\LivenessPoC.t.sol
* Command: cd "<review workspace>/review_packet/work_liveness_r1" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --match-path test/poc/LivenessPoC.t.sol --match-test test_check_gasStarvedSealCannotSkipVoid
* Skeptic's stricter step 1 sweep: <review workspace>\review_packet\verify_16_0\test\poc\Skeptic.t.sol. 17,390 successful seals with 1 question and 95,419 with 16 questions, none skipped a void; voidStale on a resolved question never succeeded.
* Fix (optional hardening): fixed gas stipend plus a gasleft() floor around the staticcall, or a comment with the 63/64 reasoning and a rerun of the sweeps on a mainnet fork against the real CTFs before deploy.

I6. Admin powers to disclose: role grants are instant, the 1 day delay can be scheduled down to zero, admin and keeper may be the same address
* Vote: 1 of 1 upheld. Code reading only.
* Location: ADMIN_TRANSFER_DELAY (line 36), constructor; OpenZeppelin changeDefaultAdminDelay; script/DeployMainnet.s.sol.
* Description: the delay is only an initial value (changeDefaultAdminDelay(0) takes effect after 1 day); grantRole and revokeRole for ROUND_MANAGER and PAUSER have no delay; neither the constructor nor DeployMainnet.validate requires admin and round manager to differ.
* Fix: list in README "Owner permissions"; use a multisig for MAINNET_ADMIN; require admin != manager in DeployMainnet.validate (a script change, not a contract change); optionally override changeDefaultAdminDelay to revert.

I7. Completing an admin renounce leaves ROUND_MANAGER and PAUSER permanently unrevocable and unrotatable
* Vote: 1 of 1 upheld. Code reading only.
* Location: constructor (lines 231 to 232); inherited renounceRole.
* Description: after the two step renounce nobody can grant or revoke the other roles: a lost keeper key ends rounds and baseline reveals, a compromised keeper or pauser can never be removed. Operator footgun, not a third party attack.
* Fix: state in "Owner permissions" that the admin must not be renounced while rounds run (revoke PAUSER first if it ever is), or override renounceRole to revert for DEFAULT_ADMIN_ROLE.

I8. setPublicProfile needs no Agent ID for a nameless public profile and never emits the label
* Vote: 1 of 1 upheld. Code reading only.
* Location: setPublicProfile (lines 350 to 363).
* Description: setPublicProfile(true, "") succeeds for any address and emits ProfileUpdated(addr, true, 0); an indexer building the opt in list from this event would ingest non forecasters. The event carries only labelId. No effect on scores; a name the caller does not own cannot be claimed.
* Fix: indexer lists a profile only if the address has a Committed event and rechecks ownerOf(labelId) before showing a name. Optional if reopened: require balanceOf(msg.sender) > 0 when isPublic is true.

I9. A commit cannot be validated when made: non canonical vectors, a changed chain id or a lost salt end in a guaranteed forfeit
* Vote: 1 of 1 upheld. Code reading only.
* Location: commit (318 to 332), _reveal and _checkCanonical (548 to 568), computeCommitHash (468 to 474).
* Description: self inflicted through a buggy client; inherent to commit and reveal. Reusing one salt across overlapping rounds lets observers test guesses of a still hidden forecast.
* Fix: CLI validates canonical packing before hashing, uses a fresh random 32 byte salt per round and per overwrite, and compares a local computeCommitHash with the stored commit.

I10. Reveal transactions sent before a block at or past the commit deadline leak the forecast while commits are still open (client side hypothesis)
* Vote: 1 of 1 upheld. Code reading only.
* Location: reveal and revealFor (lines 337 to 345), _checkRevealWindow.
* Description: an early reveal reverts but its calldata (vector and salt) is public while commit and overwrite are still open. An auto reveal operator also holds vector and salt before the deadline.
* Fix: CLI and keeper send reveals only after reading a latest block whose timestamp is at or past commitDeadline, and simulate first; document the auto reveal operator's visibility.

I11. A committer who skips the reveal in a round where every question is Void still gets a forfeit mark
* Vote: 1 of 1 upheld. Reproduced (assertions added to test_allVoidRound in the verify_23_0 copy).
* Location: forfeit, forfeitBatch, _applyScore.
* Description: roundsForfeited increments with zero questions. Brier and skill are unchanged. The all void state is often only known after the reveal deadline.
* Fix: offchain, ignore Forfeited events with questions == 0 in reliability metrics. Contract option: skip the increment when questions == 0.

I12. Stats.lastRound is the last round first committed to, not the highest round, and is not updated on overwrite
* Vote: 1 of 1 upheld. Code reading only. Location: commit (lines 325 to 329). Nothing onchain reads it.
* Fix: document in NatSpec; indexer derives recency from Committed events.

I13. A front run revealFor makes the forecaster's own reveal revert with AlreadyRevealed (harmless)
* Vote: 1 of 1 upheld. Reproduced (test_skeptic_frontRunReveal in the verify_25_0 copy). Location: revealFor (343 to 345), _reveal. The stored forecast is identical.
* Fix: keeper auto reveal and CLI treat AlreadyRevealed as success.

I14. DuplicateCondition compares conditionId only, not the (ctf, conditionId) pair
* Vote: 1 of 1 upheld. Code reading only. Location: createRound (lines 262 to 264). Stricter than needed, harmless.
* Fix: compare both if the contract is touched for other reasons; otherwise document.

I15. Window minimums are enforced only on chain 56; other chains accept 1 second windows
* Vote: 1 of 1 upheld. Code reading only. Location: constructor (lines 204 to 211), createRound. Documented design (threat 14).
* Fix: state it in the README; never present a non chain 56 deployment as production.

I16. Round struct uses 5 storage slots where 4 would do
* Vote: 1 of 1 upheld. Layout reproduced. Location: struct Round (lines 57 to 70). isSealed and resolutionWait each sit alone in a slot; about one extra cold SSTORE in createRound and one in the sealing transaction (not measured).
* Command: forge inspect ForecastLedger storageLayout --json (inside work_bounds_r2).
* Fix: only if the contract changes for another reason, declare resolutionWait next to isSealed. Skeptic correction: the second suggested fix (narrow createdAt and move isSealed into slot 0) does not reach 4 slots by itself, because resolutionWait would still sit alone.

I17. Areas reviewed with no defect found
* Vote: 1 of 1 upheld. Test results reproduced.
* Reported sound: casts and masks up to 16 questions; sum headroom (a round adds at most 1.6e9 per sum); Round slot 0 exactly 256 bits; computeCommitHash binds typehash, chain id, ledger, round, forecaster, packed and salt, so copying or replay across rounds, chains or ledgers fails, and BASELINE cannot commit; window boundaries are disjoint and consistent; resolutionWait is bounded 1 to 120 days and immutable per round; a forecaster can never be both scored and forfeited; batches reread flags so duplicates are processed once, cap 100; outcomes and masks are write once; forfeit never beats reveal once sealed (fuzz); every revert in _reveal depends only on the forecaster's own inputs; pause gates only createRound and commit; chain 56 guard and immutable minimum windows behave as tested.
* Skeptic correction: the coverage claim that sealing happens between commitDeadline and revealDeadline is wrong. sealRound and the unsealed finalizeQuestion path have no upper time bound. That gap is finding L5.
* PoC: <review workspace>\review_packet\work_score_r2\test\poc\Probe.t.sol
* Command: cd "<review workspace>/review_packet/work_score_r2" && export PATH="$HOME/.foundry/bin:$PATH" && forge test --no-match-path "test/ForecastLedgerFork.t.sol" ; forge test --match-path "test/poc/Probe.t.sol"
* Result: 74 passed, 0 failed with the fork file excluded (71 existing plus 3 probes).
* Fix: none required. Optionally add the duplicate inside one batch probe to the main suite.

4. REFUTED FINDINGS

* A gas burning allowlisted CTF blocks every reveal and seal (reported Low; 0 of 1 upheld). The mechanics pass in a test, but only by etching an infinite loop over the CTF; no actor can make an immutable, non proxy allowlisted CTF burn gas, and such a CTF could corrupt every outcome directly. Kept as optional hardening: a gas cap on the staticcall.
* Nonzero denominator with a reverting payoutNumerators freezes the round (reported Low; 0 of 1 upheld). Reached only with mocked calls; on a Gnosis style CTF with 2 slots the getter cannot revert once the denominator is nonzero. Optional hardening: let voidStale void when a length checked numerator read fails.
* Transient CTF read failure at seal time lets an early resolved question score later (reported Low; 0 of 1 upheld). Needs a getter that fails and then recovers, which an immutable non proxy mapping getter cannot do; caller side gas starvation rolls back the seal. A one line note next to threat 22 is enough.
* Commit gate uses balanceOf while the profile uses ownerOf, so the two could disagree on the real Agent ID (reported Info; 0 of 1 upheld). No divergence is reachable in the packet; the ownerOf side fails closed; the claim depends wholly on unverified behaviour of the real token.

The first three refutations share one premise the packet cannot confirm: the mainnet CTFs are immutable, non proxy contracts with cheap standard getters. See section 5.

5. RESIDUAL RISKS AND ASSUMPTIONS

* Round manager trust. The round manager chooses the questions, conditionId, yesSlot, windows, resolutionWait, and the baseline content, timing and whether it is revealed. Brier is independent of the manager; skill is not. The threat model sentence "the keeper cannot change any score" should read "cannot change Brier scores; the baseline sets skill".
* CTF and oracle trust. All outcomes are read from allowlisted CTFs. To check before mainnet with read only fork scripts: each allowlisted CTF is not a proxy; payoutDenominator and payoutNumerators are cheap plain getters (rerun the gas sweeps against them); prepareCondition and reportPayouts revert for arbitrary callers and the authorised oracle is known.
* Real Agent ID behaviour. Unverified: whether a token can be burned, released or reissued to another wallet and how fast (decides L2 and L3), and whether balanceOf and ownerOf agree for an expired or revoked id (affects the count of distinct holders).
* Offchain components. Keeper, indexer, CLI, agent and site were outside the packet. Several mitigations above live there: prompt sealRound with a watchdog, forfeitBatch from Committed logs, pending forfeit handling, dedupe by tokenId, baseline deviation flags, AlreadyRevealed as success, reveal timing by block timestamp, archiving the baseline vector and salt.
* Admin key. Instant role grants, a reducible admin delay, PAUSER separate from the admin seat, and the renounce footgun should all appear under "Owner permissions"; a multisig admin distinct from the keeper is advised.
* Threat model wording to correct: items 2 and 24 (last look and the keeper only 5 minute rule), 3 (holds per address and only once sealed), 12 (pause effects, PAUSER rotation), 13 (baseline defences are offchain), 18 and 23 (void is not neutral per forecaster), 22 (covers malformed data, not gas).
* Suggested order if the contract is reopened: M1 first (clear text baseline, ideally posted in a short window at the commit deadline, which also closes most of L1 and L4), then L5 (no forfeit on an unsealed round), then L8 and the small Info items that ride along (I11, I14, I16). If the contract stays frozen, every Low and Info item has an offchain or documentation mitigation listed above; M1 then needs the dashboard flag, a pre registered rule for unrevealed baseline rounds, and disclosure.

6. NOT CHECKED

* This report was compiled from the verified results; no test was re run and no source file was reopened in this step.
* No fork tests and no real token or CTF checks, by rule. L2, L3 and three of the four refutations depend on those.
* Skeptics did not run the four alternate PoCs for M1, the second PoC for L2 and L5, or the full suite in most copies. L7, I2, I4, I6 to I10, I12, I14 and I15 rest on code reading only.
* The claim that mean skill is the ranking metric (the basis for Medium on M1) comes from the finders, not from the packet.