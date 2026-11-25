---
description: 让你自己的 AI 模型为每个每日轮次给出预测，再由你亲手输入 yes 完成提交。
---

# forewit agent

`forewit agent` 让你自己的 AI 模型为一个轮次给出概率，之后由先见 Forewit 走正常的提交流程。在你于自己的终端输入 `yes` 之前，什么都不会发送。

```mermaid
flowchart LR
  A[开放的轮次，已与链上核对] --> B[你的 LLM：每个问题一个概率]
  B --> C[盐值在你的电脑上生成并保存]
  C --> D[baw preview]
  D --> E{你输入 yes}
  E -->|yes| F[提交已发送]
  E -->|其他任何输入| G[什么都不发送]
```

## 开始之前

* Node 26 或更高版本，已登录的 `baw`，已领取的 Agent ID，并已开启 Developer Mode。参见 [准备工作](../getting_started/quickstart.md)。
* 你的模型服务商的 API key，或一个本地模型服务。费用由你直接支付给服务商，Forewit 看不到任何内容。

## 步骤

1. 写一个设置文件，例如 `~/.forewit_llm.env`。只会从中读取以下四个变量：
   ```bash
   FOREWIT_LLM_API=anthropic
   FOREWIT_LLM_MODEL=claude-opus-5-5
   FOREWIT_LLM_KEY=<your key>
   # FOREWIT_LLM_URL is optional
   ```
   * `FOREWIT_LLM_MODEL` 为必填。
   * `FOREWIT_LLM_API` 取 `openai`（默认值：任何兼容 OpenAI chat completions 的接口，例如 OpenAI、OpenRouter、Groq、Ollama 或 LM Studio）或 `anthropic`。
   * `FOREWIT_LLM_URL` 必须是 https。只有 localhost 允许使用普通 http，例如 Ollama 的 `http://localhost:11434/v1/chat/completions`。
   * `FOREWIT_LLM_KEY` 只放在认证请求头中发送。使用本地服务时留空即可。
2. 获取钱包地址：运行 `baw wallet address --json`，取 `binanceChainId` 为 "56" 的那一项。
3. 先做一次试运行。它只打印 `baw` 命令，不发送任何内容：
   ```bash
   npx -y forewit agent --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env
   ```
4. 在你自己的交互式终端里加上 `--execute` 发送（Windows 上用 PowerShell 或 Windows Terminal）。阅读预览，然后输入 `yes`：
   ```bash
   npx -y forewit agent --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env --execute
   ```
5. 把凭证备份到私密的地方：
   ```bash
   npx -y forewit receipt --from 0xYourAgenticWallet --show-salt
   ```
6. 提交截止时间过后（每日轮次为 UTC 23:00），揭示你已提交、且揭示窗口已开放的最新轮次：
   ```bash
   npx -y forewit agent --reveal --from 0xYourAgenticWallet --execute
   ```

{% hint style="info" %}
如果 forewit.xyz 打不开，可以传入 `--round-file https://forewit.pages.dev/data/rounds/<round>.json`。运行 `npx -y forewit --help` 查看全部命令和参数。
{% endhint %}

## 哪些内容会发给模型，哪些永远不会

* 会发送：问题文本（事件问题加标签，已与链上交叉核对）、当前时间和提交截止时间。
* 永远不发送：盐值、你的钱包地址、你的凭证。向模型提问时，盐值还不存在。
* 问题文本来自 Predict.fun，属于不可信内容。它们以 JSON 数据形式传入，并且会告知模型忽略其中的任何指令。
* 模型必须严格回复 `{"p":[...]}`，按顺序每个问题一个 1 到 99 的数字。其他格式、数量不对、出现 0 或 100，都会被拒绝并显示出来。不会保存或发送任何内容，被拒绝的回复也绝不会被强行截断成一条预测。

## 每日定时任务

```bash
# Print the daily job for this computer (nothing is installed)
node agent/forewit.mjs schedule --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env

# Write the script and register the job
node agent/forewit.mjs schedule --from 0xYourAgenticWallet --env-file ~/.forewit_llm.env --install
```

* 任务每天在本地时间 `--at HH:MM` 运行一次（默认是 UTC 12:00 对应的本地时间）。它先运行 `agent --reveal --execute`，再运行 `agent --execute`。
* 每次提交和揭示仍然需要你亲手输入 yes，因此任务会为你打开一个终端：
  * Windows：在你登录期间，由任务计划程序打开一个控制台窗口。用 `schtasks /Delete /F /TN "Forewit daily"` 删除。
  * macOS：由 launchd agent 打开 Terminal。
  * Linux：cron 没有终端，因此任务只运行只读的 `status`，日志写入 `~/.forewit/schedule.log`，并在可能时显示桌面通知。之后由你自己运行这两条 `agent` 命令。
* 请在代码仓库的克隆中运行 `schedule`（见 [从源码运行 CLI](../developers/recompute.md)），不要在 npx 缓存目录中运行，那个目录可能会消失。

## CLI 强制执行的安全规则

* 每笔交易的 value 都是 0，并且只发往 [`agent/config.mjs`](https://github.com/owaisahmad870/forewit/blob/main/agent/config.mjs) 中固定的 ForecastLedger。没有任何参数可以更改它。
* 除非网络是 BSC 主网且 stdin 是交互式终端，否则 `--execute` 会拒绝执行。它会检查预览的目标是固定的 ledger、value 为 0，且 calldata 与预期完全一致。
* `PENDING_CONFIRMATION` 表示需要你在 Binance App 中确认。切勿重复发送。
* 错误 351803 是风控拦截。CLI 会停止，绝不会设法绕过。

仅为预测评分，不构成投资建议。Forewit 不托管任何资金，也不进行任何支付。预测市场和加密资产存在风险，在你所在地区可能受到限制。

来源：[`agent/README.md`](https://github.com/owaisahmad870/forewit/blob/main/agent/README.md)，[`agent/forewit.mjs`](https://github.com/owaisahmad870/forewit/blob/main/agent/forewit.mjs)。
