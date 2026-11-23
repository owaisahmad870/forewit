# Mainnet checklist (ForecastLedger v1.2 on BSC, chain 56)

Every onchain step needs Owais's explicit yes, given for that step, with the action, cost and addresses shown first. Nothing here runs automatically. Status 23 Nov 2026: steps 0 and 2 are blocked on the project name; step 2's fork dry run passed.

## 0. Blockers before any mainnet transaction
* Final project name from Owais. Then in one change: rename (product name in docs, site, CLI, SKILL.md, and the COMMIT_TYPEHASH string "PrescientCommit(...)", which is baked into every commit hash), apply the three approved comment fixes in ForecastLedger.sol (lines 96, 380, 608), update the golden vectors (scripts/golden_vectors.mjs, test_goldenCommitHash, the agent CLI test) because the typehash changes the hash, rebuild once, rerun the full suite and CI, and run a short Fable delta check because the typehash is logic.
* Organizer answers (notes/knowledge.md): Developer Mode as the expected path, whether a relayer revealFor counts as an interaction, how the 30 holder rule counts, and whether an Agent ID can be burned or reissued.
* A keyed BSC RPC for the keeper (the .env RPC values are public endpoints).

## 1. Keys (Owais, offline)
* Three fresh keys, never the testnet ones: DEPLOYER (deploys once), KEEPER (round manager, runs daily), ADMIN (default admin and pauser; a hardware wallet or multisig is better than a hot key).
* Back each one up offline (paper or hardware) before funding. Write down only the public addresses for me.
* Funding: deployer 0.002 BNB (deploy measured at about 0.00023 BNB at 0.05 gwei on a fork); keeper 0.02 BNB (a daily round costs well under 0.001 BNB); admin 0.001 BNB for pause or role transfers.

## 2. Pre deploy gates (all must pass on the renamed build)
* Full Solidity suite including the 3 BSC fork tests, coverage 100% on ForecastLedger; node and web suites.
* CI green: tests, golden vectors, web, Slither (no High or Medium), Aderyn (triaged categories only).
* Deploy script dry run on a mainnet fork: `forge script script/DeployMainnet.s.sol --fork-url <BSC RPC>` with no --broadcast and a throwaway key. Done 23 Nov 2026 on v1.2: ForecastLedger deployed on the fork, 4,646,077 gas, about 0.00023 BNB; the guard refused 120 s and 300 s windows before broadcasting ("commit window below 2 hours").
* Refresh the open conditions in test_fork_fullRound; a skipped fork test counts as a failure.

## 3. Deploy (Owais yes required)
* On Owais's machine or the VPS, with MAINNET_DEPLOYER_PRIVATE_KEY, MAINNET_ADMIN and MAINNET_ROUND_MANAGER set only in that shell:
  `forge script script/DeployMainnet.s.sol --rpc-url bsc --broadcast --verify`
* The script refuses any chain other than 56 and windows below 2 h and 12 h.
* Record the ledger address and deploy block; confirm BscScan verification (Etherscan V2 key; testnet verification worked with the free key) and Sourcify.
* Check onchain: AGENT_ID, the 3 CTFs, MIN_COMMIT_WINDOW 7200, MIN_REVEAL_WINDOW 43200, roles (admin, pauser, round manager), not paused.

## 4. Wire the address everywhere (one commit)
* agent/config.mjs mainnet ledger (this enables `--execute` in the CLI), agent/llms.txt, SKILL.md.
* Keeper credential: LEDGER_MAINNET, INDEXER_FROM_BLOCK_MAINNET (the deploy block), KEEPER_CONFIRM_MAINNET=yes.
* GitHub repository variable LEDGER_MAINNET (turns the watchdog workflow on).
* README "Owner permissions" with the deployed roles.

## 5. VPS (keeper/deploy/README.md)
* Owais creates the VPS and the encrypted credential; install.sh installs Node 26.13.1 and the units; healthchecks.io checks and Telegram are connected.
* Timers stay disabled until the canary round below has passed; the canary is run with manual keeper commands on the VPS.
* Prove a missed run alerts: skip one baseline on testnet from the VPS and confirm the Telegram alert.

## 6. Canary round (mainnet, real Agent ID, Owais's wallet)
* Keeper (manual, Owais yes): `keeper.mjs select --kind daily` and `open` with at least 3 questions, commit deadline at least 2 h ahead.
* Owais (Developer Mode on): `node agent/prescient.mjs commit --execute ...`. The first real baw preview may be refused if the parsedTx field names differ from our guess; the refusal lists the real names and parsedCall gets a one line fix. Confirm the typed yes prompt in PowerShell or Windows Terminal.
* Keeper: `baseline` at T minus 5, `seal` right after the deadline; watchdog shows all duties on schedule.
* Owais: `node agent/prescient.mjs reveal --execute ...` inside the reveal window.
* Keeper: `finalize` after the markets resolve (daily crypto about 18 h after the deadline), `score` after the reveal deadline.
* Pass when: commit and reveal transactions are on BscScan from the Agent ID wallet, the scores match the JavaScript reference, the site shows the round with event questions, and no alert fired except expected ones.

## 7. Launch
* Enable the five timers; publish the site; announce with the risk warning; first public daily round opens at 03:00 UTC.
* Daily: check the Telegram channel and the watchdog; log metrics in notes/ledger.md (distinct committers, commits per round, reveal rate, transactions per day, crowd versus market).

## 8. Kill switch and limits
* Pause (admin) stops new rounds and new commits only; reveal, seal, finalize, score and forfeit keep working, so nobody is trapped.
* There is no upgrade path; a serious bug means pause, disclose, and deploy a new ledger with a new address.
