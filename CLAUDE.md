# PRESCIENT: rank 1, Agent ID Hackathon Innovation Award

Goal: rank 1 in Track B (Agent Application Innovation Award). Secondary: top 10 in Track A (Pioneer), as a side effect of daily commit and reveal transactions.
Metric: judges' rubric (Agent ID depth 30%, practicality 25%, completion 25%, innovation 20%) plus the hard gate of at least 30 distinct Agent ID holders calling our contracts during the submission period.
Deadline: 9 Dec 2026 08:00 UTC (internal target: filed by 8 Dec 2026 08:00 UTC).
Spec: MASTER_PROMPT.md. It overrides Aurum defaults where they conflict.

## done_when (all at once; re read at every milestone)
1. Contracts live on BSC mainnet (chain 56), verified on BscScan, repo public under MIT, README with an "Owner permissions" section.
2. At least 30 distinct Agent ID holders have called commit during the submission period, counted from logs by our own dashboard. Stretch: 150.
3. At least 7 daily rounds completed end to end (create, commit, reveal, resolve, score) with zero manual score edits.
4. Public site live in English and Simplified Chinese, mobile first: rounds, opt in leaderboard, calibration charts, Agent ID Crowd versus Market.
5. Submission filed at least 24 hours before the deadline, with demo video, docs and the Agent ID usage text.
6. Independent security review with no open High or Medium, and Slither and Aderyn reports clean or fully triaged.

## What rank 1 must be doing (revisit at each milestone)
* Agent ID so central the product cannot exist without it; a live product with real recurring users and real numbers; a 10 second story; polish; bilingual reach.
* Our bet: a track record nobody can fake or buy (non transferable, one per user), plus a crowd forecast scored against a real market benchmark.
* Gap sized risk is distribution, not code: 30 holders through Developer Mode friction.

## Hard rules (from Owais and the spec)
* Never read, print or commit .env. Reference variable names only (see .env.example).
* No deploy and no onchain transaction without Owais's explicit yes, showing action, cost and addresses first.
* Mainnet: separate fresh keys, backed up offline before funding. Never reuse the testnet deployer or keeper keys.
* House rule for repo files: no hyphen or dash in prose, file names, headings or comments unless syntax needs it. No markdown tables. Bullets use "*".
* Never change scoring, eligibility or selection rules after a round opens. Version and announce changes.
* Verify claims onchain or in code; mark the rest as hypotheses. If a spec fact is wrong, stop, log it in notes/knowledge.md, then continue.
* Red lines in MASTER_PROMPT 1.2 are hard requirements.

## Working rules (Aurum)
* Be concise and lead with the result.
* Fable (the advisor) audits against the rank 1 goal. Any doubt: options, 1 or 2 recommended, Owais picks. Reject advice if in doubt it helps.
* Log every evaluated item, kept or dropped, as predicted versus observed in notes/ledger.md.
* This file is the index loaded every turn; keep it under about 10 KB. Details go in notes/*.md, each opening with a summary.

## Now (update at every step)
* **Base / best**: 23 Nov 2026. Ledger v1.1 (per round resolution wait) in code: 74 Solidity (incl. 3 fork), 23 agent, 6 keeper tests pass, coverage 100%, Slither 0 High 0 Medium. Testnet instances A (v1, round 2 running) and B (v1, END TO END OK). Nothing on mainnet, nothing committed.
* **Gap to rank 1**: 0 of 30 holders, 0 of 7 rounds, no deploy, no site. Owais holds owaisahmad.ai (wallet 0x4Db4...282C); Developer Mode off.
* **Running**: round 2 on instance A: settle job at 24 Nov 04:14 UTC (reveal job at 16:09 UTC). Rule v1 census and keeper select smoke test (background).
* **Blocked on**: nothing for testnet. Mainnet needs fresh offline backed keys, the project name (baked into the typehash), and Developer Mode on.
* **Rules**: selection v3 (no sports; daily: all daily crypto plus liquid events, 6 to 72 h, cap 8 Dec, 3 to 8 questions, wait 7 days; long: liquid events 72 h to 100 days, wait 120 days), baseline in the last 5 min before the deadline. Pre registered 23 Nov.
* **Next**: testnet deploy of v1.1 and a fast end to end round with keeper.mjs (open, baseline, seal, finalize, score) instead of the test script; then the independent security review (milestone 3).
* **Human steps open**: enable Developer Mode; keyed RPC (current .env RPCs are public); organizer questions; name, domain, X; GitHub repo for CI. Done: Agent ID claimed, wallet signed in, Predict key verified.
* **Toolchain**: Foundry at ~/.foundry/bin, Slither in .venv, baw global, viem via npm ci. .env now holds private keys: for fork tests export only the RPC, e.g. BSC_RPC_URL="$(grep ^BSC_RPC_URL= ../.env | cut -d= -f2-)" forge test; never source the whole file; redact URLs and 64 hex values in output.

## Notes map (read the summary first)
* notes/ledger.md: experiments (pre registered), daily metrics, submissions, learning log. Read before any decision; append after each.
* notes/audits.md: advisor audits, rubric validator scores, loss map. Read when planning.
* notes/knowledge.md: verified addresses and interfaces, API facts, toolchain, organizer answers, field snapshot. Read before touching contracts, keeper or selection.
* docs/THREAT_MODEL.md and docs/SECURITY.md: threats with tests; Slither triage, coverage, gas.
* scripts/verify/*.mjs: the read only viem scripts behind the VERIFY results.

## History search
* Grep this project's session transcripts before re deriving numbers.

## Secrets
* .env (gitignored). Names expected: see .env.example. Never print, echo or commit values.

## Compute
* Local Windows machine, no WSL. Heavy work is small (Foundry tests, fuzz). Keeper later on GitHub Actions schedule or a small VPS.

## Rejected (don't retry)
* 23 Nov 2026: bsc dataseed for getLogs. Refuses ranges of 2000 blocks; use publicnode or a keyed RPC.
* 23 Nov 2026: trusting the Predict.fun API resolution field. It disagreed with chain payouts on testnet market 1388.
* 23 Nov 2026: ERC8004 registries in the core path. They are upgradeable EIP1967 proxies; stretch only.
* 23 Nov 2026: fork tests at a historical block. Neither RPC keeps archive state ("missing trie node").
* 23 Nov 2026: preparing our own conditions on Predict.fun CTFs in fork tests. prepareCondition reverts for every caller tried, oracles included.
* 23 Nov 2026: Aderyn local build on Windows gnu toolchain (dlltool missing). Use CI.
* 23 Nov 2026: reading Slither severity from the INFO log prefix. Count by impact from --json.
* 23 Nov 2026: sports questions, owner decision 23 Nov, image.
