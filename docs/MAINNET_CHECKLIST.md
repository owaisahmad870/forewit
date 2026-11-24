# Mainnet checklist (ForecastLedger v1.2 on BSC, chain 56)

Every onchain step needs Owais's explicit yes, given for that step, with the action, cost and addresses shown first. Nothing here runs automatically. Status 23 Nov 2026: the Forewit rename is done and its gates passed (below). Open: organizer answers, keyed RPC, fresh keys, then Owais's yes for step 3.

## 0. Blockers before any mainnet transaction
* Done 23 Nov 2026: final name Forewit applied in one change: COMMIT_TYPEHASH label "ForewitCommit(...)", the three approved comment fixes (ForecastLedger.sol lines 96, 380, 608), CLI "forewit", keeper units forewit@.service and forewit_*.timer, site in EN and ZH (display name 先见), docs; golden commit hash regenerated (0x343e0813...d192b8). Delta check: compiled bytecode identical to the previous build once the typehash constant (2 sites) is swapped and the metadata trailer stripped; ABI, storage layout and selectors identical.
* Done 23 Nov 2026: GitHub repository renamed to owaisahmad870/forewit (private); remote, deploy README and CI follow it.
* Organizer answers (notes/knowledge.md): Developer Mode as the expected path, whether a relayer revealFor counts as an interaction, how the 30 holder rule counts, and whether an Agent ID can be burned or reissued.
* A keyed BSC RPC for the keeper (the .env RPC values are public endpoints).

## 1. Keys (Owais, offline)
* Created 24 Nov 2026 as encrypted Foundry keystores in the forewit_keys folder of Owais's home (outside the repo, password typed at the prompt):
  * DEPLOYER 0x6732027E7f908E274bF4360Ce19cC182F82d008C
  * KEEPER 0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18
  * ADMIN 0xF3b4728B30F0F380d77dE9d025E33680F66591bD
* Backup verified: pending (two USB copies, SHA 256 compared with the originals).
* Three fresh keys, never the testnet ones: DEPLOYER (deploys once), KEEPER (round manager, runs daily), ADMIN (default admin and pauser; a hardware wallet or multisig is better than a hot key).
* Back each one up offline (paper or hardware) before funding. Write down only the public addresses for me.
* Funding: deployer 0.002 BNB (deploy measured at about 0.00023 BNB at 0.05 gwei on a fork); keeper 0.02 BNB (a daily round costs well under 0.001 BNB); admin 0.001 BNB for pause or role transfers.

## 2. Pre deploy gates (all must pass on the renamed build)
* Full Solidity suite including the 3 BSC fork tests, coverage 100% on ForecastLedger; node and web suites.
* CI green: tests, golden vectors, web, Slither (no High or Medium), Aderyn (triaged categories only).
* Deploy script dry run on a mainnet fork: `forge script script/DeployMainnet.s.sol --fork-url <BSC RPC>` with no --broadcast and a throwaway key. Done 23 Nov 2026 on v1.2: ForecastLedger deployed on the fork, 4,646,077 gas, about 0.00023 BNB; the guard refused 120 s and 300 s windows before broadcasting ("commit window below 2 hours").
* Refresh the open conditions in test_fork_fullRound; a skipped fork test counts as a failure.
* Renamed build, 23 Nov 2026: 79 Solidity tests including the 3 BSC fork tests, coverage 100% on ForecastLedger, 77 node, 40 web, golden 15 of 15; fork dry run again 4,646,077 gas and the guard still refuses 120 s and 300 s; testnet instance E (0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1, verified on BscScan testnet and Sourcify) END TO END OK through keeper.mjs. Testnet instances A to D are deprecated (old labels).
* Human step: set LEDGER_TESTNET to instance E and INDEXER_FROM_BLOCK_TESTNET to its deploy block in .env; the keeper refuses the deprecated instances.

## 3. Deploy (Owais yes required)
* DONE 24 Nov 2026: ForecastLedger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6, block 135450390, 3,574,338 gas, BscScan and Sourcify verified, roles read back (scripts/verify/mainnet_ledger_check.mjs). Run with scripts/deploy_mainnet.ps1.
* On Owais's machine, with MAINNET_DEPLOYER, MAINNET_ADMIN and MAINNET_ROUND_MANAGER (addresses only) set in that shell; the deployer keystore password is typed at the prompt:
  `forge script script/DeployMainnet.s.sol --rpc-url bsc --keystore <forewit_keys>/deployer --sender <MAINNET_DEPLOYER> --broadcast --verify`
* The script refuses any chain other than 56, windows below 2 h and 12 h, and role addresses that are not three distinct nonzero addresses; after the deploy it reads the roles back and fails if the deployer holds any (review MAINNET_DELTA L1, fixed 24 Nov 2026; fork dry run 4,646,639 gas).
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
* Owais (Developer Mode on): `node agent/forewit.mjs commit --execute ...`. The preview field names were confirmed on a real mainnet preview on 23 Nov 2026 (never executed) and the parser fixed: parsedTx carries only the type, the selector and the target, so execute mode checks those plus empty balance, allowance and authority changes. Confirm the typed yes prompt in PowerShell or Windows Terminal.
* Keeper: `baseline` at T minus 5, `seal` right after the deadline; watchdog shows all duties on schedule.
* Owais: `node agent/forewit.mjs reveal --execute ...` inside the reveal window.
* Keeper: `finalize` after the markets resolve (daily crypto about 18 h after the deadline), `score` after the reveal deadline.
* Pass when: commit and reveal transactions are on BscScan from the Agent ID wallet, the scores match the JavaScript reference, the site shows the round with event questions, and no alert fired except expected ones.

## 7. Launch
* Enable the five timers; publish the site; announce with the risk warning; first public daily round opens at 03:00 UTC.
* Daily: check the Telegram channel and the watchdog; log metrics in notes/ledger.md (distinct committers, commits per round, reveal rate, transactions per day, crowd versus market).

## 8. Kill switch and limits
* Pause (admin) stops new rounds and new commits only; reveal, seal, finalize, score and forfeit keep working, so nobody is trapped.
* There is no upgrade path; a serious bug means pause, disclose, and deploy a new ledger with a new address.
