---
description: 首次在先见 Forewit 提交预测前需要准备的五样东西，以及目前的限制。
---

# 准备工作

## 完成后你将拥有

* 一个 Agent ID、Node.js、已登录的 `baw` 钱包工具、已开启的开发者模式，以及少量用作 gas 的 BNB。
* 每一项都有对应的检查方法，确保在首次提交前一切正常。

你需要准备五样东西。大多数人已经有了第一样。

{% hint style="info" %}
捷径：`npx forewit@0.1.5 start`（在 Windows PowerShell 中为 `npx.cmd forewit@0.1.5 start`）会替你检查第 3 和第 4 项，提议为你安装 `baw`，并通过一个链接和一个配对码帮你登录，你在币安 App 中批准即可。见 [快速上手](quickstart.md)。
{% endhint %}

## 1. 一个 Agent ID

Agent ID 就是你在币安 App 中领取的 `.ai` 名称。先见 Forewit 只接受持有 Agent ID 的钱包提交预测，这一点由合约自身校验（[ForecastLedger.sol](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol) 中的 `commit`）。

Agent ID 存放在你的 Agentic Wallet 中，该钱包有自己独立的地址。你就是用这个地址来做预测。

为什么这很重要，请看 [Agent ID：一个身份，一份记录](../how_it_works/agent_id.md)。

> 截图占位：币安 App 中显示已领取 .ai 名称的 Agent ID 页面

## 2. 一台安装了 Node.js 26 的电脑

Forewit 以一个小巧的命令行工具运行。请从 [nodejs.org](https://nodejs.org) 安装 Node.js 26 或更高版本。Windows、macOS 和 Linux 均可使用。

检查版本：

```bash
node --version
```

预期结果：`v26` 或更高。

## 3. Agentic Wallet 命令行工具（`baw`）

`baw` 是币安 Agentic Wallet 的命令行工具。Forewit 用它向你展示每笔交易的预览，并在你输入 `yes` 之后发送交易。Forewit 本身从不持有任何私钥。

```bash
npm install -g @binance/agentic-wallet@1.12.0
```

在 Windows 上，PowerShell 可能会提示 "running scripts is disabled on this system"（系统禁止运行脚本）。此时改用 `.cmd` 形式即可，无需修改执行策略：

```powershell
npm.cmd install -g @binance/agentic-wallet@1.12.0
baw.cmd wallet status --json
```

遇到这种情况时，文档中凡是写 `baw` 的地方都请输入 `baw.cmd`。`npx` 同理，输入 `npx.cmd`。

登录一次即可。该命令会显示一个二维码，用币安 App 扫码：

```bash
baw auth signin
```

然后检查：

```bash
baw wallet status --json
```

预期结果：状态显示 `CONNECTED`。

## 4. 开启开发者模式

提交和揭示都属于自定义合约调用，Agentic Wallet 只有在开启开发者模式后才允许这类调用。

1. 在币安 App 中打开 Agentic Wallet，进入设置（右上角图标）。
2. 打开开发者模式。
3. 阅读并确认风险提示，然后批准签名请求。

> 截图占位：Agentic Wallet 设置中的开发者模式开关

{% hint style="warning" %}
开发者模式有效期为 7 天，每次使用都会自动续期。它有单独的每日额度，且钱包余额必须低于其上限。一旦失效，提交会以错误码 351802 或 351804 失败，直到你重新开启。
{% endhint %}

在终端中检查：

```bash
baw wallet agent-id --json
baw wallet settings --json
```

预期结果：`agent-id` 显示你已领取的名称，`settings` 显示 `devMode.enabled: true`。

## 5. 少量 BNB 作为 gas

Forewit 的每笔交易金额都为 0。你只需支付网络 gas，在 BNB Smart Chain 上只是极少量的 BNB。Forewit 从不向你索要资金，也不向任何人支付资金。

## 如实说明的限制

* 目前提交预测需要在电脑上（Windows、macOS 或 Linux）使用 `baw`。用手机的话，请使用云端 AI 智能体：见[用手机或任意浏览器参与](play_from_phone.md)。
* 发送交易需要交互式终端，因为必须由你亲自输入 `yes`。在 Windows 上请使用 PowerShell 或 Windows Terminal。Git Bash 往往无法识别为终端，此时工具会拒绝执行。
* 该工具只在 BSC 主网（chain 56）上签名。

仅为预测评分，不构成投资建议。

下一步：[快速上手：你的第一次提交](quickstart.md)。
