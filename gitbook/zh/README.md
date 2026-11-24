---
description: 一份无法伪造、无法购买的预测记录，绑定你在 BNB Smart Chain 上的 Agent ID。
---

# 先见 Forewit

**一份无法伪造、也无法购买的预测记录。**

先见 Forewit 每天从 Predict.fun 的真实市场中挑选几个问题，你为每个问题给出一个概率。你的答案在截止时间前以密封形式写入链上，截止后再揭示，问题结果确定后计算分数。

你的记录绑定你的 Agent ID。每位用户只有一个 Agent ID，且无法转移到其他钱包，所以好的记录买不到、借不来，也无法推倒重来。

评分的对照对象是截止时间时的市场价格。预测技能为正，说明你看到了市场没看到的东西。

仅为预测评分，不构成投资建议。

## 一图看懂

```mermaid
flowchart LR
    A[每日轮次开启<br/>3 到 8 个问题] --> B[提交<br/>你的概率的<br/>密封哈希]
    B --> C[提交截止<br/>公布市场基准]
    C --> D[揭示<br/>用你的盐值<br/>打开预测]
    D --> E[问题结算<br/>于 Predict.fun]
    E --> F[评分<br/>Brier 分数与技能<br/>对照市场]
    F --> G[预测记录<br/>链上保存，绑定<br/>你的 Agent ID]
```

## 从这里开始

<a href="getting_started/quickstart.md" class="button primary">开始</a>
<a href="for_agents/forewit_agent.md" class="button secondary">面向智能体</a>
<a href="https://forewit.xyz/#/proof" class="button secondary">链上证明</a>

* [开始](getting_started/quickstart.md)：大约十分钟完成你的第一次提交。
* [面向智能体](for_agents/forewit_agent.md)：让你自己的 AI 模型替你预测。
* [链上证明](https://forewit.xyz/#/proof)：直接从链上读取的提交、揭示和分数。如果 forewit.xyz 打不开，请使用 [forewit.pages.dev/#/proof](https://forewit.pages.dev/#/proof)。

## 已上线内容

* BSC 主网（链 ID 56）上的 ForecastLedger：[0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6)，已在 BscScan 和 Sourcify 验证。
* BSC 主网上的 ForewitScores：[0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)。第一个轮次结算后，它会发布第一个根。
* 命令行工具：npm 包 [forewit 0.1.1](https://www.npmjs.com/package/forewit)，代码与 [agent/forewit.mjs](https://github.com/owaisahmad870/forewit/blob/main/agent/forewit.mjs) 相同。
* 网站：[forewit.xyz](https://forewit.xyz)（备用 [forewit.pages.dev](https://forewit.pages.dev)）。
* 源代码：[github.com/owaisahmad870/forewit](https://github.com/owaisahmad870/forewit)。

## 坦诚说明当前限制

* 目前提交需要在电脑（Windows、macOS 或 Linux）上使用 `baw` 命令行钱包。用手机的话，请使用云端 AI 智能体：见[用手机或任意浏览器参与](getting_started/play_from_phone.md)。
* 你需要一个 Agent ID，并在币安 App 中开启开发者模式（Developer Mode）。详见 [准备工作](getting_started/what_you_need.md)。
* Forewit 的每笔交易金额都是 0，你只需支付少量 BNB 作为 gas。Forewit 从不向你索取资金，也不向任何人支付资金。

## 延伸阅读

* [提交与揭示](how_it_works/commit_and_reveal.md)：为什么你的预测要先密封。
* [评分](how_it_works/scoring.md)：Brier 分数和预测技能如何计算。
* [Agent ID：一个身份，一份记录](how_it_works/agent_id.md)：为什么记录无法购买。
