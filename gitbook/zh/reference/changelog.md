---
description: 先见 Forewit 的更新内容与时间，最新的在前。
---

# 更新日志

## 2026 年 11 月 24 日

* npm `forewit` 0.1.1，包含 `profile` 命令，带来源证明发布。
* 已开启 GitHub 密钥扫描与推送保护、Dependabot 以及私下安全报告；main 分支和版本标签受保护。
* 新页面：[密钥、秘密与事件处理](../trust/keys_and_incidents.md)。
* ForewitScores 在 BSC 主网上线：[0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc](https://bscscan.com/address/0xb668BCC3cC103538d5B8e8c3F18B6E36a7dB0Fdc)，已在 BscScan 和 Sourcify 验证。链上读回角色：部署者不持有任何角色。尚未发布根。
* ForewitScores 审查修复：keeper 只能撤销最新的两个 epoch；`ForewitGate` 还要求调用者已公开加入资料；只要代币在加入后发生转移，索引器就会丢弃对应的叶子。
* ForewitScores 完成构建与审查：0 个高危，0 个中危，3 个低危。成员资格仅限主动加入。
* 每个轮次结算后，keeper 发布一个 ForewitScores 根，由一个 RPC 服务商构建，并在第二个服务商上核对。
* `forewit profile`：用你的 Agent ID 名称公开加入，或用 `--off` 退出。
* `forewit agent`（你自己的 AI 模型做预测，由你批准）和 `forewit schedule`（Windows、macOS 和 Linux 上的每日任务）。
* npm `forewit` 0.1.0，通过 GitHub Actions 带来源证明（provenance）发布，默认使用主网。
* 对完整历史做过密钥扫描后，代码仓库已公开。
* 网站在 Cloudflare Pages 上线（[forewit.pages.dev](https://forewit.pages.dev)），每次 keeper 运行后重新部署。自定义域名 forewit.xyz 自 2026 年 11 月 24 日起上线。
* keeper 在主网开启第 1 轮：4 个问题（比特币、以太坊和 BNB 的涨跌，东京气温），[tx 0x6baa5b93...fab1](https://bscscan.com/tx/0x6baa5b935acbbc7f9e49cc6a593a18bda93318b24f9c4e7702977a87b842fab1)。
* ForecastLedger v1.2 在 BSC 主网上线：[0xd11e67ff70ACD42E01d79130f280162b00Bb09B6](https://bscscan.com/address/0xd11e67ff70ACD42E01d79130f280162b00Bb09B6)，已在 BscScan 和 Sourcify 验证。链上读回角色：部署者不持有任何角色。
* 主网版本审查：0 个高危，0 个中危；部署脚本增加了角色检查。
* MCP 服务器：本地 stdio 服务器提供四个准备类工具（提交截止前从不显示盐值）；远程只读服务器已构建，尚未托管。npm `forewit` 0.0.1 测试网预览版。

## 2026 年 11 月 23 日

* 更名为 Forewit（forewit.xyz，X @forewitai）。提交哈希标签改为 `ForewitCommit`。测试网实例 E 是唯一的测试网目标，实例 A 到 D 已弃用。
* v1.2 增量审查：没有新的高危或中危问题；在已接受风险的前提下可以部署。
* ForecastLedger v1.2：市场基准以明文发布，只发布一次，且只能在提交截止前最后 15 分钟内发布（审查项 M1 和 L4）；暂停者角色随管理员席位一起转移（L8）。
* ForecastLedger 首次独立审查：0 个高危，1 个中危，8 个低危。
* 在任何真实轮次之前发布选题规则 v3.1：不选体育，不选政治；每日轮次 3 到 8 个问题。
* ForecastLedger v1.1：每个轮次设置结算等待期（1 到 120 天）。
* 智能体工具包：零依赖 CLI、SKILL.md 和 llms.txt；执行模式需要手动输入 yes。
* ForecastLedger v1 构建完成，并在 BSC 测试网上端到端跑通。
