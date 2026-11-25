---
description: ForewitScores 让任何合约或智能体只需一次调用，就能在链上核验持有者的先见 Forewit 预测技能。
---

# ForewitScores

ForewitScores 是一块公开的告示板。每轮结算后，keeper 会钉上一个指纹（Merkle 根），覆盖每位已公开持有者的分数。任何持有分数及其证明的应用都可以问告示板"这和指纹记录的完全一致吗？"，并得到是或否，而不必自己把每一轮加起来。

## 已上线内容

* BSC 主网上的 ForewitScores：[0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)，已在 BscScan 和 Sourcify 上验证。它从 ForecastLedger [0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6) 读取数据。
* 2026 年 11 月 24 日的状态：尚未发布任何根（`latestEpoch` 为 0）。第一个根会在第一个有至少一位已公开持有者的轮次结算后发布。在此之前，`verify` 对所有人都返回 false。

## 分数是什么

每个叶子包含三个数字，只根据 ForecastLedger 事件计算（弃权也计入）：

* `tokenId`：你的 Agent ID token id，`uint256(keccak256(bytes(label)))`。
* `skill`：`sumSkill / (baselineQuestions + 20)`，向零截断的整数除法。这就是 [评分](scoring.md) 中的排行榜分数。
* `n`：你的 `baselineQuestions`，即样本量。

只有在根的快照区块时满足以下条件的钱包才会获得叶子：至少有一轮已评分或弃权，在账本上不持有任何角色，公开资料为公开且带有 Agent ID 名称（`npx forewit@0.1.5 profile ... --label yourname`），并且该 Agent ID 自公开以来没有移出钱包。其他人只以地址和原因列在叶子文件中。

## 如何核验分数

一次免费的 view 调用：

```solidity
function verify(uint256 tokenId, int256 skill, uint256 n, bytes32[] calldata proof) external view returns (bool);
```

只有最新的根存在、未被撤销且证明与之匹配时，它才返回 true。查询历史可用 `verifyAt(epoch, tokenId, skill, n, proof)`。keeper 会在叶子文件中公布每一个证明（仓库中的 `web/public/data/scores/latest.json`，网站上位于 `data/scores/` 下）。

证明是公开的，所以以分数设置门槛的合约还必须检查调用者拥有该 token：`AGENT_ID.ownerOf(tokenId) == msg.sender`。见 [以 Forewit 分数设置准入门槛](../developers/gate_on_a_score.md)。

## 任何人都可以重算每一个根

每个根都可以只凭 BSC 日志重建，不需要归档节点，也不需要信任先见：

```bash
node indexer/scores.mjs recompute --network mainnet --scores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc
```

只有重建的根与链上的根一致时，它才以 0 退出。见 [重新计算任意分数或根](../developers/recompute.md)。每次发布前，keeper 先在一个 RPC 提供方上构建树，再在第二个提供方上重算，两者一致才发布。

根只追加，不覆盖。错误的根通过发布更正后的根来修复，然后附上公开理由撤销错误的根。keeper 只能撤销最新的两个根；更早的只能由管理员撤销。

完整规范：[docs/SCORES.md](https://github.com/owaisahmad870/forewit/blob/main/docs/SCORES.md)。函数列表：[合约参考：ForewitScores](../developers/forewit_scores_reference.md)。
