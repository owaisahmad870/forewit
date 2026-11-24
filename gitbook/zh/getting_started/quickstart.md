---
description: 从拥有 Agent ID 到在 BSC 主网完成第一次密封预测，大约只需十分钟。
---

# 快速上手：你的第一次提交

## 完成后你将拥有

* 你的第一份预测已提交上链，在截止时间前处于密封状态，任何人都无法读取。
* 一份保存在你电脑上的揭示凭证，以及它的私密备份。
* 一个提醒，告诉你何时回来揭示。

仅为预测评分，不构成投资建议。

整个过程大约十分钟。请先准备好 [准备工作](what_you_need.md) 中的五样东西。

{% hint style="info" %}
如实说明：目前提交预测需要在电脑上（Windows、macOS 或 Linux）使用 `baw` 命令行钱包。纯手机操作的方式正在开发中。
{% endhint %}

## 一图看懂

你写下答案，把它封进信封，然后寄出。截止时间过后再拆开信封。完整流程请阅读 [提交与揭示](../how_it_works/commit_and_reveal.md)。

## 步骤

以下步骤通过 `npx` 使用 npm 包 `forewit`，无需克隆任何代码。在 Windows 上如果 PowerShell 阻止运行脚本，请用 `npx.cmd` 代替 `npx`，用 `baw.cmd` 代替 `baw`。

### 1. 检查钱包

```bash
baw wallet status --json
baw wallet agent-id --json
baw wallet settings --json
```

预期结果：状态为 `CONNECTED`，显示你已领取的 Agent ID，以及 `devMode.enabled: true`。如果缺少任何一项，请回到 [准备工作](what_you_need.md)。

### 2. 找到你的钱包地址

```bash
baw wallet address --json
```

预期结果：一组地址。请使用 `binanceChainId` 为 56 的那一项。下文用 `0xYourAgenticWallet` 表示它。

### 3. 查看轮次

先找到最新的轮次编号：

```bash
npx forewit@0.1.0 round
```

预期结果：第一行为 `Forewit round <n> on mainnet (chain 56), ledger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6`。此时问题只以编号显示。

每个轮次都有一个公开的轮次文件，以文字形式给出问题。把 `1` 换成你的轮次编号：

```bash
npx forewit@0.1.0 round --round-file https://forewit.xyz/data/rounds/1.json
```

预期结果：轮次编号、提交和揭示的截止时间，以及每个问题的事件问题和标签。例如：

```
Forewit round 1 on mainnet (chain 56), ledger 0xd11e67ff70ACD42E01d79130f280162b00Bb09B6
Phase: commit open
Commit deadline: 24 Nov 2026 23:00 UTC (in 9h 14m)
Reveal deadline: 25 Nov 2026 23:00 UTC (in 1d 9h)
Questions: 4
  1. Bitcoin Up or Down on November 25?
  ...
  4. Highest temperature in Tokyo on November 25? · 15°C
```

工具会将轮次文件与链上数据核对，只要有任何不一致就会拒绝执行。

### 4. 检查你的概率

按顺序为每个问题给出一个百分比。第 1 轮有 4 个问题，所以需要 4 个数字。

```bash
npx forewit@0.1.0 forecast --p 60,40,50,30
```

预期结果：列出每个问题及你给出的百分比。此步骤不保存也不发送任何内容。低于 1 或高于 99 的值会被限制在 1% 到 99% 的范围内。

### 5. 提交

```bash
npx forewit@0.1.0 commit --execute --from 0xYourAgenticWallet --p 60,40,50,30 --round-file https://forewit.xyz/data/rounds/1.json
```

预期结果，依次为：

1. 工具生成一个随机盐值，并在执行任何其他操作之前，把揭示凭证保存到你主目录下的 `.forewit` 文件夹中。
2. 检查钱包：已登录、已领取 Agent ID、已开启开发者模式、没有待处理交易。
3. 显示钱包预览：`parsedTx`、模拟结果以及每一项风险。
4. 要求你输入 `yes`。只有在预览无误时才输入。输入其他任何内容都会中止，不会发送任何交易。
5. 打印 `BROADCASTED` 和交易链接，或者打印 `PENDING_CONFIRMATION`。

如果看到 `PENDING_CONFIRMATION`，请在币安 App 中批准。不要再次运行该命令。

> 截图占位：终端中显示提交预览和 "Type yes to send it" 提示

> 截图占位：币安 App 中对 PENDING_CONFIRMATION 提交的批准页面

不加 `--execute` 时，commit 命令不会发送任何交易。它仍会保存凭证，并打印 `baw contract-call preview` 和 `execute` 命令，供你自行运行。

### 6. 备份你的凭证

```bash
npx forewit@0.1.0 receipt --from 0xYourAgenticWallet --show-salt
```

预期结果：以 JSON 形式显示你的凭证，其中包含盐值。把它复制到密码管理器或离线笔记中。

{% hint style="warning" %}
没有盐值就无法揭示，该轮次会被记为弃权，并获得最差的分数。在提交截止时间之前，不要分享盐值或凭证：任何拿到它的人都能读出你的预测。不加 `--show-salt` 时盐值会被隐藏，因此仅凭那份输出并不能作为备份。
{% endhint %}

### 7. 查看状态

```bash
npx forewit@0.1.0 status --from 0xYourAgenticWallet
```

预期结果：`committed: yes`、`local receipt: matches the onchain commit`，以及 `Next: wait for the commit deadline, then reveal`。

### 8. 回来揭示

{% hint style="warning" %}
每日轮次在 UTC 时间 23:00 停止接受提交。之后揭示窗口会开放 24 小时。请在同一台电脑上揭示，因为盐值保存在那台电脑的凭证里。
{% endhint %}

接下来请看 [揭示并查看分数](reveal_and_score.md)。

## 更喜欢用代码仓库？

代码仓库中有同一个工具。克隆后，在本页写着 `npx forewit@0.1.0` 的地方改用 `node agent/forewit.mjs`：

```bash
git clone https://github.com/owaisahmad870/forewit.git
cd forewit
node agent/forewit.mjs --help
```

## 更喜欢用 AI 智能体？

用 `forewit agent` 让你自己的模型来选择概率。请看 [forewit agent](../for_agents/forewit_agent.md)。

## 遇到问题

工具可能打印的每一条消息都列在 [故障排查](troubleshooting.md) 中，并附有简单的解决方法。

仅为预测评分，不构成投资建议。
