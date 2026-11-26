---
description: 关于先见 Forewit 最常见问题的简短回答。
---

# 常见问题

## 一句话介绍先见 Forewit？

你的判断，链上为证：密封预测，以市场价格为基准，每个 Agent ID 一份可验证的预测记录，运行在 BNB Smart Chain 上。

## 这是投机或交易吗？

不是。你给出概率，得到一个分数。Forewit 不持有资金，不收存款，不对外支付，也没有代币。每笔交易金额都是 0，你只支付网络 gas。仅为预测评分，不构成投资建议。

## 需要花多少钱？

只有 BSC gas。一次提交加一次揭示大约 190,000 gas，按 2026 年 11 月的 gas 价格约为 0.00001 BNB。

## 我需要 Agent ID 吗？

需要。没有 Agent ID 的钱包提交会被账本拒绝。正因如此，每份记录都是一人一份，无法购买。

## 可以用手机参与吗？

可以，在浏览器中使用云端 AI 智能体：见[用手机或任意浏览器参与](../getting_started/play_from_phone.md)。

## 我需要准备什么？

一个 Agent ID、在币安 App 中开启开发者模式（Developer Mode），以及少量用于 gas 的 BNB。详见 [快速上手](../getting_started/quickstart.md)。

## 为什么要分提交和揭示两步？

为了防止别人抄你的答案。截止时间之前，你的提交只是一个密封哈希。截止之后你再打开它，内容必须与哈希一致。详见 [提交与揭示](../how_it_works/commit_and_reveal.md)。

## 忘记揭示会怎样？

会被视为弃权（forfeit）：该轮次的每个问题都按最差分数计算。请在揭示窗口内回来操作（每日轮次截至次日 23:00 UTC），或在提交时开启自动揭示，或使用 [forewit agent](../for_agents/forewit_agent.md) 中的每日计划任务。

## 我必须回来揭示吗？

开启自动揭示就不用：在 `commit` 上加 `--auto-reveal`，或在 `forewit start` 询问时回答 yes。截止后 Forewit 的 keeper 会替你揭示，你无需支付 gas，也无需第二步。截止后约一小时用 `status` 检查；如果仍显示未揭示，请自己揭示。详见 [提交与揭示](../how_it_works/commit_and_reveal.md)。

## 开启自动揭示后，截止前别人能读到我的预测吗？

不能。提交中的副本用 drand 时间锁锁定到提交截止后约一分钟，在此之前任何人（包括 Forewit）都无法读取。信任假设是 drand 网络（League of Entropy）不会提前公布轮次；如果达到门限数量的运营方串通，他们可以提前读到预测，但无法修改。

## 我能看到自己的表现吗？

能。打开 [forewit.xyz/#/me](https://forewit.xyz/#/me) 并粘贴你的钱包地址，无需登录。它按轮次告诉你是否比市场更准、差多少分，并给出双方的失误分，以及总体的轮次数、每题平均分和进入排名后的名次。命令行：`npx forewit@0.1.6 results --from 0xYourAgenticWallet`。

## 弄丢了盐值怎么办？

那就无法揭示，该轮次会变成弃权。请用 `receipt --show-salt` 备份每张回执，并妥善保密。

## AI 助手能替我保管密钥或替我输入 yes 吗？

不能。Forewit 从不索要私钥、助记词或配对码。`--execute` 会拒绝通过管道或脚本输入的 yes。只有你本人在自己的终端里才能发送交易。

## 可以让我自己的 AI 模型来预测吗？

可以。`forewit agent` 只把问题文本发送给你选择的模型，然后由你批准提交。详见 [forewit agent](../for_agents/forewit_agent.md)。

## 分数怎么算？

每个问题计算 Brier 分数，并与截止时间时的市场价格比较，两者之差就是你的预测技能。排行榜按预测技能排名，样本少时会向零收缩。详见 [评分](../how_it_works/scoring.md)。

## 问题由谁来选？

由 keeper 按照公开规则（选题规则 v3.1）选出：每日加密货币问题和其他流动性好的 Predict.fun 市场，不选体育，不选政治，每轮 3 到 8 个问题。该规则在第一个轮次之前就已发布，轮次进行期间不会更改。

## Forewit 团队能改我的分数吗？

不能。任何人都无法修改提交、揭示、结果或分数。团队确实会发布市场基准，它决定该轮次的预测技能，但发布受严格的时间规则约束。详见 [所有者权限](../trust/owner_permissions.md)。

## 我的名字会公开吗？

只有你用 `profile` 主动加入时才会公开。无论是否加入，你的钱包地址和预测在链上都是公开的。详见 [隐私](../trust/privacy.md)。

## 其他应用如何使用我的分数？

通过 ForewitScores：一次 `verify` 调用即可对照最新发布的根核验你的分数。详见 [以 Forewit 分数设置准入门槛](../developers/gate_on_a_score.md)。目前还没有发布根；第一个根会在第一个有主动加入持有者的轮次结算后发布。

## 经过审计了吗？

已由多个独立的 AI 智能体做过独立审查，未解决的高危和中危问题均为 0，但尚未经过人工安全公司审计。详见 [安全审查](../trust/security.md)。

## 代码开源吗？

开源，采用 MIT 许可证：[github.com/owaisahmad870/forewit](https://github.com/owaisahmad870/forewit)。四个合约都已在 BscScan 和 Sourcify 验证。
