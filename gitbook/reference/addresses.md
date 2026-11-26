---
description: Every Forewit contract, role wallet, transaction and link, in one place.
---

# Addresses and links

All contracts are on BNB Smart Chain mainnet (chain id 56). Always check an address here, or in [`agent/config.mjs`](https://github.com/owaisahmad870/forewit/blob/main/agent/config.mjs), before you trust it.

## Forewit contracts

* ForecastLedger v1.2: [0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6)
  * Deploy transaction: [0xfb1ff2078d10c78dbb76229ab9e45456bd2ac3cf5f651bdece661c0b011de826](https://bscscan.com/tx/0xfb1ff2078d10c78dbb76229ab9e45456bd2ac3cf5f651bdece661c0b011de826), block 135450390, 24 Nov 2026.
  * Verified on BscScan and Sourcify (exact match).
* ForewitScores: [0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)
  * Deploy transaction: [0xf32253838b8f858bed6c0c1554604226f625b3b9cf6573d56e60b0083bc2b22e](https://bscscan.com/tx/0xf32253838b8f858bed6c0c1554604226f625b3b9cf6573d56e60b0083bc2b22e), block 135466479, 24 Nov 2026.
  * Verified on BscScan and Sourcify (exact match).

* OpenForecasts (any market, any time): [0xa034D7B62d04c8c4ac57a8C62047015C00DD6404](https://bscscan.com/address/0xa034D7B62d04c8c4ac57a8C62047015C00DD6404)
  * Block 135672274, 25 Nov 2026. Verified on BscScan and Sourcify.
* ForewitStart (free start, once per wallet, no owner): [0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A](https://bscscan.com/address/0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A)
  * Deploy transaction: [0xec9b0e44d151e11a09fb1a3ac64625414e43f087a1f0df2ac59221503c5d0327](https://bscscan.com/tx/0xec9b0e44d151e11a09fb1a3ac64625414e43f087a1f0df2ac59221503c5d0327), block 135826721, 26 Nov 2026. Verified on BscScan and Sourcify (exact match).
## Role wallets

* Admin: [0xF3b4728B30F0F380d77dE9d025E33680F66591bD](https://bscscan.com/address/0xF3b4728B30F0F380d77dE9d025E33680F66591bD)
* Keeper (round manager): [0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18](https://bscscan.com/address/0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18)
* Open forecasts keeper (posts the market price, reveals auto reveal copies): [0xD1460596715c9f39a6EFBfd2760F62A4bF586C38](https://bscscan.com/address/0xD1460596715c9f39a6EFBfd2760F62A4bF586C38)
* Deployer, holds no role: [0x6732027E7f908E274bF4360Ce19cC182F82d008C](https://bscscan.com/address/0x6732027E7f908E274bF4360Ce19cC182F82d008C)

See [Owner permissions](../trust/owner_permissions.md) for what each can do.

## Contracts Forewit reads

* Agent ID: [0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F)
* Predict.fun Conditional Tokens (the 3 allowlisted on the ledger):
  * [0x22DA1810B194ca018378464a58f6Ac2B10C9d244](https://bscscan.com/address/0x22DA1810B194ca018378464a58f6Ac2B10C9d244)
  * [0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F](https://bscscan.com/address/0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F)
  * [0xF64b0b318AAf83BD9071110af24D24445719A07F](https://bscscan.com/address/0xF64b0b318AAf83BD9071110af24D24445719A07F)

## Notable transactions

* Round 1 opened (first mainnet round): [0x6baa5b935acbbc7f9e49cc6a593a18bda93318b24f9c4e7702977a87b842fab1](https://bscscan.com/tx/0x6baa5b935acbbc7f9e49cc6a593a18bda93318b24f9c4e7702977a87b842fab1)

## Test network

* ForecastLedger on BSC testnet (chain 97), instance E: [0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1](https://testnet.bscscan.com/address/0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1). It uses a mock Agent ID. Older testnet instances A to D are deprecated.

## Links

* Website: [https://forewit.xyz](https://forewit.xyz) (fallback [https://forewit.pages.dev](https://forewit.pages.dev)).
* Source code (MIT): [https://github.com/owaisahmad870/forewit](https://github.com/owaisahmad870/forewit)
* npm package: [forewit](https://www.npmjs.com/package/forewit), published with provenance from GitHub Actions
* MCP server: `npx -y forewit mcp` on your own machine, or the read only connector `https://forewit.xyz/mcp` (see [MCP server](../for_agents/mcp_server.md)).
* Public data: `https://forewit.xyz/data/` or `https://forewit.pages.dev/data/` (see [Published data files](../developers/data_files.md))
* X: [@forewitai](https://x.com/forewitai)
