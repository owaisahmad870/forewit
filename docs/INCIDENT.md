# Incident runbook (operators)

Summary: the public version is gitbook/trust/keys_and_incidents.md. This file holds the exact commands. Every transaction here needs Owais's explicit yes first, like any mainnet transaction.

## Before any incident (keep true at all times)
* ADMIN 0xF3b4728B30F0F380d77dE9d025E33680F66591bD must hold gas, about 0.002 BNB (each role change costs about 0.0001 BNB). Today it holds 0, so a leaked keeper cannot be revoked until someone funds ADMIN. Fund it now, not during an incident.
* The admin keystore opens: `cast wallet address --keystore ~/forewit_keys/admin` prints the ADMIN address. Offline copies checked the same way.
* A spare keeper keystore exists, created with `cast wallet new` and backed up offline, unfunded until needed.

## Severity (decide in the first 5 minutes)
* P1: a team key is used by someone else, or an admin event nobody planned (role grant or revoke, pause, admin transfer). Act now, every step below.
* P2: a team key may be exposed (pasted, committed, logged) but no onchain use yet. Rotate today.
* P3: a service token leaked, or a keeper duty missed (baseline, seal). Fix within the day.
* P4 and P5: anything else (a docs error, a site bug). Normal work.

## Help from outside
* SEAL 911 (Security Alliance emergency response, free): the Telegram bot @seal_911_bot (https://t.me/seal_911_bot), source github.com/security-alliance/seal-911. Open a ticket in the bot. Anyone who then contacts us directly must repeat the keyword sentence we gave in that ticket; anyone else is not SEAL.
* Use it for P1 only. Our contracts hold no funds, so the usual job is a second pair of eyes on what the attacker can still do.

## Where alerts arrive
* Keeper alerts (including every admin event on both contracts, checked on each tick) are comments on the GitHub issue set in the repository variable ALERT_ISSUE_NUMBER; GitHub emails the owner. Healthchecks emails a missed tick, daily or night ping.

## Keeper key leaked (MAINNET_KEEPER_PRIVATE_KEY)
1. Stop the keeper: disable the keeper workflow (`gh workflow disable keeper.yml`) so the old key stops sending.
2. Revoke the role on both contracts (admin keystore, password typed by Owais):
   * `R=$(cast keccak ROUND_MANAGER_ROLE)`
   * `cast send 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6 "revokeRole(bytes32,address)" $R 0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18 --keystore ~/forewit_keys/admin --rpc-url $BSC_RPC_URL`
   * the same call on ForewitScores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc
3. Grant ROUND_MANAGER_ROLE to the spare keeper on both contracts (`grantRole(bytes32,address)`), fund it with about 0.005 BNB, replace the GitHub secret with `gh secret set MAINNET_KEEPER_PRIVATE_KEY` (Owais pastes, never printed), update KEEPER in agent/config.mjs, the operator lists (indexer, checker KNOWN, docs) and redeploy the site.
4. Read back: `hasRole` false for the old key and true for the new one on both contracts.
5. Damage check: RoundCreated, BaselineSet, RootPosted and RootRevoked events sent by the old key since the leak. Revoke wrong roots with the admin (`revokeRoot(uint256,string)`), repost correct ones, and list affected rounds.
6. Announce within 24 hours: changelog (EN and ZH), X, and the ledger.
7. Re enable the keeper workflow.

## Signing with the multisig (after the admin moves to a Safe)
* Every signer checks the Safe transaction hash on the hardware wallet screen against an independent tool before signing: pcaversaccio/safe-tx-hashes-util (`./safe_hashes.sh --network bsc --address <safe> --nonce <n>`, BSC chain 56 supported). Never trust only the hash or the decoded call shown by the Safe web app.
* Decode the calldata independently (cast 4byte-decode or the contract source) and check the target is one of our two contracts.
* Confirm on a second channel (a call or a message on another app) that the other signers expect this exact nonce and action.

## Admin key leaked
1. If a pending admin transfer exists (`pendingDefaultAdmin()`), cancel it at once with `cancelDefaultAdminTransfer()` on both contracts.
2. Revoke any role the attacker granted (read RoleGranted events since the leak).
3. Begin the admin transfer to a fresh key or the Safe (`beginDefaultAdminTransfer(address)`), accept after the 1 day delay.
4. Announce as above.

## Service token leaked (RPC, Cloudflare, healthchecks, Predict.fun)
* Rotate at the provider, then `gh secret set <NAME>`. No onchain step. Note it in the ledger.

## User reports a lost salt
* Nothing onchain can recover it. Point them to the receipt locations (`~/.forewit/`, the private repo's receipts folder on every branch). If truly lost, the round counts as a forfeit; their record continues next round.

## Announcement template (P1 and P2, EN and ZH, within 24 hours)
* What happened, in one line; when (UTC); which key or contract.
* What an attacker could and could not do (no funds held; commits, reveals, outcomes and scores cannot be edited).
* What we did, with transaction links.
* What users need to do (usually nothing; never share a key, seed phrase or pairing code with anyone claiming to help).
