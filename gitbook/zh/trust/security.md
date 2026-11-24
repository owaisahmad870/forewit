---
description: 审查了什么，发现了什么，修复了什么，还有哪些尚未解决。
---

# 安全审查

先见 Forewit 的合约不持有资金、不要求授权，也无法升级。最需要保护的是每一份预测记录的完整性。本页列出每一次审查、其发现及处理状态。

{% hint style="info" %}
以下审查由独立的 AI 智能体在全新上下文中进行，每个智能体都被要求先找出问题、再尝试反驳。它们不是人工安全公司的审计。完整报告都在仓库中，你可以自行判断。
{% endhint %}

## 概要

* 未解决的 High 级发现：0。未解决的 Medium 级发现：0。
* 两个合约均已在 BSC 主网上线，并在 BscScan 和 Sourcify 上验证（完全匹配）。
* 已接受的风险在 [威胁模型与已接受风险](threat_model.md) 中如实列出。

## ForecastLedger 审查

### 首次审查，2026 年 11 月 23 日

[`security_review/REPORT.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/REPORT.md)。共检查 30 项，确认 26 项：0 High，1 Medium，8 Low，17 Info。

* M1，Medium：轮次管理者可能在看到揭示和结果后扣下市场基准，抹掉所有人在该轮的预测技能。**已在 v1.2 修复**：基准现在以明文发布，每轮一次，且只能在提交截止时间前的最后 15 分钟内，此时还不存在任何揭示或结果。
* L1：基准数值由轮次管理者选择。**已缓解**：原始订单簿存档，没有基准的轮次会被标记，运营方钱包永不参与排名。
* L2、L3：被销毁或重新发放的 Agent ID 可能让一个人拥有两个地址。**已缓解，仍未解决**：索引器会标记 `identityChanged`；能否销毁或重新发放，已作为开放问题提交给主办方（风险 R4）。
* L4：过早或过时的基准。**已修复**（过早的部分）；“最后一瞥”部分被限制在 15 分钟窗口内。
* L5、L6、L7：密封与作废的时机。**已接受**，对应风险 R1、R2、R3。
* L8：管理员转移后，暂停者角色仍留在旧管理员手中。**已在 v1.2 修复**。

### v1.2 增量审查，2026 年 11 月 23 日

[`security_review/DELTA_REPORT.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/DELTA_REPORT.md)。没有新的 High 或 Medium。结论：在已接受风险的前提下可以部署。

* 发现 1，Low：错过 15 分钟基准窗口是永久性的，该轮所有人的技能都记为 0。**已接受**，keeper（维护程序）会重试并告警。
* 发现 2，Low 或 Info：预测者可以在 15 分钟窗口内照抄市场。**已接受并公开披露**。
* 发现 3，Info：过时的注释和措辞。**已在主网部署前修复**。
* 发现 4，Info：不变量测试套件从未在暂停状态或有基准的情况下运行。暂停现已纳入不变量测试套件；其中的基准覆盖情况尚未确认。

### 主网构建审查，2026 年 11 月 24 日

[`security_review/MAINNET_DELTA.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/MAINNET_DELTA.md)。未解决 High 0，未解决 Medium 0。

* L1，Low：部署脚本可能让部署者最终持有所有角色。**已在部署脚本中修复**（已验证的合约源码未改变）。部署后在链上读回角色：部署者不持有任何角色。
* L2，Low：对于在截止时间后才结算的问题，谁先密封谁就说了算。**已接受**，对应 R2。
* I1 到 I5，Info：措辞、完整轮次的分叉测试（此后已更新并通过），以及对白名单合约的信任假设。

## ForewitScores 审查，2026 年 11 月 24 日

[`security_review/SCORES_REVIEW.md`](https://github.com/owaisahmad870/forewit/blob/main/security_review/SCORES_REVIEW.md)。未解决 High 0，未解决 Medium 0，3 个 Low。

* L1：重新发放的名称可能带着旧分数通过门槛。**已收窄**：`ForewitGate` 现在还要求 `ForecastLedger.profileLabelId(caller) == tokenId`。在下一个根发布前仍有残留窗口。维持 Low。
* L2：仅凭 keeper 密钥就能撤销所有历史根。**已修复**：keeper 只能撤销最新的两个 epoch；更早的只能由管理员撤销。
* L3：keeper 的自检与构建使用同一个 RPC。**流程改进**：在一个提供商上构建，在第二个提供商上重算，并用 `getStats` 交叉核对每个叶子。已在 keeper 中实现，未经独立审查。
* I1 到 I6，Info：撤销后已通过的结果依然有效、`MAX_AGE` 以发布时间计算、重算的边界情况、取消公开不具追溯效力、示例门槛合约的细节。**仍作为 Info 保留**。

针对上述修复的增量审查（commit 40a8373）没有发现 High 或 Medium。其中的 D1 发现（索引器漏掉了部分代币转移）随后已在索引器中修复；该修复有测试覆盖，但未再次审查。

## 工具与测试

记录于 2026 年 11 月 24 日：

* Foundry：126 个测试通过，包括 BSC 主网分叉测试。ForecastLedger、ForewitScores 和 ForewitGate 覆盖率均为 100%。
* Slither：我们的代码中 0 High，0 Medium。每个 Low 和 Info 项都在 [`docs/SECURITY.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/SECURITY.md) 中做了分类处理。
* Aderyn（在 CI 中运行）：在 ForecastLedger 上报告 2 High，10 Low，全部判定为误报或设计如此。
* 黄金向量：15 个数值在 JavaScript 和 Solidity 中双重断言。
* Node 测试：agent 65，MCP 27，keeper 19，indexer 21；web 40。

## 报告问题

安全问题请通过 [GitHub 安全公告](https://github.com/owaisahmad870/forewit/security/advisories/new)私下报告。其他问题请在 [GitHub](https://github.com/owaisahmad870/forewit/issues) 上提交 issue。密钥泄露时我们怎么做：[密钥、秘密与事件处理](keys_and_incidents.md)。
