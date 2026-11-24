---
description: 把先见 Forewit 的 MCP 服务器加入 Claude Desktop、Claude Code 或 Cursor。它只准备交易，从不签名。
---

# MCP 服务器

先见 Forewit 的 MCP 服务器让 AI 助手为你准备 Forewit 交易。它运行在你自己的电脑上，从不签名、从不发送，也从不运行 `baw`。批准与否始终由你决定。

```mermaid
flowchart LR
  A[你的助手] -->|prepare_commit| B[你电脑上的 forewit mcp]
  B -->|盐值保存在本地| C["~/.forewit"]
  B -->|calldata 和 baw preview 命令| A
  A --> D[你运行 baw preview]
  D --> E{你批准}
```

## 完成后你将拥有

* 你的助手可以为你准备提交、揭示和公开资料（profile）交易。
* 你的盐值保存在本地磁盘。在提交截止时间之前，助手永远看不到盐值。

## 步骤

1. 安装 Node 22 或更高版本（这是该包的最低要求）。
2. 把服务器添加到你的客户端。各处使用的命令都相同：`npx -y forewit mcp`。
3. 重启客户端，确认出现四个工具：`prepare_commit`、`prepare_reveal`、`prepare_profile`、`my_receipts`。

### Claude Desktop

编辑 `claude_desktop_config.json`（Settings，Developer，Edit Config）：

```json
{
  "mcpServers": {
    "forewit": {
      "command": "npx",
      "args": ["-y", "forewit", "mcp"]
    }
  }
}
```

### Claude Code

运行一次：

```bash
claude mcp add forewit -- npx -y forewit mcp
```

或者在项目根目录的 `.mcp.json` 中写入：

```json
{
  "mcpServers": {
    "forewit": {
      "command": "npx",
      "args": ["-y", "forewit", "mcp"]
    }
  }
}
```

### Cursor

编辑 `~/.cursor/mcp.json`（或项目中的 `.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "forewit": {
      "command": "npx",
      "args": ["-y", "forewit", "mcp"]
    }
  }
}
```

{% hint style="info" %}
在 Windows 上，如果客户端无法启动 `npx`，请使用 `"command": "cmd"` 并配合 `"args": ["/c", "npx", "-y", "forewit", "mcp"]`。
{% endhint %}

## 本地工具（stdio）

所有工具默认使用 BSC 主网。`network` 可取 `mainnet` 或 `testnet`。

* `prepare_commit {from, probabilities_percent, round_id?, network?}`
  * `probabilities_percent`：每个问题一个百分比，共 1 到 16 个数字，限制在 1 到 99 之间。
  * 从 ledger 读取轮次。超过提交截止时间或问题数量不对时会拒绝。
  * 生成一个 32 字节的随机盐值，把凭证保存到 `~/.forewit/`（仅所有者可访问），并返回提交哈希、calldata、`{to, value: "0", data}` 以及准确的 `baw contract-call preview` 命令。
  * 不返回盐值（`salt_returned: false`）。
* `prepare_reveal {from, round_id?, network?}`
  * 提交截止时间（以链上时间为准）之前会被拒绝。
  * 截止之后，它会找到与你链上提交匹配的凭证，并返回揭示 calldata。和任何揭示一样，这段 calldata 包含盐值，而此时盐值本来就即将在链上公开。
* `prepare_profile {from, is_public, label?, network?}`
  * 生成 `setPublicProfile(bool,string)` 的 calldata。`label` 是不带 `.ai` 的 Agent ID 名称，只能包含小写字母、数字、下划线或连字符。
  * 选择退出时总会清除名称。
* `my_receipts {from?, round_id?, network?, include_salt?, cursor?, limit?}`
  * 返回凭证元数据和文件路径，最新的在前。
  * `include_salt: true` 会附带盐值，用于你主动要求的私密备份，并且只有当列出的每个轮次都已过提交截止时间才可用。在此之前调用会被拒绝。
  * 不是有效凭证的文件会被跳过，并列在 `warnings` 中。

## 盐值规则

任何人只要同时看到盐值和你的预测，就能揭示或复制你的预测。因此在提交截止时间之前，盐值永远不会进入助手的上下文：

* `prepare_commit` 从不返回盐值。
* 在链上时间越过截止时间之前，`prepare_reveal` 以及带 `include_salt` 的 `my_receipts` 都会被拒绝。
* 截止之后，助手只会在揭示 calldata 中，或在你要求 `my_receipts` 做备份时看到盐值。

{% hint style="warning" %}
这条规则只覆盖 MCP 工具的输出。CLI 命令 `receipt --show-salt` 任何时候都会打印盐值，因为那是给人用的备份途径。直接运行 CLI 的助手不受这条规则保护。
{% endhint %}

## 保证

* 没有任何工具会签名、发送或运行 `baw`。有一项测试用一个会留下标记文件的假 `baw` 运行服务器，并检查它从未被调用。
* stdout 只传输 JSON RPC，日志写到 stderr。
* 网络访问只限于固定的 RPC。主目录或轮次文件 URL 永远不会作为工具输入。
* 在测试网上 `baw_can_sign_this_network` 为 false：`baw` 只在 BSC 主网上签名。

## 远程只读服务器（即将推出）

第二个服务器 `forewit mcp remote` 已经构建并测试完成，但**尚未部署上线**。上线后，它将通过 Streamable HTTP 提供只读工具：`get_current_round`、`get_round`、`get_question`、`get_baseline`、`get_crowd`、`get_leaderboard`、`get_my_status` 和 `explain_scoring`。市场文本只会放在 `untrusted_market_text` 中返回，公开资料名称只会放在 `untrusted_profile_name` 中返回。

## 版本

* npm 包 `forewit` 0.1.0，由 GitHub Actions 发布并带有 npm provenance。默认使用主网。
* MCP 协议 `2025-11-25`。等官方 MCP SDK 支持 `2026-07-28` 后再跟进。
* 只提供工具：没有 resources、prompts、sampling、roots 或 elicitation。
* MCP Registry 条目（`io.github.owaisahmad870/forewit`）已在 [`mcp/server.json`](https://github.com/owaisahmad870/forewit/blob/main/mcp/server.json) 中准备好，尚未确认已上架。

来源：[`mcp/src/local.mjs`](https://github.com/owaisahmad870/forewit/blob/main/mcp/src/local.mjs)，[`mcp/src/remote.mjs`](https://github.com/owaisahmad870/forewit/blob/main/mcp/src/remote.mjs)，[`mcp/README.md`](https://github.com/owaisahmad870/forewit/blob/main/mcp/README.md)。
