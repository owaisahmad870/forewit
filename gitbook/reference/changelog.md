---
description: What changed in Forewit and when, newest first.
---

# Changelog

What changed in Forewit and when, newest first.

## 24 Nov 2026

* npm `forewit` 0.1.1 with the `profile` command, published with provenance.
* GitHub secret scanning with push protection, Dependabot and private security reporting turned on; main and release tags protected.
* New page: [Keys, secrets and incidents](../trust/keys_and_incidents.md).
* ForewitScores live on BSC mainnet: [0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc), verified on BscScan and Sourcify. Roles read back: the deployer holds none. No root posted yet.
* ForewitScores review fixes: the keeper can revoke only the newest two epochs; `ForewitGate` also requires the caller's opted in profile; the indexer drops a leaf on any token move after opt in.
* ForewitScores built and reviewed: 0 High, 0 Medium, 3 Low. Membership is opt in only.
* Keeper posts a ForewitScores root after each settled round, built on one RPC provider and checked on a second.
* `forewit profile`: opt in publicly with your Agent ID name, or opt out with `--off`.
* `forewit agent` (your own AI model forecasts, you approve) and `forewit schedule` (a daily job on Windows, macOS and Linux).
* npm `forewit` 0.1.0, published from GitHub Actions with provenance. Mainnet by default.
* Repository made public after a full history secret scan.
* Site live on Cloudflare Pages ([forewit.pages.dev](https://forewit.pages.dev)), redeployed after each keeper run. Custom domain forewit.xyz live since 24 Nov 2026.
* Round 1 opened on mainnet by the keeper: 4 questions (Bitcoin, Ethereum and BNB up or down, Tokyo temperature), [tx 0x6baa5b93...fab1](https://bscscan.com/tx/0x6baa5b935acbbc7f9e49cc6a593a18bda93318b24f9c4e7702977a87b842fab1).
* ForecastLedger v1.2 live on BSC mainnet: [0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6), verified on BscScan and Sourcify. Roles read back: the deployer holds none.
* Mainnet build review: 0 High, 0 Medium; the deploy script role guard added.
* MCP servers: local stdio server with four prepare tools (salts never shown before the commit deadline); remote read only server built, not hosted. npm `forewit` 0.0.1 preview on testnet.

## 23 Nov 2026

* Renamed to Forewit (forewit.xyz, X @forewitai). Commit hash label changed to `ForewitCommit`. Testnet instance E is the only testnet target; instances A to D deprecated.
* Delta review of v1.2: no new High or Medium; safe to deploy given the accepted risks.
* ForecastLedger v1.2: the market baseline is posted in clear, once, only in the last 15 minutes before the commit deadline (review M1 and L4); the pauser role moves with the admin seat (L8).
* First independent review of ForecastLedger: 0 High, 1 Medium, 8 Low.
* Selection rule v3.1 published before any real round: no sports, no politics; daily rounds of 3 to 8 questions.
* ForecastLedger v1.1: a resolution wait per round (1 to 120 days).
* Agent toolkit: the zero dependency CLI, SKILL.md and llms.txt; execute mode with a typed yes.
* ForecastLedger v1 built and run end to end on BSC testnet.
