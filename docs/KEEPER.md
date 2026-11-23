# Keeper requirements

The keeper holds ROUND_MANAGER_ROLE (KEEPER_PRIVATE_KEY). It can never change a score; these duties keep rounds fair and complete. Each item is a hard requirement for milestone 2.

## Per round, in order
1. Select questions by the published rule (docs/QUESTION_SELECTION.md) and archive the raw API response.
2. createRound at the fixed daily UTC time.
3. Baseline at the commit deadline (Owais rule, 23 Nov 2026): run `keeper.mjs baseline` in the last 5 minutes before the deadline (schedule it about 3 minutes before). It refuses earlier than 5 minutes or at the deadline, snapshots each book mid (falls back to the last trade and alerts if a side is empty), stores the salt with current user only access, archives the raw books, then commits the hash. createRound (`open`) no longer takes a baseline.
4. Seal right at the commit deadline: call sealRound (or revealBaseline, which also seals) within minutes of the deadline. Any question that resolves before the seal is voided, so a late seal voids fair questions.
5. revealBaseline early in the reveal window, with alerting and retries (Owais condition for deviation 4, 23 Nov 2026):
   * first attempt within 15 minutes of the commit deadline;
   * on failure, retry with backoff and alert a human (for example a Telegram or email notification) immediately;
   * escalate if still unrevealed 12 hours before the reveal deadline;
   * the contract refuses a baseline reveal after the reveal deadline, and the round is then scored without a baseline (skill 0 for everyone in that round).
6. Watch ConditionResolution events for the round's conditionIds and call finalizeQuestion promptly; call voidStale after the reveal deadline plus the round's resolution wait (7 days for daily rounds) for anything still unresolved.
7. After the reveal deadline and full resolution: scoreBatch and forfeitBatch over every committer (from Committed events), in chunks of at most 100.

## Operations
* Never retry a transaction blindly: check the nonce and pending transactions first.
* Keep a small BNB balance alert on the keeper address.
* Log every action with the tx hash to the public archive.
* Before any mainnet deploy: refresh the open conditions in test_fork_fullRound; a skipped fork test counts as a failed gate.
