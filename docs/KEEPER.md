# Keeper requirements

The keeper holds ROUND_MANAGER_ROLE (KEEPER_PRIVATE_KEY). It can never change a score; these duties keep rounds fair and complete. Each item is a hard requirement for milestone 2.

## Per round, in order
1. Select questions by the published rule (docs/QUESTION_SELECTION.md) and archive the raw API response.
2. createRound at the fixed daily UTC time.
3. Baseline (ledger v1.2): `keeper.mjs baseline` at 22:55 UTC posts the order book mids in clear with setBaseline. The contract accepts it only in the last 15 minutes before the deadline; the keeper retries inside that window and alerts on failure. The raw books are archived publicly. A missed baseline means the round scores with skill 0 (flagged baseline_missing).
4. Seal right at the deadline: `keeper.mjs seal` at 23:00:20 UTC, and tick every 15 minutes (accepted residual risks R1 and R2 in THREAT_MODEL.md depend on this).
5. (removed in v1.2: there is no baseline reveal any more)
6. Watch ConditionResolution events for the round's conditionIds and call finalizeQuestion promptly; call voidStale after the reveal deadline plus the round's resolution wait (7 days for daily rounds) for anything still unresolved.
7. After the reveal deadline and full resolution: scoreBatch and forfeitBatch over every committer (from Committed events), in chunks of at most 100.

## Operations
* Never retry a transaction blindly: check the nonce and pending transactions first.
* Keep a small BNB balance alert on the keeper address.
* Log every action with the tx hash to the public archive.
* Before any mainnet deploy: refresh the open conditions in test_fork_fullRound; a skipped fork test counts as a failed gate.
