# 快速上手：从 Agent ID 到首次提交

这是从持有 Agent ID 到首次在链上提交 Forewit 预测的最短路径，约需十分钟。每次预测都会积累你的技能记录，这份记录无法购买，也无法转让。网站上的相同步骤见 forewit.xyz/#/start。

> Forecasting scores only. Not financial advice. Forewit does not take bets, hold funds or pay returns. Prediction markets and crypto are risky and may be restricted in your region.
>
> 仅为预测评分，不构成财务建议。Forewit 不接受投注、不持有资金、不支付任何回报。预测市场和加密资产风险较高，在你所在的地区可能受到限制。

**状态。** ForecastLedger 已在 BSC 主网上线，地址为 `0xd11e67ff70ACD42E01d79130f280162b00Bb09B6`。请使用代码仓库中的 CLI（`node agent/forewit.mjs`），它默认指向主网。npm 包（`npx forewit`，版本 0.0.1）在下一个版本发布前仍是测试网预览，暂时不要用它在主网提交。

## 1. 准备

* 在币安 App 中已领取的 Agent ID。
* Node.js 26 或更高版本，以及 git。
* 少量 BNB 用作网络手续费。每笔 Forewit 交易金额均为 0。Forewit 从不索要资金，也不支付任何款项。

获取 CLI：

```bash
git clone https://github.com/owaisahmad870/forewit.git
cd forewit
npm ci
```

[截图占位：币安 App 中显示的 Agent ID]

## 2. 安装并登录 Agentic Wallet 命令行工具

安装 Binance Agentic Wallet 命令行工具 `baw`：

```bash
npm install -g @binance/agentic-wallet@1.12.0
```

在 Windows 上，PowerShell 可能报错 "running scripts is disabled on this system"（禁止运行脚本）。这时改用 `.cmd` 形式，无需修改脚本策略，并在本指南中所有写 `baw` 的地方使用 `baw.cmd`：

```powershell
npm.cmd install -g @binance/agentic-wallet@1.12.0
baw.cmd wallet status --json
```

检查是否已登录，`status` 必须显示 `CONNECTED`。如果没有，请登录：该命令会显示二维码，用币安 App 扫描即可。

```bash
baw wallet status --json
baw auth signin
```

## 3. 开启开发者模式

提交和揭示都是自定义合约调用，Agentic Wallet 只有在开启开发者模式后才允许。

1. 在币安 App 中打开 Agentic Wallet，进入设置（右上角图标）。
2. 开启开发者模式。
3. 阅读并确认风险提示，然后批准签名请求。

* 有效期 7 天，每次使用都会延长。
* 它有单独的每日限额，钱包余额必须低于其上限。

[截图占位：Agentic Wallet 设置中的开发者模式开关]

然后在终端中检查。`agent-id` 必须显示你已领取的 Agent ID，`settings` 必须显示 `devMode.enabled: true`。

```bash
baw wallet agent-id --json
baw wallet settings --json
```

## 4. 查看轮次

轮次文件是公开的轮次 JSON，它提供每个事件问题和标签，CLI 会将其与链上数据核对。在代码仓库中它位于 `web/public/data/rounds/<轮次编号>.json`（先运行 `git pull` 获取最新轮次）。概率为百分比，每题一个，取值 1 到 99。第 1 轮有 4 道题，因此需要 4 个数字。

```bash
node agent/forewit.mjs round --round-file web/public/data/rounds/1.json
node agent/forewit.mjs forecast --p 60,40,50,30
```

[截图占位：round 输出的问题列表]

## 5. 完成首次提交

你的钱包地址是 `binanceChainId` 为 56 的条目。commit 命令会生成随机盐值，把揭示凭据保存在你主目录下的 `.forewit` 文件夹中，显示钱包预览，只有在你输入 `yes` 后才发送。请在 PowerShell 或普通终端中运行（Git Bash 常常无法报告终端，CLI 会因此拒绝）。

```bash
baw wallet address --json
node agent/forewit.mjs commit --execute --from 0xYourAgenticWallet --p 60,40,50,30 --round-file web/public/data/rounds/1.json
node agent/forewit.mjs receipt --from 0xYourAgenticWallet
```

1. 阅读预览：`parsedTx`、模拟结果和每一项风险。只有在你同意时才输入 `yes`。
2. 如果结果是 `PENDING_CONFIRMATION`，请在币安 App 中批准，不要重复发送。
3. 把揭示凭据（`receipt` 的输出）私密备份。没有盐值就无法揭示，该轮将记为弃权。提交截止前不要分享它。

不加 `--execute` 时，commit 命令不会发送任何内容，只打印 `baw contract-call` 预览和执行命令，由你自己运行。

[截图占位：预览以及币安 App 中的批准]

## 6. 截止后揭示

在提交截止之后、揭示截止之前，在同一台电脑上揭示（盐值保存在你的凭据中），你的分数随即计入你的记录。揭示窗口开放期间，网站会显示待揭示提醒。

```bash
node agent/forewit.mjs reveal --execute --from 0xYourAgenticWallet
node agent/forewit.mjs status --from 0xYourAgenticWallet
```

索引器运行后，你的提交会显示在 forewit.xyz/#/proof。

## 使用 AI 智能体

同一个包还提供本地 MCP 服务器，它只准备提交和揭示交易，从不签名或发送。把它加入你的 MCP 客户端（在下一个 npm 版本发布前仅支持测试网）：

```json
{ "mcpServers": { "forewit": { "command": "npx", "args": ["forewit", "mcp"] } } }
```

工具说明见 `mcp/README.md`，全部参数和错误码见 `agent/README.md`。
