---
description: 玩家实际会遇到的问题，以及每个问题的简短解决方法。
---

# 故障排查

先记住两条规则：

* 如果发送结果不明确，绝不要再次发送。先运行 `status`：它只读取数据。
* `PENDING_CONFIRMATION` 表示请在币安 App 中批准。不要再次运行命令。

## 安装

**找不到 `npx` 或 `node`。**
从 [nodejs.org](https://nodejs.org) 安装 Node.js，然后打开一个新终端。

**PowerShell 提示 "running scripts is disabled on this system"（系统禁止运行脚本）。**
用 `npx.cmd`、`npm.cmd` 和 `baw.cmd` 代替 `npx`、`npm` 和 `baw`。无需修改策略。

**`baw not found`。**
运行 `npm install -g @binance/agentic-wallet@1.12.0`，然后打开一个新终端。

**`needs an interactive terminal` 或 `forewit start is interactive`。**
请在 PowerShell、Windows Terminal 或普通终端中亲自运行该命令。Git Bash 往往无法识别为终端。通过管道或脚本输入的 yes 一律会被拒绝，这是有意为之。

**`sign in did not complete`。**
登录码 5 分钟后过期。重新运行 `start`，确认币安 App 显示的是同一个配对码，并尽快批准。

## 你的钱包

**Agentic Wallet 未登录。**
运行 `baw auth signin`，并在币安 App 中批准。

**`this wallet has no claimed Agent ID`，或错误 `NoAgentID`。**
在币安 App 中领取 Agent ID，并用持有它的 Agentic Wallet 进行预测。

**`the Agent ID service is temporarily unavailable (20003008)`。**
这并不表示你没有 Agent ID。几分钟后再试。

**`Developer Mode is off, expired or over its limit`（代码 351802 或 351804）。**
在币安 App 中重新开启：Agentic Wallet，设置。它有效 7 天，每次使用会延长。它有自己的每日限额，钱包余额也必须低于其上限。

**`the wallet is locked` 或 `the wallet has <n> pending transaction(s)`。**
在币安 App 中批准或拒绝等待中的交易，然后运行 `status`。绝不要重复发送。

**`351803: risk blocked by the Binance Agentic Wallet`。**
钱包的风控拦截了这次调用。先见绝不会绕过它。请停止操作。

## 发送预测

**`commits for round <n> closed at <time>`。**
UTC 23:00 的截止时间已过。下一个每日轮次约在 UTC 03:00 开放。

**`round <n> has <k> questions, you gave <m> probabilities`。**
每个问题给一个数字，按显示顺序，取值 1 到 99，不要加 `%` 符号。

**`clamped to the 1% to 99% range`。**
不是错误。先见从不接受 0% 或 100%。

**`this wallet already committed in this round`。**
不是错误。截止前你最新的一次提交才算数。

**`aborted: you did not type yes` 或 `the preview expired`。**
没有发送任何内容。准备好后重新运行命令。

**`refusing this preview` 或 `351805: the simulation failed`。**
没有发送任何内容。运行 `status`。合约给出的原因说明了问题：`CommitClosed`（已过截止时间）、`NoAgentID`（钱包不对）、`RevealNotOpen`、`NoCommit`、`HashMismatch`、`AlreadyRevealed` 或 `LabelNotOwned`。

**`execute failed` 或 `the transaction state is unknown`。**
不要重复发送。先运行消息后打印的两项检查，再运行 `status`。

**`RPC ... failed` 或 `round file download failed`。**
公共节点或网站出现临时故障。等一分钟再试。如果 forewit.xyz 打不开，请使用 [forewit.pages.dev](https://forewit.pages.dev)。

**回执无法保存（`ACL of <path> still grants`，或 `is still accessible to group or others`）。**
没有发送任何内容。请把主文件夹放在普通本地磁盘上，并以你自己的用户身份运行工具。

## 揭示

**已开启自动揭示，但截止一小时后 `status` 仍显示未揭示。**
请在揭示截止前自己揭示：`npx forewit@latest reveal --execute --round <n>`

**`reveal for round <n> opens at <time>`。**
等到提交截止时间。如果是更早的轮次，加上 `--round <n>`。

**`the reveal window for round <n> closed`。**
已经太晚：该轮按弃权计算。

**`no local receipt matches the onchain commit`。**
把备份的回执以 `.json` 文件保存到主文件夹下的 `.forewit` 文件夹中，然后再次揭示。

**`no commit onchain for <wallet> in round <n>`。**
提交没有上链，或者你用了别的钱包或轮次。用正确的 `--round` 运行 `status`。

## forewit agent

**关于 `FOREWIT_LLM_MODEL`、`FOREWIT_LLM_API` 或 `FOREWIT_LLM_URL` 的错误。**
至少设置 `FOREWIT_LLM_MODEL`。`FOREWIT_LLM_API` 为 `openai` 或 `anthropic`，`FOREWIT_LLM_URL` 必须是 https（只有 localhost 可用普通 http）。见 [forewit agent](../for_agents/forewit_agent.md)。

**`refusing the model output`。**
模型必须准确回复 `{"p":[...]}`，每个问题一个 1 到 99 的数字。请重试或换一个模型。

## 仍然解决不了？

在 [GitHub](https://github.com/owaisahmad870/forewit/issues) 上提交 issue，附上消息和你运行的命令。绝不要在那里粘贴你的盐值或回执。
