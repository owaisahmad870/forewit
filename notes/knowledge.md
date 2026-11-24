# Knowledge: sources, rules, field snapshot, verified facts

**Summary (read first):**
* 23 Nov 2026: every VERIFY address in MASTER_PROMPT 3.2, 3.3 and 3.4 has code on the stated chain and the cross references agree. No spec address was wrong.
* CTF interface (getOutcomeSlotCount, payoutDenominator, payoutNumerators) works on all 6 CTFs (3 mainnet, 3 testnet). payoutNumerators reverts on an unprepared condition, so always check slot count first.
* Agent ID: name and symbol match, ERC721 plus metadata, NOT enumerable, transfers and approve revert, holders seen are EOAs, tokenId = keccak256(label) verified on 4 of 4 holders.
* Yes is slot 0 (indexSet 1): testnet 10 of 10, mainnet 38 of 40 checked against chain payouts; the 2 mainnet misses and testnet 1388 are API "Yes/Up" where the chain shows a 50/50 split. Chain is truth.
* Toolchain pinned 23 Nov 2026 (native Windows, see Toolchain). Aderyn could not be built locally; run it in CI.
* Etherscan API V2 key (23 Nov 2026, read only checks): valid (chain 1 account balance OK). Account endpoints on chain 56 and 97 answer "Free API access is not supported for this chain". The contract module works on chain 56 (getabi on USDT OK), so forge verify should work; unproven until the first verify. Fallback: verify by hand on the BscScan website with the standard JSON input, or a paid plan.
* baw wallet chains (23 Nov 2026): Base, BNB Smart Chain (56), Ethereum, Polygon, Robinhood, Solana, Arbitrum One. No BSC testnet, so the Agentic Wallet path (contract-call preview and execute) is first exercised on the mainnet canary round; testnet rounds use the CLI with local keys only.
* BSC TESTNET instance E, ledger v1.2 Forewit build (23 Nov 2026, labels and comments only vs D): ForecastLedger 0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1, MockAgentID 0x7e1e18bb30cd6026A663Aa54e7d83069fa32aF11, MockConditionalTokens 0x9A0283BB4E20789993C14eC6cE1DB7A984b49A54; windows 120 s and 300 s; verified on BscScan testnet (source contains ForewitCommit) and Sourcify exact match. The CLI, keeper and site target E only.
* DEPRECATED 23 Nov 2026: testnet instances A, B, C and D keep the old labels (the pre rename commit typehash), so commits made with the current CLI would not verify there. Do not use them.
* 23 Nov 2026: v1.2 has no baseline identity (the reserved BASELINE address was removed in fix package 1; the baseline is posted in clear by setBaseline), so the requested label "FOREWIT.BASELINE" has nothing to rename. Adding it back would be a logic change.
* BSC TESTNET instance D (deprecated), ledger v1.2 (23 Nov 2026, fix package 1): ForecastLedger 0xfbba24635EbfaAeCd57fc199E4bC217C86fA80Bf, MockAgentID 0xfeDB631E907ac4f32227F487b4d022f36Cb4Ca06, MockConditionalTokens 0x34E842B038e636829704AEAb8a7B65b762973530; windows 120 s and 300 s; agent CLI testnet config points here. Older instances: C 0x0327...54bE (v1.1), B 0xB27E...ED80d and A 0x73FF...5fC3 (v1).
* BSC TESTNET deploy (23 Nov 2026, Owais yes, testnet only):
  * ForecastLedger 0x73FFFB21A497d173f1C3581467Ca1F7385655fC3 (MAX_RESOLUTION_WAIT 7 days; allowlist: mock CTF plus the 3 Predict.fun testnet CTFs; admin and pauser deployer, round manager keeper).
  * MockAgentID 0xF48FD3447f5D9012a572Bd4F4c79080a01596c72, MockConditionalTokens 0xB5693815550deB69992cbF4814AAe3bCD0442f08.
  * The cancun bytecode (PUSH0, MCOPY) deployed and ran on BSC testnet: createRound, commit and commitBaseline all succeeded. Proof for decision 2, pending the reveal and settle phases.
  * Verification: all three verified on BscScan testnet via Etherscan V2 with the free key (the queue took minutes), plus Sourcify exact matches for the mocks. So free key verification works on BSC. Instance B ledger 0xB27E432b871bDae0f558b0F1b4C87d5aCb2ED80d submitted (GUID wkp7zvtg...); its mocks matched already verified bytecode.
  * Funding tx deployer to keeper 0.05 tBNB: 0x10acbb919568099f361ffd148764d7822b2e249ca468b2737005f1351a77e2ae.
  * Round 1: created (tx 0xe818aa55...15fb) but left empty: my script failed to save salts (BigInt serialization) before any commit was sent. Harmless; nobody committed.
  * Round 2 (end to end run): 3 mock questions (to resolve Yes, No, split), commit deadline 23 Nov 16:08:03 UTC, reveal deadline 24 Nov 04:13:03 UTC. createRound 0x59e15b9f...acb4, commitBaseline 0xef97ed10...d153, deployer commit 0x2c3e20ec...c3d8, keeper commit 0x44b9a634...74ff. Plan: keeper reveals the baseline (seals), revealFor the deployer (relayer path), keeper never reveals (forfeit path), resolve and finalize, then scoreBatch and forfeitBatch and compare stats with the JavaScript reference.
  * Measured gas on testnet: commit 100,920; commitBaseline 50,477; createRound with 3 questions 222,445 to 239,533.
  * Windows note: keeper/state is gitignored but mode 0600 is not enforced on NTFS; the agent CLI needs a Windows ACL or a home directory location.
* baw 1.12.0 behaviour seen by the execute mode subagent (read only calls, 23 Nov 2026): devMode.expiresAt is ISO text with offset (for example 2026-11-30T17:24:46+05:00), not unix seconds as the docs say; errors come back as JSON on stdout with exit code 1; tx-history --type pending returns {transactions, hasMore, nextCursor}; tx-lock returned UNLOCKED. On Windows the npm baw.cmd shim needs a shell, so the CLI runs the package's dist/index.js with node instead.
* Owais's wallet: Developer Mode now ENABLED (dailyLimit 1000, balanceExceeded false, expires about 30 Nov 2026 12:24 UTC unless used).
* Unknown until the mainnet canary: the parsedTx field names baw returns for a contract call preview (docs only show a send). agent/lib/baw.mjs parsedCall guesses and fails closed, listing the real field names on refusal.
* Project wallets (generated locally 23 Nov 2026, keys only in .env, never printed): deployer 0x04ca5c9c38Ac62D48fdA6FE5328dB4a0edEE4b7A (admin and pauser), keeper 0xdCdE642B2DA60be15048F14ecB801578098B2E5F (round manager). Both unfunded at creation.
* Testnet deploy dry run (forge script, no broadcast, 23 Nov 2026): MockAgentID, MockConditionalTokens, ForecastLedger allowlisting the mock plus the 3 Predict.fun testnet CTFs; 5,378,005 gas, about 0.00054 tBNB at 0.1 gwei.
* Owais's Agentic Wallet (23 Nov 2026): BSC address 0x4Db416bAF0127AdCa78e7571038b763868ff282C (same EVM address on Ethereum, Polygon, Arbitrum, Base, Robinhood). baw wallet agent-id: claimed, owaisahmad.ai. Onchain: Agent ID balanceOf = 1, ownerOf(keccak256("owaisahmad")) = that address, no contract code (plain account), 0.00179 BNB. Developer Mode off. Session expires 25 Nov 2026 12:15 UTC.

## Method (all checks)
* Tool: viem 2.58.4 readContract, getStorageAt, eth_call and eth_getLogs, because cast and forge are not installed yet. Scripts: scripts/verify/*.mjs (need viem installed next to them).
* RPC: mainnet https://bsc-rpc.publicnode.com and https://bsc-dataseed.bnbchain.org; testnet https://bsc-testnet-rpc.publicnode.com. Mainnet head at check time: block 135265147, 23 Nov 2026 about 11:40 UTC.
* RPC fact: bsc dataseed refuses eth_getLogs even for 2000 blocks ("Request exceeds defined limit"). publicnode serves 5000 block ranges. Use publicnode or a keyed RPC for the indexer.
* Redo all mainnet checks with cast once Foundry is installed, and put them in fork tests.

## Verified (VERIFY items from MASTER_PROMPT)
* Agent ID 0x60b9262456de011f7d15a54cdd8c48baaa8b022f (mainnet):
  * code 8756 bytes; no EIP1967 implementation, admin or beacon slot set, so not a standard proxy.
  * name() "SPACE ID Agent ID", symbol() "AI". supportsInterface: ERC721 0x80ac58cd true, metadata 0x5b5e139f true, enumerable 0x780e9d63 false, ERC5192 0xb45a3c0e false.
  * totalSupply() reverts. Holder counts must come from Transfer logs.
  * balanceOf(0x...dEaD) = 0; balanceOf(holder 0xcba4...61d5) = 1; ownerOf(token) = that holder.
  * Simulated transferFrom, safeTransferFrom and approve from the owner all revert: non transferable (simulation evidence only; burn or reissue paths unchecked).
  * Holder 0xcba4...61d5 has no code (EOA). The mint tx was sent by the holder itself to the Agent ID contract, selector 0x8580974c.
  * Mint rate: 35 mints in about 5000 blocks (about 37 min), so roughly 1300 new holders per day (one sample window).
  * tokenURI = https://agentid.prd.space.id/metadata/<label>.json.
  * Name binding: tokenId == uint256(keccak256(bytes(label))) with label WITHOUT ".ai". Verified on 4 of 4 recent mints (labels from tokenURI). Profile binding via ownerOf(keccak256(label)) == msg.sender is usable.
* Predict.fun mainnet contracts (all have code):
  * CONDITIONAL_TOKENS 0x22DA1810B194ca018378464a58f6Ac2B10C9d244, 18229 bytes. Recent resolution oracle 0x77620fab2969df2d5696f1f081940e416cf17ca5 (contract, 11556 bytes). Resolution tx sent from EOA 0x51e9d3c2bda9b455ffaea343a664b038710977aa to 0xf3b45d966e2c285876c66d4a27a7fb23f3d8abd9 (selector 0x805f2132).
  * YIELD_BEARING_CONDITIONAL_TOKENS 0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F, 23238 bytes (different bytecode from the standard CTF), oracle 0x947cc06d38d3cb0a2bb5adfb668b99b4ff53d7b4. Active: 11 resolutions in the last 35000 blocks.
  * YIELD_BEARING_NEG_RISK_CONDITIONAL_TOKENS 0xF64b0b318AAf83BD9071110af24D24445719A07F, 18229 bytes, oracle 0x41dce1a4b8fb5e6327701750af6231b7cd0b2a40. Active: 5 resolutions in the last 55000 blocks.
  * None of the three CTFs has an EIP1967 slot set.
  * CTF_EXCHANGE 0x8BC070BEdAB741406F4B1Eb65A72bee27894B689: getCtf() = CONDITIONAL_TOKENS, getCollateral() = USDT.
  * NEG_RISK_CTF_EXCHANGE 0x365fb81bd4A24D6303cd2F19c349dE6894D8d58A: getCtf() = NEG_RISK_ADAPTER, getCollateral() = USDT.
  * NEG_RISK_ADAPTER 0xc3Cf7c252f65E0d8D88537dF96569AE94a7F1A6E: ctf() = CONDITIONAL_TOKENS, col() = USDT. So the standard and neg risk CTF are the same address, as the spec says.
  * USDT 0x55d398326f99059fF775485246999027B3197955: symbol USDT, decimals 18.
* Testnet CTFs 0x2827AAef52D71910E8FBad2FfeBC1B6C2DA37743 (18229 bytes), 0x38BF1cbD66d174bb5F3037d7068E708861D68D7f (23238), 0x26e865CbaAe99b62fbF9D18B55c25B5E079A93D5 (18229): same bytecode sizes as mainnet, same interface.
* CTF interface (all 6): getOutcomeSlotCount(bytes32) returns uint256; payoutDenominator(bytes32) returns uint256; payoutNumerators(bytes32,uint256) returns uint256 (public array getter, reverts when index >= slot count or condition unprepared).
  * Resolved mainnet example 0xd3b9db96de881083b81790eeae9f6c453ccd9bb6536912e8f78709f7630c54fc: slots 2, denominator 1, numerators [0, 1].
  * Testnet resolved binary markets show denominator 1 with [1,0] or [0,1], and one split [1,1] over 2.
  * Spec rule "Yes when numerator[yesSlot] == denominator, No when 0, else Void" fits every case seen.
* ERC8004 (stretch only): IdentityRegistry 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (name "AgentIdentity", getVersion "2.0.0") and ReputationRegistry 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 (getVersion "2.0.0") are 130 byte EIP1967 proxies, implementations 0x7274e874ca62410a93bd8bf61c69d8045e399c02 and 0x16e0fa7f7c56b9a767e34b192b51f921be31da34. Upgradeable: never depend on them in the core.

## Fork and RPC facts (23 Nov 2026)
* BSC_RPC_URL and BSC_TESTNET_RPC_URL in .env hold public endpoints (the secret scan found their values in our notes and scripts), so human step 3 (a keyed RPC) is still open. That RPC keeps no archive state: a block about 10000 back returns "missing trie node". publicnode refuses archive reads without a personal token. Fork tests run at the latest block.
* Cancun partial proof (23 Nov 2026): ForecastLedger runtime has PUSH0 (315) and MCOPY (1); a simulated create on live BSC mainnet succeeded (eth_estimateGas 3,599,991; 15,551 runtime bytes). About 0.00018 BNB to deploy at 0.05 gwei.
* Predict.fun CTF 0x22DA... reverts prepareCondition (empty revert data) for every caller tried: the test, the resolution oracle 0x7762..., the router 0xf3b45d96..., the NegRisk adapter and the EOA that sends preparation txs. Unlike stock Gnosis, preparation is restricted. Real preparation txs go from an EOA to 0xf3b45d966e2c285876c66d4a27a7fb23f3d8abd9 (selector 0x805f2132), the same router used for resolutions.
* BSC gas price 0.05 gwei (cast gas price, 23 Nov 2026).

## Predict.fun API (checked 23 Nov 2026)
* Docs (dev.predict.fun, read 23 Nov 2026 by a web fetch subagent): GET /v1/markets filters are status=OPEN|RESOLVED, sort, marketVariant, tagIds, hasActiveRewards, includeStats, first (1 to 100), after. tradingStatus is not a filter. Markets carry NO end or resolution time; the only end time is endsAt (and tradingSession.closesAt) on GET /v1/categories/{slug}. Orderbook: GET /v1/markets/{id}/orderbook gives asks and bids as [price, shares] priced in the indexSet 1 outcome, plus updateTimestampMs. Limits: 250 per minute for markets and categories, 500 per minute for orderbook and quotes; HTTP 429 when exceeded. The spec's api.predict.fun/docs URL returns 404.
* Rule v1 census (23 Nov 2026 about 14:15 UTC, commit deadline assumed 20 h out, first 6000 open markets, 570 categories): category endsAt 24 to 72 h after the deadline for 845 markets; 437 keep Yes/No or Up/Down names; 206 have a two sided book; 189 have spread <= 0.10. All 189 are sports (110 exact score, 48 match, 27 halftime, 4 other), most with zero 24 h volume. No crypto or real world event market fell in the window. Hypothesis to check: endsAt is the category end, and resolution follows it after the oracle step.

* Mainnet https://api.predict.fun/v1/markets without a key returns HTTP 401 "unauthorized". Testnet https://api-testnet.predict.fun/v1/markets works without a key.
* Pagination: query first=N, response field cursor, next page with after=<cursor>.
* Market fields seen: id, title, question, description, tradingStatus, status, isVisible, isNegRisk, isYieldBearing, feeRateBps, resolution, oracleQuestionId, conditionId, resolverAddress, outcomes, questionIndex, spreadThreshold, categorySlug, createdAt, decimalPrecision, marketVariant, variantData, marketType, polymarketConditionIds, kalshiMarketTicker, stats, and more.
* outcomes[] carry name, indexSet, onChainId (= positionId), status, and bestBid and bestAsk {price, size}. So the list endpoint already gives top of book.
* Which CTF: isYieldBearing false, any negRisk: standard CTF (testnet: 6 resolved markets, all standard). isYieldBearing true and isNegRisk true: yield bearing neg risk CTF (testnet: 4 of 4). isYieldBearing true and isNegRisk false: untested, assume YB CTF and check onchain in the selector (getOutcomeSlotCount > 0 on exactly one allowlisted CTF).
* Mainnet check (23 Nov 2026, scripts/verify/mainnet_yes_slot.mjs, key from .env, header x-api-key): first 100 markets of /v1/markets were all RESOLVED. Shapes: 17 std CTF Yes/No, 9 neg risk std CTF Yes/No, 8 yield bearing (not neg risk) on YB CTF 0x9400 Up/Down, 5 YB neg risk on 0xF64b Yes/No, 1 std "Knicks/Spurs". So the YB, not neg risk, mapping is now confirmed. Of 40 checked against chain payouts, 38 have the API winner at slot indexSet minus 1; markets 429 and 430 say Up in the API but the chain shows [1,1] over 2 (split, Void for us). Open markets need a status filter (not yet tested).
* Yes slot: indexSet 1 = slot 0 is Yes (or Up) on 10 of 10 resolved testnet markets checked against chain payouts. Outcome names vary: Yes/No, Up/Down, and one "Definitely/Maybe". Selection rule: accept only markets whose indexSet 1 name is Yes or Up and indexSet 2 is No or Down; key on indexSet, never on name. Mainnet confirmation pending the API key.
* Hypothesis broken: the API resolution field is not truth. Testnet market 1388 says resolution Yes, but onchain payouts are [1,1] over 2 (a 50/50 split, Void under our rule). Our contract reads the chain only; the indexer must too.
* Resolution oracles differ per CTF (see above). Trust assumption to disclose: Predict.fun controls the resolver path.

## Toolchain facts (23 Nov 2026)
* Installed: node v26.13.1, npm 11.20.0, git 2.56.1, curl. Missing: forge, cast, anvil, slither, aderyn, python, jq. WSL is not usable (REGDB_E_CLASSNOTREG).
* Spec update (Owais, 23 Nov 2026): Node 26 everywhere, including GitHub Actions. This replaces the spec's Node 22.
* Platform choice: native Windows, not WSL2. WSL is broken here (REGDB_E_CLASSNOTREG) and enabling WSL2 needs admin, a Windows feature change and a reboot; Foundry ships official Windows builds.
* Pinned installs (23 Nov 2026):
  * Foundry v1.10.0 (forge, cast, anvil, chisel), commit 083e22994195d6a7e3ad3104d0b57f478c9b9062, official zip foundry_v1.10.0_win32_amd64.zip, sha256 7228dda08fdee1d1aa0210b171285f12734e19dbbbb23611c0669e97202e880b (matched the release .sha256), in ~/.foundry/bin (not on PATH; scripts export it).
  * Python 3.13.17 (winget, user scope). Project venv .venv (gitignored) with slither analyzer 0.11.6.
  * Rust 1.91.1, x86_64 pc windows gnu toolchain, ~/.cargo (not on PATH), installed only to build Aderyn.
  * Aderyn 0.6.8: NOT installed. No Windows release binary exists, crates.io has only 0.0.0, and the source build from tag aderyn v0.6.8 fails on the gnu toolchain ("dlltool.exe not found"). Options: run Aderyn in GitHub Actions on Ubuntu (recommended), or install MSVC Build Tools.
  * forge std v1.17.0 (f3dae6e), OpenZeppelin Contracts v5.7.0 (cab19933c33c2ad1d4c7a84864a3601dddfd16f3, package.json 5.7.0), as git submodules in contracts/lib.
  * solc 0.8.39 with evm_version = "cancun" set explicitly in contracts/foundry.toml (Owais decision). To be proven by the fork test and the testnet deploy.
  * baw: npm @binance/agentic-wallet 1.12.0 (global). npm skipped install scripts for @github/keytar, but the package ships a prebuilt keytar.node and sign in persisted.
  * Skill: binance agentic wallet skill 1.15.0 (requiredCliVersion 1.12.0) from github.com/binance/binance-skills-hub commit 7d1b1f78d525f9e653b96819f91a549302fda1da, copied to ~/.claude/skills/. baw skill check says latest is 1.15.0.
* OpenZeppelin decision (Owais): 5.7.0 from the GitHub tag, pinned. npm still lists it under the "dev" dist tag.
* baw facts from the skill (verified in its references, 23 Nov 2026): sign in is auth signin then auth verify (pairing code plus QR, about 5 min expiry); contract calls are contract-call preview then contract-call execute with requestId; check devMode with wallet settings; Developer Mode lasts 7 days and each use extends it; Agent ID status with wallet agent-id. Full syntax: ~/.claude/skills/binance-agentic-wallet/references/external-sign.md.

* MCP SDK (24 Nov 2026): @modelcontextprotocol/sdk 1.32.2 is latest on npm; the split @modelcontextprotocol/server 2.4.0 also exists. Both have LATEST_PROTOCOL_VERSION 2025-11-25 and answer an initialize for 2026-07-28 with 2025-11-25 (checked by sending initialize to each). The 2.4.0 core only mentions 2026-07-28 in doc comments. The mcp/ package uses 1.32.2; its remote test asserts the fallback, so an SDK that adds 2026-07-28 shows up as a test change. In 1.32.2 input validation failures come back as isError tool results, not protocol errors. npm name "forewit" was free on 24 Nov 2026; published 24 Nov 2026 as forewit@0.0.1 by npm user forewitai (2FA with a security key, no org; the @forewitai scope is the user scope). Publishing from here: run npm.cmd publish --access public --auth-type=web in an interactive terminal tab (a background shell fails with EOTP; PowerShell blocks npm.ps1); a new version is served as 0.0.0-stage for about a minute. The package copies agent/config.mjs at pack time, so 0.0.1 targets testnet instance E only.

## Rules and facts (sourced, dated)
* Hackathon rules: MASTER_PROMPT 1.2, researched 23 Nov 2026. Submission window 18 Nov 2026 08:00 UTC to 9 Dec 2026 08:00 UTC.
* Organizer answers (section 2 item 7): pending.
  * Developer Mode the expected path?
  * Relayer revealFor counts as an interaction?
  * 30 holder rule counts distinct callers of submitted contracts?
  * (added 23 Nov 2026, review L2 and L3) Can an Agent ID be burned, revoked or reissued to a different wallet (by the user or by the issuer), and if so how fast? The contract has an owner and admin functions we cannot name from bytecode.

## Field snapshot (the "leaderboard")
* 23 Nov 2026, us: 0 contracts, 0 of 30 committing holders, 0 of 7 rounds, no product live. Rubric validator score: not yet run.
* Other Agent ID builders visible on npm (likely hackathon entries, hypothesis): bbf-mint-cli, aiwars, @gangfun/cli, @agentswap/cli, goldenfarm-agent, agentnftmarket. Mostly launchpads, mints and trading. None seen so far is a forecasting or reputation product.

## Assets (licence, provenance)
* viem 2.58.4 (MIT), used for checks only so far.

## Keeper VPS options (A1, official pages, accessed 24 Nov 2026)
* Pick: Google Cloud e2-micro (us-east1, us-central1 or us-west1), free with no end date, no documented idle reclaim; non prepaid card needed, Pakistan card acceptance unverified. Egress 1 GB a month from North America: keeper plus indexer estimated about 0.2 GB a month (a few thousand small JSON calls a day), hypothesis until measured; watch it. Free external IPv4: unverified. Sources: docs.cloud.google.com/free/docs/free-cloud-features, docs.cloud.google.com/billing/docs/how-to/payment-methods.
* Second: AWS Free plan (100 USD credit, ends after 6 months or when credits run out; t3.micro, t4g.micro, t4g.small). Covers the 9 Dec deadline. Card and Pakistan rules unverified. Source: docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html.
* Rejected: Oracle Always Free. Its idle rule (7 days with CPU p95 under 20%, network under 20%, memory under 20% on A1) matches a mostly idle keeper; reclaim has no stated notice. Source: docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm.
* Rejected: Azure free account (must move to pay as you go within 30 days or the account is disabled). Source: azure.microsoft.com/en-us/pricing/purchase-options/azure-account.
* Paid fallback (owner decision, not bought): Hetzner CX23, 2 vCPU, 4 GB, 5.99 EUR a month excl. VAT; CPX02 5.49 EUR. Source: hetzner.com/cloud/cost-optimized.
* No free tier states an SLA; the GitHub Actions watchdog is the second, independent trigger, and systemd timers use Persistent=true.

## Keyed BSC RPC options (A2, official pages, accessed 24 Nov 2026)
* Pick: primary NodeReal MegaNode Free (10M CU a month, 150 CUPS, getLogs 50 CU, free archive on BSC, no card; nodereal.readme.io/docs/pricing-plan.md), fallback dRPC Free (50M CU per 30 days, 25 RPS, 2 s timeout, 10,000 logs per response; drpc.org/pricing). getLogs range limit of both: unverified, test one 5000 block call each with the real key before mainnet.
* Usable third: Ankr Freemium (200M credits, about 30 rps, getLogs 1000 blocks on BSC; ankr.com/docs/rpc-service/service-plans).
* Unusable for the indexer: Alchemy Free (getLogs 10 blocks), QuickNode trial (5 blocks), Chainstack Developer (100 blocks, overage billed). GetBlock and Infura BSC free limits unverified.
* Code check: indexer/build.mjs and keeper.mjs committers() already halve the getLogs span on range errors (5000 down to 50), and publicnode stays last in the fallback chain, so a small provider range limit degrades speed, not correctness.
* 24 Nov 2026 update: Google Cloud signup failed for Owais at billing; switched to Oracle Always Free (Owais choice). Pakistan is in Oracle's billing country list (seen on signup.cloud.oracle.com). Plan: A1 Flex (1 OCPU, 6 GB), Ubuntu 24.04, SSH key ~/.ssh/forewit_vps (ed25519, this machine only). Idle reclaim risk accepted with alarms: healthchecks.io dead man checks and the GitHub watchdog fire within 30 min if the VM stops. GitHub Actions schedule is not a primary trigger: runs can be delayed 5 to 30 min or dropped under load (secondary sources), which breaks the 15 min baseline window.

## Organizer questions (draft 24 Nov 2026, not sent; needs the official channel and Owais's yes)
* Channel: not found by web search (no public page for this hackathon's Telegram, Discord or form surfaced); ask Owais for the announcement link.
* Draft message: "Hi, we are building Forewit (forecasting track record for Agent ID holders on BSC) for the Agent Application Innovation Award. Four questions: 1. Is Binance Agentic Wallet Developer Mode (contract call preview and execute) the intended path for Agent ID holders to call third party contracts? 2. Our reveals can be sent by a relayer (revealFor) on behalf of the holder; does a holder count as interacting when their commit came from their Agent ID address and the reveal from a relayer? 3. How are the 30 distinct Agent ID addresses counted: msg.sender of transactions to our verified contracts during 18 Nov to 9 Dec 08:00 UTC, holding an Agent ID at that block? 4. Can an Agent ID be burned or reissued to a different address? We key reputation to the token id. Thank you."
