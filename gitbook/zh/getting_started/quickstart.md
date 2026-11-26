---
description: 用电脑、你的 AI 智能体或手机，完成你在先见 Forewit 的第一次预测。
---

# 快速上手

先见 Forewit 每天挑选几个真实问题。你为每个问题给出发生的概率，它会被密封上链，之后对照市场价格评分。

仅为预测评分，不构成投资建议。

## 准备工作

* 一个 Agent ID，在币安 App 中领取。
* 开启开发者模式（Developer Mode）：在币安 App 中打开 Agentic Wallet，再打开设置（右上角图标）。
* 少量用于 gas 的 BNB。先见的每笔交易金额都是 0。

## 路径 1：你的电脑

1. 如果还没有 Node.js，请从 [nodejs.org](https://nodejs.org) 安装。
2. 运行 `npx forewit@latest start`。在 Windows PowerShell 中输入 `npx.cmd forewit@latest start`。
3. 打开登录链接，在币安 App 中核对配对码并批准。然后为每个问题输入 1 到 99 的概率。
4. 对自动揭示选择 yes（推荐），查看钱包预览，输入 `yes` 发送。

## 路径 2：你的 AI 智能体

1. 安装币安 Agentic Wallet 技能及其命令行工具：
   ```bash
   npx skills add binance/binance-skills-hub --skill binance-agentic-wallet
   npm install -g @binance/agentic-wallet@1.12.0
   ```
2. 添加先见：
   ```bash
   npx skills add owaisahmad870/forewit --skill forewit
   ```
3. 对你的智能体说："Forecast with Forewit"。
4. 查看它展示的钱包预览，确认无误后才输入 `yes`。

## 路径 3：你的手机

在浏览器中使用云端 AI 智能体：见 [用手机或任意浏览器参与](play_from_phone.md)。

## 任意市场，任意时间

你也可以在每日轮次之外，预测 Predict.fun 上任意一个二元市场。

1. 在 [developers.predict.fun](https://developers.predict.fun) 免费获取密钥，并设为环境变量 `PREDICT_API_KEY`。
2. 查找市场：`npx forewit@latest markets --search "bitcoin"`
3. 提交预测：`npx forewit@latest predict --market <id> --p 65 --auto-reveal --execute`

预测只有在市场最后 60 秒之前发送，并且该市场最近 24 小时成交额至少 100 美元时才计分。

## 发送之后

* **揭示。** 开启自动揭示后无需第二步：截止后先见会替你揭示。未开启时，请在 UTC 23:00 截止后的 24 小时内揭示：`npx forewit@latest reveal --execute --round <n>`
* **备份回执。** 运行 `npx forewit@latest receipt --show-salt`，把输出私下保存。没有它就无法手动揭示。
* **查看分数。** 打开 [forewit.xyz/#/me](https://forewit.xyz/#/me) 并粘贴你的钱包地址。

新的每日轮次约在 UTC 03:00 开放，提交截止到 UTC 23:00。遇到问题？见 [故障排查](troubleshooting.md)。
