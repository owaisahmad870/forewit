---
description: 先见 Forewit 团队对两个合约拥有的全部权限，以及任何人都无法做到的事。
---

# 所有者权限

简而言之：团队可以运行轮次、发布分数根。任何人（包括团队）都无法修改预测、分数或结果，也无法动用任何人的资金。合约本身不持有任何资产。

两个合约都不可升级：没有代理，没有 selfdestruct，没有 delegatecall，没有 payable 函数。

## 谁持有哪个角色（链上读回，2026 年 11 月 24 日）

* 管理员（Admin）：[0xF3b4728B30F0F380d77dE9d025E33680F66591bD](https://bscscan.com/address/0xF3b4728B30F0F380d77dE9d025E33680F66591bD)。两个合约的默认管理员，也是 ForecastLedger 的暂停者。目前是单一密钥，不是多签。
* Keeper：[0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18](https://bscscan.com/address/0x8D7E7c7F104A4EF26b67C7F74E4629Fc90B0Bc18)。两个合约的轮次管理者。这是一把热密钥，通过 GitHub Actions 运行每日任务。
* 部署者（Deployer）：[0x6732027E7f908E274bF4360Ce19cC182F82d008C](https://bscscan.com/address/0x6732027E7f908E274bF4360Ce19cC182F82d008C)。部署了两个合约，**不持有任何角色**。

这些钱包属于“运营方”，永远不参与排名，也永远不会获得 ForewitScores 叶子。

## ForecastLedger

[0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6)

* 轮次管理者（keeper）可以：
  * 创建轮次，按公开的选题规则挑选问题，并设定每轮的结算等待期（1 到 120 天，创建时固定）；
  * 以明文发布市场基准，每轮一次，且只能在提交截止时间前的最后 15 分钟内。基准决定该轮每位预测者的预测技能（不影响其 Brier 分数）。
* 暂停者（管理员）可以暂停新轮次和新提交。暂停永远不会阻止 reveal、revealFor、seal、finalize、voidStale、score 或 forfeit，因此不会有人被困住。
* 管理员可以即时授予和撤销角色。只有管理员席位本身需要通过两步转移，并有 1 天延迟，暂停者角色随之一起转移。

## ForewitScores

[0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)

* 轮次管理者（keeper）可以发布新根（只能追加），并且只能撤销最新的两个 epoch：一个错误的根，以及替代它的更正根。
* 管理员可以撤销任意 epoch，并授予或撤销角色。同样采用 1 天延迟的两步管理员转移。
* 没有暂停功能：没有什么需要暂停，错误数据由撤销来处理。
* 撤销是永久的。被撤销的 epoch 永远无法再通过核验。

## 任何人（包括管理员）都无法

* 修改或删除提交、揭示、结果或分数；
* 设定市场结果（结果只来自链上 Conditional Tokens 的赔付，或 Void）；
* 修改或删除已发布的根（只能撤销）；
* 转移任何资产，因为合约不持有资产，也不要求任何授权。

## 部署时永久固定

* ForecastLedger：Agent ID 合约、3 个 Predict.fun Conditional Tokens 合约组成的白名单，以及最短窗口（提交 2 小时、揭示 12 小时，在 BSC 主网强制执行）。最长窗口（7 天）、结算等待期上下限、最多 16 个问题、每批最多 100 个，以及提交哈希方案，均为编译期常量。
* ForewitScores：`LEDGER`、`AGENT_ID`（部署时检查与账本一致）、`SHRINK_K` 20、`SCORE_VERSION` 1。

## OpenForecasts（v2，任意市场，0xa034D7B62d04c8c4ac57a8C62047015C00DD6404）
* KEEPER（0xD1460596715c9f39a6EFBfd2760F62A4bF586C38）只能在提交后 120 秒内、揭示之前为一条预测发布一次市场价格，或在同样的 120 秒内作废该预测（原因代码见 docs/OPEN_FORECASTS.md）。此后不能再改动该预测，也不能设定结果或分数。
* PAUSER（管理员钱包）只能暂停新的提交。暂停期间揭示、结算和计分照常进行。只有管理员可以解除暂停。
* DEFAULT_ADMIN 可以授予和撤销角色，包括给自己授予 KEEPER。管理员席位通过两步转移，延迟 1 天。与 ForecastLedger 不同，PAUSER 不会随之转移：交接时需给新管理员授予 PAUSER 并撤销旧管理员的 PAUSER。
* 任何人（包括管理员）都不能修改提交、揭示、结果（结果只来自条件代币的链上赔付）或分数，合约不持有任何资产。常量（120 秒窗口、3 天揭示窗口、1% 到 99% 的揭示范围、条件代币白名单和 Agent ID 合约）没有设置函数。
* 0% 或 100% 的价格在网站上永不计分，因此被盗的 keeper 密钥无法借此制造技能分。

## ForewitStart（免费开始，0xD22e00037A2b7791Ab9AEf84111563F15Bd1C83A）
* 没有所有者、管理员、角色、升级或暂停：部署后（2026 年 11 月 26 日，区块 135826721，已在 BscScan 和 Sourcify 验证）任何人都无法修改或停止它。
* `start()` 和 `mint()` 是同一个免费调用（金额 0）：每个钱包一次，仅限 Agent ID 持有者。它记录开始时间和玩家编号。不会创建任何代币（即使钱包把这个调用显示为 "Mint"），也不持有任何资金。
* 开始不是预测，也不计分；网站将开始次数与预测分开统计。

## 计划

黑客松结束后，将管理员迁移到多签，或放弃非必要的角色。实施前会提前公布。

来源：[`docs/OWNER_PERMISSIONS.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/OWNER_PERMISSIONS.md)、[`contracts/src/ForewitScores.sol`](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForewitScores.sol)、[`docs/SCORES.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/SCORES.md) 第 4 节。
