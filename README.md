# chrome-pilot-mcp

通过 CDP（Chrome DevTools Protocol）连接已运行的 Chrome，并以 MCP 服务的形式暴露浏览器控制能力。  
Control an already-running Chrome instance over CDP (Chrome DevTools Protocol) and expose it as an MCP server.

基于 [patchright-core](https://github.com/AjjayK/patchright)，适合需要保留登录态、Cookie、扩展和现有标签页的自动化场景。  
Built on [patchright-core](https://github.com/AjjayK/patchright), it is designed for automation flows that must preserve session state, cookies, extensions, and existing tabs.

## 核心特点 / Highlights

- 连接已有 Chrome 实例，避免重新启动浏览器。 Connect to an existing Chrome session instead of launching a fresh browser.
- 保留登录态、用户数据和当前标签页上下文。 Keep session state, user data, and current tab context intact.
- 通过 patchright-core 降低常见 CDP 自动化指纹。 Use patchright-core to reduce common CDP automation fingerprints.
- 提供连接、标签页、导航、交互、检视、表单等 18 个 MCP 工具。 Expose 18 MCP tools for connection, tabs, navigation, interaction, inspection, and forms.

## 安装 / Installation

### Claude Code（推荐 / Recommended）

```bash
# 全局安装 / User scope
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# 项目级安装 / Project scope
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

`--scope user` 写入 `~/.claude/settings.json`；`--scope project` 写入 `.claude/settings.local.json`。  
`--scope user` writes to `~/.claude/settings.json`; `--scope project` writes to `.claude/settings.local.json`.

### 通过 npx 直接运行 / Run with npx

```bash
npx -y chrome-pilot-mcp
```

### 手动配置 / Manual Configuration

```json
{
  "mcpServers": {
    "chrome-pilot": {
      "command": "npx",
      "args": ["-y", "chrome-pilot-mcp"]
    }
  }
}
```

### 从源码运行 / Run from Source

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
npm start
```

## 前置条件 / Prerequisites

### Chrome 版本 / Chrome Version

需要 Chrome `>= 144`，以支持通过 `chrome://inspect/#remote-debugging` 启用远程调试。  
Chrome `>= 144` is required so remote debugging can be enabled from `chrome://inspect/#remote-debugging`.

### 启用远程调试 / Enable Remote Debugging

在 Chrome 地址栏打开 `chrome://inspect/#remote-debugging` 并启用远程调试。Chrome 重启后通常需要重新启用。  
Open `chrome://inspect/#remote-debugging` in Chrome and enable remote debugging. You usually need to enable it again after Chrome restarts.

### DevToolsActivePort 路径 / DevToolsActivePort Paths

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\DevToolsActivePort` |

## 工具概览 / Tool Overview

| Category / 类别 | Tools | Purpose / 用途 |
| --- | --- | --- |
| Connection / 连接 | `chrome_status`, `chrome_connect`, `chrome_disconnect` | Manage Chrome connection state / 管理连接状态 |
| Tabs / 标签页 | `chrome_list_tabs`, `chrome_select_tab`, `chrome_close_tab` | Inspect and switch tabs / 查看并切换标签页 |
| Navigation / 导航 | `chrome_navigate`, `chrome_back`, `chrome_forward`, `chrome_reload` | Drive page navigation / 执行页面导航 |
| Interaction / 交互 | `chrome_click`, `chrome_type`, `chrome_scroll`, `chrome_press_key` | Interact with page elements / 与页面元素交互 |
| Inspection / 检视 | `chrome_screenshot`, `chrome_dump_dom`, `chrome_evaluate` | Capture state and inspect DOM / 截图并检查页面状态 |
| Forms / 表单 | `chrome_fill_form`, `chrome_select_option` | Fill forms in batches / 批量填写表单 |

## 详细文档 / Detailed Documentation

完整安装说明、示例流程、错误码和 FAQ 见 [docs/usage.md](docs/usage.md)。  
For full setup instructions, workflow examples, error codes, and FAQ, see [docs/usage.md](docs/usage.md).

## License

MIT
