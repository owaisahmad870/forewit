---
description: 先见 Forewit 命令行工具可能打印的每一条消息，以及每条消息的简单解决方法。
---

# 故障排查

在下面找到你看到的消息。每条消息在终端中都以 `forewit:` 开头。尖括号中的文字会随你的轮次、钱包或文件而变化。

先记住两条规则：

* 如果发送结果不明确，不要再次发送。先检查 `baw wallet tx-history --type pending --binanceChainId 56 --json` 和 `baw wallet tx-lock --binanceChainId 56 --json`。
* `status` 永远是安全的，它只读取数据。

这些消息来自 [agent/forewit.mjs](https://github.com/owaisahmad870/forewit/blob/main/agent/forewit.mjs) 和 [agent/lib](https://github.com/owaisahmad870/forewit/tree/main/agent/lib)。

## 安装与启动

**PowerShell 提示 "running scripts is disabled on this system"（系统禁止运行脚本）。**
改用 `.cmd` 形式：`npm.cmd install -g @binance/agentic-wallet@1.12.0`，然后在文档写着 `baw` 和 `npx` 的地方输入 `baw.cmd` 和 `npx.cmd`。引导式开始对应的命令是 `npx.cmd forewit@0.1.4 start`。

**`forewit start is interactive: run it in a terminal window.`**
请在 PowerShell、Windows Terminal 或普通终端中亲自运行 `start`，不要通过脚本或 AI 智能体运行。

**`sign in did not complete (the code expires after 5 minutes). Run forewit start again for a fresh code.`**
重新运行 `start`，打开新的链接，确认币安 App 显示的是同一个配对码，并在 5 分钟内批准。

**`baw not found. Install the Binance Agentic Wallet CLI (npm package @binance/agentic-wallet).`**
运行 `npm install -g @binance/agentic-wallet@1.12.0`（在 Windows 上为 `npm.cmd ...`），然后打开一个新终端，让新路径生效。

**`--execute needs an interactive terminal so the wallet owner can type yes; stdin is not a TTY. Nothing was sent.`**
请在普通终端中亲自运行该命令。在 Windows 上使用 PowerShell 或 Windows Terminal：Git Bash 往往无法识别为终端。通过管道或脚本输入的 yes 一律会被拒绝，这是有意为之。

**`--execute needs BSC mainnet (chain 56) with a pinned ledger; baw cannot sign on <network> (chain <id>). Run without --execute for the dry run.`**
去掉 `--network testnet`。`baw` 只在 BSC 主网上签名。

**`unknown network "<name>"; use mainnet or testnet`**
使用 `--network mainnet`，或者不加这个参数（默认就是主网）。

**`the <network> ledger is not deployed yet, so the CLI refuses to read or write it. Use --network testnet.`**
你使用的是旧版本。用 `npx forewit@0.1.4` 或 `git pull` 更新。

## 你的钱包

**`--from <your agentic wallet address> is required (get it from: baw wallet address --json, the binanceChainId 56 entry)`**
加上 `--from 0x...`，地址取自 `baw wallet address --json` 中 `binanceChainId` 为 56 的那一项。

**`the Agentic Wallet is not signed in (baw wallet status is not CONNECTED). Sign in with: baw auth signin`**
运行 `baw auth signin`，用币安 App 扫描二维码。然后确认 `baw wallet status --json` 显示 `CONNECTED`。

**`the Agent ID service is temporarily unavailable (20003008). This does not mean you have no Agent ID; try again later.`**
等几分钟后再运行一次命令。

**`this wallet has no claimed Agent ID (baw wallet agent-id). Claim one in the Binance App, Web3 wallet, Agent ID.`**
先在币安 App 中领取你的 Agent ID。Forewit 只接受持有 Agent ID 的钱包提交预测。

**`Developer Mode is off, expired or over its limit. ...`**（也可能以错误码 351802 或 351804 出现）
在币安 App 中打开 Agentic Wallet，进入设置（右上角图标），打开开发者模式，确认风险提示并批准签名请求。开发者模式有效期 7 天，每次使用都会续期，它有单独的每日额度，且钱包余额必须低于其上限。然后再运行一次命令。

**`the wallet is locked: a transaction is pending onchain or waiting for approval in the Binance App. ...`**
打开币安 App，批准或拒绝正在等待的交易。然后先运行 `status` 再重试。

**`could not read pending transactions (baw wallet tx-history --type pending); refusing to send.`**
检查网络连接，并确认 `baw wallet status --json` 显示 `CONNECTED`。然后重试。

**`the wallet has <n> pending transaction(s). Wait until they confirm, then run status before sending again. Never resend.`**
等待这些交易确认，或在币安 App 中批准它们。然后运行 `status`。切勿重复发送同一笔提交。

## 读取轮次

**`no rounds exist on this ledger yet`**
还没有任何轮次开放。每日轮次大约在 UTC 时间 03:00 开放。

**`round <n> does not exist (latest is <m>)`**
使用不超过 `<m>` 的轮次编号，或者不加 `--round` 以使用最新轮次。

**`--round must be a positive integer`**
轮次请写成普通数字，例如 `--round 3`。

**`RPC <method> failed: HTTP <code>`**、**`RPC <method> error: ...`**、**`RPC returned a block without a timestamp`**
公共 BSC 节点出现了短暂故障。等一分钟后重试。

**`RPC reports chain <id>, expected 56; refusing`**
你与节点之间的某个环节出了问题。换一个网络连接试试。工具绝不会把交易发送到错误的链上。

**`getRound returned ...`**、**`getQuestions returned an unexpected layout`**、**`getQuestions length mismatch`**、**`getReveal returned an unexpected layout`**、**`question count mismatch between getRound and getQuestions`**、**`eth_call result is not ABI words`**
节点返回了工具无法信任的数据。稍后重试。如果反复出现，请更新工具，并在 [GitHub](https://github.com/owaisahmad870/forewit/issues) 上提交 issue。

## 轮次文件

**`Titles not shown: add --round-file <path or https URL of the public round JSON> to see each event question and label.`**
这不是错误。加上 `--round-file https://forewit.xyz/data/rounds/<n>.json` 即可看到文字形式的问题。

**`round file download failed: HTTP <code>`**
文件无法访问。如果 `forewit.xyz` 没有响应，请使用备用地址 `https://forewit.pages.dev/data/rounds/<n>.json`。如果你检出了代码仓库，也可以在 `git pull` 之后使用 `web/public/data/rounds/<n>.json`。

**`--round-file must be a local path or an https URL`**
请使用 `https://` 链接或文件路径。普通的 `http://` 链接会被拒绝。

**`round file is too large`**、**`round file is not valid JSON`**、**`round file has no questions list`**
文件已损坏，或者不是 Forewit 的轮次文件。请从网站重新下载。

**`round file does not match the chain (<reason>); refusing`**
该文件属于其他轮次或网络，或者已被修改。检查文件名中的编号是否与 `--round` 一致，并重新下载一份。

**`question has no event question: refusing to present it`**
轮次文件缺少某个问题的事件文字。请重新下载一份。Forewit 绝不会展示缺少事件文字的问题。

**`--round-file <path or https URL of the public round JSON> is required on <network>`**
加上 `--round-file` 并指向公开的轮次文件。

## 你的概率

**`pack expects 1 to 16 values`**、**`slot <i> out of range: <value>`**
预测无法打包。用 `--p` 给出 1 到 16 个百分比，每个取值在 0 到 100 之间。

**`give 1 to 16 comma separated percentages, for example --p 72,15,50`**
加上 `--p`，每个问题一个百分比，用逗号分隔，不要加空格。

**`probability <i> must be a percentage from 0 to 100, got "<value>"`**
使用 `65` 或 `12.5` 这样的普通数字，不要加 `%` 符号。

**`round <n> has <k> questions, you gave <m> probabilities`**
每个问题给出恰好一个数字，顺序与 `round` 显示的一致。

**`clamped to the 1% to 99% range`**
这不是错误。Forewit 从不接受 0% 或 100%，因此会把你的值调整为 1% 或 99%。

## 参数与文件

**`Unknown option '--<name>'`**（或 Node 给出的其他参数错误）
某个参数拼写有误。请对照 `npx forewit@0.1.4 --help`。

**`ENOENT: no such file or directory, open '<path>'`**
本地的 `--round-file` 或 `--env-file` 路径不存在。检查路径，或改用轮次文件的 https 链接。

**`not even length 0x hex: ...`**、**`uint256 out of range: ...`**、**`bad address: ...`**、**`bad bytes32: ...`**
传给工具的某个值，或从凭证、轮次文件中读到的某个值格式有误。检查 `--from` 是否为完整的 `0x` 地址（40 个十六进制字符）。如果该值来自凭证，请从备份中恢复。

## 自动揭示

**选择了自动揭示，但截止后约一小时 `status` 仍显示未揭示。**
照常用 `reveal --execute --round <n>` 自己揭示。你的凭证仍保存在电脑上作为备份。请在揭示截止前完成。

## 提交

**`commits for round <n> closed at <time>`**
该轮次的提交截止时间已过。请等待下一个每日轮次；如果你在这一轮已经提交过，记得揭示。

**`NOTE: this wallet already committed in this round. Sending this commit replaces it; the older receipt is kept in case this one never lands.`**
这不是错误。截止时间前你最新的那次提交才是有效的。

**`local commit hash encoding differs from the ledger computeCommitHash; refusing`**
你的工具版本与线上合约不一致。请更新后重试。没有发送任何交易。

**`refusing to print a command with unvalidated input`**、**`refusing to send unvalidated input`**
检查 `--from` 是否为完整的 `0x` 地址（40 个十六进制字符）。

## 保存凭证

**`ACL of <path> still grants: ...`**、**`unexpected whoami output: ...`**、**`unexpected icacls output`**、**`unparsed icacls entry: ...`**（Windows）
工具无法让凭证仅对你本人可读，因此删除了它并停止执行。没有发送任何交易。请确认你的主目录位于普通的本地 NTFS 磁盘上，并以你自己的用户身份运行工具。如果反复出现，请附上该消息提交 issue。

**`<path> is still accessible to group or others`**（macOS、Linux）
原因相同。检查你是否拥有主目录及其中 `.forewit` 文件夹的所有权。

**`refusing to lock <dir>; use a dedicated subdirectory`**
凭证文件夹被解析成了你的主目录或临时目录本身。请保留默认的 `.forewit` 文件夹。

## 钱包预览与发送

**`refusing this preview: <reasons> (parsedTx fields: ...). Nothing was sent.`**
预览与 Forewit 准备的内容不一致：目标错误、函数错误、金额变化或模拟失败。不要通过其他方式发送。先运行 `status`，然后重试。

**`aborted: you did not type yes. Nothing was sent.`**
你输入的不是 `yes`。准备好后再运行一次命令。

**`the preview expired before you confirmed. Nothing was sent; run the command again for a fresh preview.`**
再运行一次命令，并尽快确认。

**`351803: risk blocked by the Binance Agentic Wallet. Stopped. Forewit never works around a risk block.`**
钱包的风险检查拦截了这次调用。Forewit 不会尝试其他途径。

**`351805: the simulation failed (<reason>). ...`**
合约会拒绝这次调用。常见原因（按合约自身的错误名称）：
* `CommitClosed`：提交截止时间已过。
* `NoAgentID`：发送交易的钱包未持有 Agent ID。请使用你的 Agentic Wallet 地址。
* `RevealNotOpen`：揭示窗口尚未开放，或已经关闭。
* `NoCommit`：该钱包在这个轮次中没有提交。
* `HashMismatch`：凭证与你在链上的提交不一致。
* `AlreadyRevealed`：你已经揭示过了，无需再操作。
* `LabelNotOwned`：`--label` 指定的名称不属于这个钱包。

运行 `status`，不要盲目重试。

**`PENDING_CONFIRMATION: approve this transaction in the Binance App now.`**
在币安 App 中批准。不要再次运行该命令。批准后交易即会完成。

**`preview failed ...`**、**`execute failed ...`**，或 **`execute returned an unknown or unreadable result, so the transaction state is unknown. Do not resend. ...`**
交易状态未知。不要重复发送。运行消息后打印的两项检查，然后运行 `status`。

## 揭示

**`reveal for round <n> opens at <time> (<in>); revealing early is refused`**
请等到提交截止时间。如果你要揭示的是更早的轮次，请加上 `--round <n>`。

**`the reveal window for round <n> closed at <time>; an unrevealed commit counts as a forfeit`**
该轮次已经来不及了，它会按弃权评分。为下一轮设置一个提醒吧。

**`no commit onchain for <wallet> in round <n>. If a commit is pending, check: ...`**
你的提交没有上链，或者你用的是其他钱包或轮次。运行消息中给出的待处理检查，并用正确的 `--round` 运行 `status`。

**`no local receipt matches the onchain commit <hash> (found <k> receipt(s) for this round in <folder>). Restore your backup receipt into that folder. ...`**
把备份的凭证保存为 `.json` 文件，放进你主目录下的 `.forewit` 文件夹，然后再次揭示。没有盐值，该轮次就会记为弃权。

**`local receipt: NONE MATCHES the onchain commit`**（出现在 `status` 中）
解决方法相同：恢复与之匹配的备份凭证。

**`receipt packed value is not canonical for this round; refusing`**
凭证文件已损坏或被修改。请从备份中恢复。

**`Round <n>: <wallet> has already revealed. Nothing to do.`**
这不是错误。

**`No receipts found in <folder> for that filter.`**（来自 `receipt`）
这台电脑上没有保存该钱包或轮次的凭证。检查 `--from` 和 `--round`，或从备份中恢复。

## 公开资料

**`--label <your Agent ID name, for example owaisahmad> is required (or --off to opt out)`**
加上 `--label yourname`，填写你的 Agent ID 名称，使用小写，不带 `.ai`。只能包含字母、数字和 `_`。

## forewit agent 与 schedule

**`set FOREWIT_LLM_MODEL (and FOREWIT_LLM_URL, FOREWIT_LLM_KEY, FOREWIT_LLM_API as needed) in your environment or in a file passed with --env-file. ...`**
至少在环境变量中，或在通过 `--env-file` 传入的文件中设置 `FOREWIT_LLM_MODEL`。

**`FOREWIT_LLM_API must be openai (any OpenAI compatible chat completions endpoint) or anthropic`**
设置 `FOREWIT_LLM_API=openai` 或 `FOREWIT_LLM_API=anthropic`。

**`FOREWIT_LLM_URL is not a valid URL`**、**`FOREWIT_LLM_URL must be https (plain http only for localhost), so your key never travels in clear`**
修正地址。使用 `https://`；如果模型运行在你自己的电脑上，可以使用 `http://localhost`。

**`could not reach the LLM at <host> ...`**、**`the LLM at <host> answered HTTP <code>; ...`**、**`the LLM reply is not JSON. ...`**、**`the LLM reply has no text; refusing. ...`**、**`the model declined to answer. ...`**
检查地址、模型名称和密钥。没有保存或发送任何内容。

**`refusing the model output (<why>); nothing was saved or sent. The model replied: ...`**
模型必须恰好回复 `{"p":[...]}`，每个问题一个 1 到 99 之间的数字。请重试或换一个模型。

**`commits for round <n> closed at <time>; nothing to forecast. Reveal with: ...`**
运行消息中给出的揭示命令。

**`no saved commit receipts for <wallet> on <network> in <folder>; nothing to reveal`**
这台电脑上没有凭证。请从备份中恢复，或检查 `--from`。

**`no committed round is in its reveal window now (newest committed round: <n>). Check with: ...`**
太早或太晚了。运行消息中给出的 `status` 命令。

**`schedule needs BSC mainnet: ...`**、**`--at must be a local time as HH:MM, for example 13:00`**、**`--env-file does not exist`**、**`a path contains " or %, which a .cmd file cannot quote safely; ...`**、**`<file> failed...; the schedule may not be registered`**
修正消息中指出的参数或路径，然后再次运行 `schedule`。详见 [forewit agent](../for_agents/forewit_agent.md)。

## 仍未解决？

在 [GitHub](https://github.com/owaisahmad870/forewit/issues) 上提交 issue，附上消息内容和你运行的命令。切勿在那里粘贴你的盐值或凭证。
