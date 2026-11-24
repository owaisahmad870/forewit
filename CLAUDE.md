# Forewit: rank 1, Agent ID Hackathon Innovation Award

Goal: rank 1 in Track B (Agent Application Innovation Award). Secondary: top 10 in Track A (Pioneer), as a side effect of daily commit and reveal transactions.
Metric: judges' rubric (Agent ID depth 30%, practicality 25%, completion 25%, innovation 20%) plus the hard gate of at least 30 distinct Agent ID holders calling our contracts during the submission period.
Deadline: 9 Dec 2026 08:00 UTC (internal target: filed by 8 Dec 2026 08:00 UTC).
Spec: MASTER_PROMPT.md. It overrides Aurum defaults where they conflict.

## done_when (FOREWIT_LAUNCH_PROMPT.md 1 wins; re read at every milestone)
1. ForecastLedger live on BSC mainnet, verified on BscScan and Sourcify.
2. At least 30 distinct Agent ID holders committed on mainnet, counted live on /proof. Stretch: 100.
3. At least 7 daily mainnet rounds finalized, so mainnet live by 29 Nov 2026 is a hard limit (Developer Mode lapses about 30 Nov).
4. ForewitScores live with at least one successful onchain verify call.
5. forewit.xyz in English and Chinese, Lighthouse 90+ for performance, accessibility, best practices.
6. Repo public; npm forewit republished with provenance via trusted publishing; MCP Registry listing.
7. Demo video done; submission filed at least 24 h before the deadline with every link checked.
8. Independent review of the mainnet build clean (no open High or Medium); Slither and Aderyn triaged.
* Kill rule (pre registered): fewer than 10 distinct holders committed by 3 Dec 2026 means no new features; all hours go to onboarding and distribution.

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
* **Base / best**: 23 Nov 2026. Renamed to Forewit (forewit.xyz, X @forewitai, Chinese display name 先见). v1.2 Forewit build on testnet instance E 0xa497...12E1: END TO END OK via keeper.mjs; instances A to D deprecated. Repo private on GitHub (owaisahmad870/forewit, renamed 23 Nov 2026). 79 Solidity, 79 node, 27 mcp, 40 web tests and 15 golden vectors pass; CI green on main (24 Nov). MAINNET LIVE 24 Nov 2026: ForecastLedger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6 (block 135450390), BscScan and Sourcify verified, roles read back OK. ForewitScores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc live (verified, 0 epochs). Round 1 (canary) open, 4 questions, commits close 24 Nov 23:00 UTC; keeper on GitHub Actions (KEEPER_NETWORK mainnet).
* **Gap to rank 1**: 0 of 30 holders, 0 of 7 rounds, deployed, no site live. Owais holds owaisahmad.ai (wallet 0x4Db4...282C); Developer Mode on (until about 30 Nov unless used).
* **MCP**: mcp/ package "forewit" (local stdio prepare tools, remote read only HTTP), protocol 2025-11-25 (2026-07-28 when the SDK adds it); 27 tests; salts never in agent context before the commit deadline. Published to npm 24 Nov 2026 as forewit@0.0.1 (account forewitai, "Preview, testnet only", no provenance, latest tag); remote server not hosted. Provenance republish at mainnet launch (needs public repo, CI publish workflow with id-token: write, mainnet ledger pinned in agent/config.mjs). Open: CLI receipt prints the salt at any time (not covered by the MCP salt rule); web/src/commands.ts still shows node agent/forewit.mjs; MCP Registry server.json not made; remote hosting needs a proxy rate limit.
* **Running**: launch prompt Track A (24 Nov). Accounts live: NodeReal (primary RPC, pass), dRPC (fallback, 429 on free plan), healthchecks.io (4 checks), Cloudflare; Google Cloud failed, Oracle signup pending. Keeper bridge: GitHub Actions keeper.yml (night duty), testnet schedule on. Mainnet review: 0 High, 0 Medium; L1 fixed in the deploy script.
* **Blocked on**: Owais: canary commit from owaisahmad.ai before 24 Nov 23:00 UTC, reveal on 25 Nov; Oracle welcome email (Outlook); organizer answers; fork test conditions refresh before deploy.
* **Mainnet keys** (keystores in ~/forewit_keys, 24 Nov): DEPLOYER 0x6732027E7f908E274bF4360Ce19cC182F82d008C, KEEPER 0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18, ADMIN 0xF3b4728B30F0F380d77dE9d025E33680F66591bD. KEEPER funded 0.0048 BNB; ADMIN unfunded; keeper key in GitHub secret MAINNET_KEEPER_PRIVATE_KEY.
* **Rules**: selection v3.1 (no sports, no politics; daily: all daily crypto plus liquid events, 6 to 72 h, cap 8 Dec, 3 to 8 questions, wait 7 days; long: allowlisted tags, liquid, 72 h to 100 days, wait 120 days); event question plus label everywhere; baseline in the last 5 min before the deadline. Pre registered 23 Nov.
* **Next**: keeper postRoot wiring with the two provider check (docs/SCORES.md 5.1), Owais opts in a public label, first root after round 1 is scored; attach forewit.xyz to Pages once the Cloudflare zone is active; MCP Registry listing (mcp-publisher, GitHub device login); mcp vendor copy of forewit agent; Track D (X account, daily posts, demo video). Live: site https://forewit.pages.dev (site.yml redeploys after each keeper run), npm forewit@0.1.0 with provenance, repo public.
* **Human steps open**: move npm_recovery_codes.txt (untracked, D:\Agent ID root) to offline storage and delete it from the project folder; decide whether FOREWIT_LAUNCH_PROMPT.md (untracked) belongs in the repo; organizer questions now include Agent ID burn or reissue (review L2, L3); keyed RPC (current .env RPCs are public); organizer questions; name, domain, X; GitHub repo for CI. Done: Agent ID claimed, wallet signed in, Predict key verified.
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
* 23 Nov 2026: politics questions (both round kinds), image and daily neutrality review; a Politics tag next to Economy or Fed counts as macro.
