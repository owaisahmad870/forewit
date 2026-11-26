# Security policy

Forewit (先见) is a forecasting record on BNB Smart Chain. It holds no funds and asks for no token approvals, but its records and keys still matter. Thank you for helping keep users safe.

## Report a vulnerability
* Please report privately through GitHub: [Report a vulnerability](https://github.com/owaisahmad870/forewit/security/advisories/new). Do not open a public issue for a security problem.
* Include what you found, how to reproduce it, and the impact you expect. We reply within 72 hours.

## Scope
* Contracts on BSC mainnet: ForecastLedger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6, OpenForecasts 0xa034D7B62d04c8c4ac57a8C62047015C00DD6404, ForewitScores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc and ForewitStart 0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A.
* The keeper, indexer, site (forewit.xyz), CLI and MCP server in this repository, and the npm package forewit.
* The agent template owaisahmad870/forewit-agent-template.

## What we never do
* We never ask for a seed phrase, private key, password, API secret or pairing code.
* We never hold user wallet sessions or user salts on our servers, and never send a transaction for a user.
* Every transaction a user sends has value 0 and goes only to the ledger above.

## For users
* Keep only a little BNB for gas in the Agentic Wallet you use with Forewit, and sign out of baw after each session.
* Keep your receipts (they hold your salt) private until you reveal.
* Reviews, threat model and accepted risks: [security_review/](security_review/), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), [docs/SECURITY.md](docs/SECURITY.md).
