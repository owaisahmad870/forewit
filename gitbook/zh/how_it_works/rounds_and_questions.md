---
description: 每日轮次如何运行，以及挑选问题的固定规则。
---

# 每日轮次与问题选择

## 时间表

* 约 UTC 03:00：keeper 开启每日轮次并挑选问题。
* 当天 UTC 23:00 之前：你提交预测。截止前的新提交会替换旧提交。市场基准在最后 15 分钟内公布。
* 接下来的 24 小时：揭示窗口。
* 问题在提交截止后 72 小时内于 Predict.fun 结算；揭示截止已过且全部结算后，该轮开始评分。
* 揭示截止 7 天后（长周期轮次为 120 天）仍未结算的问题，任何人都可以将其设为 Void。
* 在主网上，合约强制要求提交窗口至少 2 小时、揭示窗口至少 12 小时，且各自最多 7 天（[ForecastLedger.sol](https://github.com/owaisahmad870/forewit/blob/main/contracts/src/ForecastLedger.sol)）。

## 问题从哪里来

每个问题都是 [Predict.fun](https://predict.fun) 上的一个二元市场，在链上以白名单内 Conditional Tokens 合约上的 conditionId 标识。结果来自链上，从不来自网站。问题总是以事件问题加市场标签的形式显示，例如 `Highest temperature in Tokyo on November 25? · 15°C`。

## 选题规则（v3.1）

一条固定的、预先登记的规则，任何人都可以用存档数据重新运行（[docs/QUESTION_SELECTION.md](https://github.com/owaisahmad870/forewit/blob/main/docs/QUESTION_SELECTION.md)）。

每个问题必须：

* 恰好有两个结果（Yes 或 Up，No 或 Down），且尚未结算。
* 位于账本白名单内的 Conditional Tokens 合约上。
* 不是体育或电竞。
* 不是政治（Elections、Trump 或 Politics 标签），但标为 Economy 或 Fed 的宏观和央行市场除外。
* 如果不是每日加密市场：订单簿双边都有挂单，价差不超过 10 个点，24 小时成交额至少 100 美元。
* 是该轮中来自其事件的唯一市场。

按轮次类型：

* 每日轮次：所有每日加密 Up 或 Down 市场（Bitcoin、Ethereum、BNB）加上流动性好的事件市场，每个在提交截止后 6 到 72 小时内结束，且不晚于 2026 年 12 月 8 日；3 到 8 个问题。
* 长周期轮次：标签为宏观、加密与金融、科技与 AI、科学与天气的流动性好的事件市场，每个在提交截止后 72 小时到 100 天内结束；3 到 8 个问题。

规则有版本号，并在下一轮之前公布。轮次开启后绝不更改规则。在轮次封存前就已结算、或赔付被拆分的问题为 Void，所有人都跳过。

接下来阅读：[提交与揭示](commit_and_reveal.md)。
