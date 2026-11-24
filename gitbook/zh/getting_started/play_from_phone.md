---
description: 用手机或任意浏览器，通过云端 AI 智能体参与先见 Forewit；密钥留在币安 App，salt 留在你自己的私有仓库。
---

# 用手机或任意浏览器参与

完成后你将拥有：一个在浏览器里运行的云端 AI 智能体（网页版 Claude Code 或 Codex cloud）。它会读取当前轮次、准备你的提交、展示钱包预览，并且只有在你输入 yes 之后才会发送。不需要电脑。

仅为预测评分，不构成投资建议。

{% hint style="info" %}
2026 年 11 月 24 日已用手机实测：点击链接登录、读取轮次、准备提交、把回执保存到私有仓库、钱包预览，全部通过。云端智能体的第一次真实发送安排在第 2 轮。
{% endhint %}

## 为什么用云端智能体，而不是聊天窗口
* 持有你 Agent ID 的钱包（Agentic Wallet）只能通过 Binance Agentic Wallet 命令行工具签名，而它需要命令行环境。
* 聊天窗口（claude.ai、ChatGPT）没有命令行。云端编程智能体有，而且运行在你自己的沙盒里，所以先见永远不会持有你的钱包会话或 salt。

## 步骤
1. 打开[先见智能体模板](https://github.com/owaisahmad870/forewit-agent-template)，点击 **Use this template**，再点击 **Create a new repository**，并选择 **Private**。结果：你的 GitHub 账号里多了一个私有副本。
2. 打开 **claude.ai/code**（或 Claude App 里的 Code 标签），连接 GitHub 并选择你的新仓库。结果：在你的仓库上开启新会话。
3. 在环境设置中，允许访问 `www.binance.com`、`bsc-rpc.publicnode.com`、`forewit.xyz`、`api.github.com` 以及 npm 仓库。结果：智能体的网络检查返回 2xx 或 3xx，而不是 403。
4. 发送 `Follow CLAUDE.md. Commit my forecast for the current Forewit round.`。结果：智能体给出一个登录链接和一个配对码。
5. 在同一部手机上点击链接，在币安 App 里核对配对码并批准。结果：智能体显示 CONNECTED 以及你的 BSC 地址。
6. 为每道题给出一个百分比。结果：智能体把回执保存到你的私有仓库，并展示钱包预览（目标是先见账本合约，金额为 0）。
7. 输入 yes。结果：得到一个交易哈希，或者提示你在币安 App 里批准。
8. 提交截止后，在同一仓库开启新会话，发送 `Follow CLAUDE.md. Reveal my forecast.`。

{% hint style="warning" %}
回执里包含 salt。请保持你的模板副本为私有，绝不要把 salt 粘贴到任何地方。丢失 salt 意味着该轮按弃权计算。
{% endhint %}

## 谁持有什么
* 你的钱包密钥：币安（Agentic Wallet）。登录需你在币安 App 里批准。
* 钱包会话：只在你的云端沙盒里，每次会话结束时退出登录。
* 你的 salt 和回执：你的私有仓库。
* 先见：什么都不持有。

## 安全与合规
* 你在这里使用的 Agentic Wallet 只保留少量用于 gas 的 BNB，并让智能体在每次会话结束时退出登录。
* 登录链接和配对码来自在你自己沙盒中运行的官方 Binance Agentic Wallet 命令行工具，只展示给你本人。先见从不接触它们，从不托管登录页面，也从不保存钱包会话；这与在你自己电脑上运行命令行工具的流程相同。
* 模板固定了 forewit 的版本，新版本不会在未经审阅的情况下与已登录的钱包一起运行。
