---
description: 为什么每份先见 Forewit 记录都属于一个 Agent ID，以及这为什么让记录只能靠实力赢得，无法买卖。
---

# Agent ID：一个身份，一份记录

一份预测记录只有属于某一个人、并一直跟着这个人，才有价值。Agent ID 是你在 BNB Smart Chain 上的 `.ai` 名称：每位用户一个，且无法转移到其他钱包。先见只允许 Agent ID 持有者提交，所以每份记录背后都是一个真实身份。

## 合约检查什么

* **提交时**：发送钱包必须持有 Agent ID。账本调用 `AGENT_ID.balanceOf(msg.sender)`，若为零则以 `NoAgentID` 回滚。
* **揭示时**：不检查 Agent ID，只核对提交哈希。所以你永远不会被迫遭受不公平的弃权。
* **公开资料时**（`setPublicProfile`）：账本根据你的名称算出 token id，检查 `ownerOf(tokenId)` 是你的钱包，否则以 `LabelNotOwned` 回滚。

Agent ID 合约 [0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F](https://bscscan.com/address/0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F) 以不可变值固定在[账本](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol)中。它是一个 ERC721，名为 "SPACE ID Agent ID"（符号 "AI"），不可枚举。名称的 token id 为 `uint256(keccak256(bytes(label)))`，其中 label 是不带 `.ai` 的名称。可用 [scripts/verify](https://github.com/owaisahmad870/forewit/tree/main/scripts/verify) 中的只读脚本重新核对这些事实。

## 为什么记录只能赢得，无法买卖

* **每人一个。** 你无法开一百个钱包只留下运气好的那个：每个钱包都需要自己的 Agent ID。
* **不可转让。** 从持有者模拟调用 `transferFrom`、`safeTransferFrom` 和 `approve` 都会回滚，所以好记录无法出售。
* **弃权计分。** 你无法通过不揭示来隐藏糟糕的轮次。
* **靠技能，不靠运气。** 向零收缩让短暂的好运看起来不像技能。见 [评分](scoring.md)。
* **排除运营者。** 在账本上持有角色的钱包不进入排行榜和 ForewitScores。

## 坦诚说明局限

* 不可转让性来自模拟证据，而非发行方的正式保证。
* Agent ID 能否被销毁或重新发给其他钱包尚未验证。ForewitScores 把已公开 token 之后的任何转移（包括销毁或重发）视为"已移动"，并在下一个根中删除旧分数。
* 你的 Agent ID 位于 Agentic Wallet 中，它有自己的地址。从其他钱包预测会以 `NoAgentID` 失败。

## 除非你主动公开，你的名称是私密的

从第一次提交起，你的记录就绑定你的钱包地址。只有你主动公开时，才会显示你的 Agent ID 名称：

```bash
npx forewit@0.1.8 profile --from 0xYourAgenticWallet --label yourname --execute
```

取消公开（`--off`）会移除公开名称，并让你从下一个 ForewitScores 根中移除。网站和 MCP 服务器从不为未公开的持有者提供按名称搜索。

接下来阅读：[ForewitScores](forewit_scores.md)。
