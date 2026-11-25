---
description: 只凭 BSC 日志重建任意 ForewitScores 根或网站上的数字，与链上数据核对，并从源码运行 CLI。
---

# 重新计算任意分数或根

你不必信任先见 Forewit 给出的数字。每个分数都来自 BSC 上的事件。你可以自己从日志重建它们，不需要归档节点，也不需要 Forewit 的服务器。

```mermaid
flowchart LR
  A[ForecastLedger 事件] --> C[你的重建]
  B[Agent ID Transfer 事件] --> C
  C --> D[叶子和 Merkle 根]
  D --> E{与链上的根相等？}
  E -->|是| F[RECOMPUTE OK，exit 0]
  E -->|否| G[RECOMPUTE MISMATCH，exit 1]
```

## 完成后你将拥有

* 一个“是”或“否”的答案：已发布的 ForewitScores 根是否与日志一致？
* 可选：从同样的日志构建出的、你自己的一份网站数据副本。

## 开始之前

* Node 26 或更高版本，以及 git。
* 任意支持 `eth_getLogs` 的 BSC 主网 RPC。默认使用公共的 `https://bsc-rpc.publicnode.com`。可用 `--rpc` 传入你自己的 RPC。

## 步骤：核对一个 ForewitScores 根

1. 克隆并安装。viem 和 OpenZeppelin Merkle tree 包是根目录下的开发依赖：
   ```bash
   git clone https://github.com/owaisahmad870/forewit
   cd forewit
   npm ci
   ```
2. 重新计算最新的 epoch：
   ```bash
   node indexer/scores.mjs recompute --network mainnet --scores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc
   ```
3. 或者指定某个 epoch，并可选地与一个已发布的叶子文件比较：
   ```bash
   node indexer/scores.mjs recompute --network mainnet --scores 0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc --epoch 1 --file latest.json
   ```
4. 阅读输出。它会打印 epoch、链上的根、你算出的根、快照区块、撤销标志、叶子数量和各项检查，最后是 `RECOMPUTE OK`（exit 0）或 `RECOMPUTE MISMATCH`（exit 1）。

完整用法，摘自 [`indexer/scores.mjs`](https://github.com/owaisahmad870/forewit/blob/main/indexer/scores.mjs) 文件开头：

```text
build:     node indexer/scores.mjs build --network testnet|mainnet --ledger <address> [--from-block <n>] [--snapshot-block <n>] [--round-id <n>] [--out <file>] [--rpc <url>]
recompute: node indexer/scores.mjs recompute --network testnet|mainnet --scores <address> [--from-block <n>] [--epoch <n>] [--file <leaves.json>] [--rpc <url>]
```

在主网上，扫描从 ForecastLedger 的部署区块 135450390 开始，因此不需要 `--from-block`。

{% hint style="warning" %}
* 在第一个根发布之前，recompute 会以 "no epoch posted yet" 停止。截至 2026 年 11 月 24 日，尚未发布任何根。
* 对已撤销的 epoch 也会打印 `RECOMPUTE OK`。请自己检查输出中的 `revoked` 字段（审计项 I4）。
* `--file` 只比较根，不逐一比较每个叶子和证明。
{% endhint %}

## recompute 做了什么

1. 从链上读取该 epoch：根、快照区块、叶子数量、撤销标志。
2. 获取截至快照区块的 ForecastLedger 事件（`Scored`、`Forfeited`、`ProfileUpdated`、`RoleGranted`、`RoleRevoked`）以及 Agent ID 的 `Transfer` 事件。
3. 按照 [`docs/SCORES.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/SCORES.md) 第 2 节的规则重建每个叶子：
   * 只包含至少有一个分数、不持有任何 ledger 角色、最近一次公开资料更新为带名称的公开状态、且代币此后未曾转移的预测者；
   * `n` 是所有 `baselineUsed` 为 true 的事件中 `questions` 的总和；`skill = sumSkill / (n + 20)`，向零截断。
4. 按 OpenZeppelin StandardMerkleTree 的布局构建树，并比较根。
5. 检查已评分的预测者数量等于叶子数量加上被排除的数量。

## 步骤：重建网站上的数字

网站读取的快照只由 ForecastLedger 事件构建。重建方法：

```bash
node indexer/build.mjs --network mainnet --ledger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6 --from-block 135450390
```

它会写出 `indexer/out/mainnet/<ledger>/snapshot.json`。将其与 `https://forewit.xyz/data/snapshot.json` 比较。`builtAt` 和 `headBlock` 等字段会因运行时间不同而不同，`metrics.windowMove` 只在发布步骤（`indexer/publish.mjs`）中添加。

## 步骤：核对评分数学

```bash
npm run golden
```

这会断言一组黄金向量（提交哈希、Brier、skill、罚没），Solidity 测试也断言同样的向量。参见 [`docs/SCORING.md`](https://github.com/owaisahmad870/forewit/blob/main/docs/SCORING.md)。

## 从源码运行 CLI

npm 包与 [`agent/forewit.mjs`](https://github.com/owaisahmad870/forewit/blob/main/agent/forewit.mjs) 是同一份代码。要从克隆的仓库运行，在文档写着 `npx forewit@latest` 的地方改用 `node agent/forewit.mjs`：

```bash
git clone https://github.com/owaisahmad870/forewit.git
cd forewit
node agent/forewit.mjs --help
node agent/forewit.mjs round --round-file https://forewit.xyz/data/rounds/1.json
```

另见：[以 Forewit 分数设置准入门槛](gate_on_a_score.md)，[公开数据文件](data_files.md)。
