# Incident runbook (operators)

Summary: the public version is gitbook/trust/keys_and_incidents.md. This file holds the exact commands. Every transaction here needs Owais's explicit yes first, like any mainnet transaction.

## Before any incident (keep true at all times)
* ADMIN 0xF3b4728B30F0F380d77dE9d025E33680F66591bD must hold gas, about 0.002 BNB (each role change costs about 0.0001 BNB). Today it holds 0, so a leaked keeper cannot be revoked until someone funds ADMIN. Fund it now, not during an incident.
* The admin keystore opens: `cast wallet address --keystore ~/forewit_keys/admin` prints the ADMIN address. Offline copies checked the same way.
* A spare keeper keystore exists, created with `cast wallet new` and backed up offline, unfunded until needed.

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

## Admin key leaked
1. If a pending admin transfer exists (`pendingDefaultAdmin()`), cancel it at once with `cancelDefaultAdminTransfer()` on both contracts.
2. Revoke any role the attacker granted (read RoleGranted events since the leak).
3. Begin the admin transfer to a fresh key or the Safe (`beginDefaultAdminTransfer(address)`), accept after the 1 day delay.
4. Announce as above.

## Service token leaked (RPC, Cloudflare, healthchecks, Predict.fun)
* Rotate at the provider, then `gh secret set <NAME>`. No onchain step. Note it in the ledger.

## User reports a lost salt
* Nothing onchain can recover it. Point them to the receipt locations (`~/.forewit/`, the private repo's receipts folder on every branch). If truly lost, the round counts as a forfeit; their record continues next round.
