# Forewit 先见

A forecasting track record nobody can fake or buy. One Agent ID, one record, scored against the market, on BNB Smart Chain.

* Site: [forewit.xyz](https://forewit.xyz) (start here: [forewit.xyz/#/start](https://forewit.xyz/#/start), live proof: [forewit.xyz/#/proof](https://forewit.xyz/#/proof))
* Docs: [gitbook/](gitbook/README.md) (GitBook source, English and [中文](gitbook/zh/README.md))
* Use it from an agent: `npx -y forewit mcp` (MCP server) or `claude mcp add forewit -- npx -y forewit mcp` in Claude Code; see [For AI agents](gitbook/for_agents/mcp_server.md)
* npm: [forewit](https://www.npmjs.com/package/forewit) (published from GitHub Actions with provenance); MCP Registry: `io.github.owaisahmad870/forewit`

Forecasting scores only. Not financial advice.

## How it works
1. Every day the keeper opens a round of real Predict.fun market questions (rule v3.1: no sports, no politics).
2. Agent ID holders commit a hidden hash of their probabilities before the deadline. The salt stays on their own device.
3. After the deadline they reveal. The contract checks the hash, then scores each forecast with the Brier score against the market price at the deadline.
4. Agent IDs cannot be transferred, so a record cannot be bought, and the Agent ID Crowd cannot be stuffed with sock puppets.
5. ForewitScores publishes a Merkle root of opted in scores, so any contract or agent can verify a Forewit skill onchain.

## Quickstart
* One command on a computer: `npx forewit@latest start` (Windows PowerShell: `npx.cmd forewit@latest start`). It checks the wallet tool, signs you in with a pairing code you approve in the Binance App, checks your Agent ID and Developer Mode, asks your chance for each of today's questions, offers auto reveal (Forewit reveals for you after the deadline from a time locked copy, so there is no second step) and sends only after you type yes. Your results card: [forewit.xyz/#/me](https://forewit.xyz/#/me).
* Step by step on a computer: install the Binance Agentic Wallet CLI, sign in, then `npx -y forewit@0.1.4 round` and `npx -y forewit@0.1.4 commit --execute --from <your Agentic Wallet> --p 60,40,50,30`. Every send shows a preview and waits for you to type yes. Full guide: [gitbook/getting_started/quickstart.md](gitbook/getting_started/quickstart.md).
* From a phone or any browser: make a private copy of [forewit-agent-template](https://github.com/owaisahmad870/forewit-agent-template) and let your own cloud agent (Claude Code on the web, Codex cloud) do the typing: [gitbook/getting_started/play_from_phone.md](gitbook/getting_started/play_from_phone.md).
* The next day, unless you chose auto reveal: `npx -y forewit@0.1.4 reveal --execute --from <wallet> --round <n>`. A commit that is never revealed counts as a forfeit.

## Architecture
```
 Predict.fun markets ──(rule v3.1, published)──> keeper (GitHub Actions, hot key: round manager only)
        │ order books 5 min before the deadline              │ createRound, setBaseline, seal, finalize, score
        ▼                                                    ▼
 baseline (posted in clear, once) ───────────────> ForecastLedger (BSC, non upgradeable, holds no funds)
                                                     ▲   commit: hash only, Agent ID holders only
 you + your agent ── forewit CLI or MCP (prepares,   │   reveal: forecast + salt from your own device
                     never signs) ── baw preview, you type yes ─┘
 indexer (rebuilds everything from events) ──> forewit.xyz (/proof, leaderboard, crowd vs market)
                                          └──> ForewitScores (Merkle roots of opted in scores; verify() onchain)
```

## Threats in one paragraph
Copying others fails because commits are salted hashes until the deadline. Copying the market earns about zero skill, since skill is Brier against the market baseline. Not revealing is a forfeit with the worst score. Buying a record or running many wallets fails because only Agent ID holders can commit and an Agent ID cannot be transferred. The keeper cannot edit any forecast, outcome or score; the baseline is posted in clear inside a 15 minute window before any reveal exists. Accepted risks and every test: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Risk warning
Forewit records forecasting skill only. It takes no deposits, pays nothing and is not financial advice. The only cost is network gas from your own wallet; keep only a little BNB for gas in the Agentic Wallet you use with any agent, and sign out after each session.

## Prior art
* Forecasting platforms (Metaculus, Good Judgment Open) score calibration well, but an account costs nothing to create, so a record can be farmed across many accounts or sold with the login.
* Prediction market profiles rank profit, which rewards capital and timing as much as judgement.
* Onchain reputation tokens can usually be transferred or bought.
* Forewit combines a per person, non transferable identity (Agent ID) with commit and reveal and market relative Brier scoring, so the record is earned, private until the deadline, and owned by one person.

## Contracts (BSC mainnet, chain 56, verified on BscScan and Sourcify)
* ForecastLedger: [0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6) ([source](contracts/src/ForecastLedger.sol))
* ForewitScores: [0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc) ([source](contracts/src/ForewitScores.sol))
* Agent ID (read only, for the commit gate): [0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F)

## Owner permissions
Both contracts are non upgradeable, hold no funds and ask for no approvals. Full detail: [docs/OWNER_PERMISSIONS.md](docs/OWNER_PERMISSIONS.md) and [gitbook/trust/owner_permissions.md](gitbook/trust/owner_permissions.md).
* Admin [0xF3b4728B30F0F380d77dE9d025E33680F66591bD](https://bscscan.com/address/0xF3b4728B30F0F380d77dE9d025E33680F66591bD): grants and revokes roles (the admin seat itself moves only by a two step transfer with a 1 day delay); holds the pause role on ForecastLedger; can revoke any ForewitScores root.
* Keeper [0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18](https://bscscan.com/address/0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18): creates rounds by the published rule, posts the market baseline once in the last 15 minutes before the deadline, seals, finalizes and scores; posts ForewitScores roots and may revoke only the newest two.
* Pause stops new rounds and new commits only; reveal, seal, finalize, score and forfeit keep working, so nobody is trapped.
* Nobody, the admin included, can edit or delete commits, reveals, outcomes or scores, or set a market outcome; outcomes come only from the Conditional Tokens payouts onchain.
* The deployer [0x6732027E7f908E274bF4360Ce19cC182F82d008C](https://bscscan.com/address/0x6732027E7f908E274bF4360Ce19cC182F82d008C) holds no role (read back onchain after each deploy).

## Security
* Independent reviews: [security_review/](security_review/) (mainnet build: 0 High, 0 Medium; ForewitScores and its delta review: 0 High, 0 Medium).
* Threat model with tests: [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md); Slither and Aderyn triage: [docs/SECURITY.md](docs/SECURITY.md).

## Repository
* contracts/ (Foundry), keeper/ (round duties, run by GitHub Actions), indexer/ (site data and score roots), agent/ (zero dependency CLI), mcp/ (MCP servers, npm package forewit), web/ (site), gitbook/ (docs).

## License
MIT, see [LICENSE](LICENSE).
