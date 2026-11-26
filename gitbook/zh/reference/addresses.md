---
description: 先见 Forewit 的全部合约、角色钱包、交易和链接，集中在一页。
---

# 地址与链接

所有合约都部署在 BNB Smart Chain 主网（链 ID 56）。在信任任何地址之前，请先在本页或 [`agent/config.mjs`](https://github.com/owaisahmad870/forewit/blob/main/agent/config.mjs) 中核对。

## Forewit 合约

* ForecastLedger v1.2：[0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6)
  * 部署交易：[0xfb1ff2078d10c78dbb76229ab9e45456bd2ac3cf5f651bdece661c0b011de826](https://bscscan.com/tx/0xfb1ff2078d10c78dbb76229ab9e45456bd2ac3cf5f651bdece661c0b011de826)，区块 135450390，2026 年 11 月 24 日。
  * 已在 BscScan 和 Sourcify 验证（完全匹配）。
* ForewitScores：[0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)
  * 部署交易：[0xf32253838b8f858bed6c0c1554604226f625b3b9cf6573d56e60b0083bc2b22e](https://bscscan.com/tx/0xf32253838b8f858bed6c0c1554604226f625b3b9cf6573d56e60b0083bc2b22e)，区块 135466479，2026 年 11 月 24 日。
  * 已在 BscScan 和 Sourcify 验证（完全匹配）。

* OpenForecasts（任意市场，任意时间）：[0xa034D7B62d04c8c4ac57a8C62047015C00DD6404](https://bscscan.com/address/0xa034D7B62d04c8c4ac57a8C62047015C00DD6404)
  * 区块 135672274，2026 年 11 月 25 日。已在 BscScan 和 Sourcify 验证。
* ForewitStart（免费开始，每个钱包一次，无所有者）：[0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A](https://bscscan.com/address/0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A)
  * 部署交易：[0xec9b0e44d151e11a09fb1a3ac64625414e43f087a1f0df2ac59221503c5d0327](https://bscscan.com/tx/0xec9b0e44d151e11a09fb1a3ac64625414e43f087a1f0df2ac59221503c5d0327)，区块 135826721，2026 年 11 月 26 日。已在 BscScan 和 Sourcify 验证（完全匹配）。
## 角色钱包

* 管理员（Admin）：[0xF3b4728B30F0F380d77dE9d025E33680F66591bD](https://bscscan.com/address/0xF3b4728B30F0F380d77dE9d025E33680F66591bD)
* Keeper（轮次管理程序）：[0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18](https://bscscan.com/address/0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18)
* 任意市场预测的 keeper（发布市场价格，执行自动揭示）：[0xD1460596715c9f39a6EFBfd2760F62A4bF586C38](https://bscscan.com/address/0xD1460596715c9f39a6EFBfd2760F62A4bF586C38)
* 部署者，不持有任何角色：[0x6732027E7f908E274bF4360Ce19cC182F82d008C](https://bscscan.com/address/0x6732027E7f908E274bF4360Ce19cC182F82d008C)

每个角色能做什么，请看 [所有者权限](../trust/owner_permissions.md)。

## Forewit 读取的合约

* Agent ID：[0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F)
* Predict.fun 条件代币合约（Conditional Tokens，账本白名单中的 3 个）：
  * [0x22DA1810B194ca018378464a58f6Ac2B10C9d244](https://bscscan.com/address/0x22DA1810B194ca018378464a58f6Ac2B10C9d244)
  * [0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F](https://bscscan.com/address/0x9400F8Ad57e9e0F352345935d6D3175975eb1d9F)
  * [0xF64b0b318AAf83BD9071110af24D24445719A07F](https://bscscan.com/address/0xF64b0b318AAf83BD9071110af24D24445719A07F)

## 重要交易

* 第 1 轮开启（主网第一个轮次）：[0x6baa5b935acbbc7f9e49cc6a593a18bda93318b24f9c4e7702977a87b842fab1](https://bscscan.com/tx/0x6baa5b935acbbc7f9e49cc6a593a18bda93318b24f9c4e7702977a87b842fab1)

## 测试网

* BSC 测试网（链 ID 97）上的 ForecastLedger 实例 E：[0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1](https://testnet.bscscan.com/address/0xa4975e89d4Eb797AcC151D05634E2f7c58Ac12E1)。它使用模拟的 Agent ID。更早的测试网实例 A 到 D 已弃用。

## 链接

* 网站：[https://forewit.xyz](https://forewit.xyz)（备用 [https://forewit.pages.dev](https://forewit.pages.dev)）。
* 源代码（MIT）：[https://github.com/owaisahmad870/forewit](https://github.com/owaisahmad870/forewit)
* npm 包：[forewit](https://www.npmjs.com/package/forewit)，通过 GitHub Actions 带来源证明（provenance）发布
* MCP 服务器：`npx -y forewit mcp`在你自己的电脑上运行，或使用只读连接器 `https://forewit.xyz/mcp`（见 [MCP 服务器](../for_agents/mcp_server.md)）。
* 公开数据：`https://forewit.xyz/data/` 或 `https://forewit.pages.dev/data/`（见 [公开数据文件](../developers/data_files.md)）
* X：[@forewitai](https://x.com/forewitai)
