# Chrome Pilot MCP Usage Guide / 使用指南

## 概述 / Overview

Chrome Pilot MCP 通过 CDP 连接已运行的 Chrome，并将浏览器能力暴露为 MCP 工具。它适合需要保留登录态、Cookie、浏览器扩展和现有标签页的自动化场景。  
Chrome Pilot MCP connects to an already-running Chrome over CDP and exposes browser actions as MCP tools. It is suited for automation flows that need to preserve sign-in state, cookies, browser extensions, and existing tabs.

## 前置条件 / Prerequisites

### 1. Chrome 版本 / Chrome Version

需要 Chrome `>= 144`。  
Chrome `>= 144` is required.

### 2. 启用远程调试 / Enable Remote Debugging

在 Chrome 地址栏打开：

```text
chrome://inspect/#remote-debugging
```

启用远程调试后，Chrome 会写入 `DevToolsActivePort` 文件，其中包含调试端口和 WebSocket 路径。Chrome 重启后通常需要重新启用。  
After remote debugging is enabled, Chrome writes a `DevToolsActivePort` file containing the debug port and WebSocket path. You usually need to enable it again after Chrome restarts.

### 3. DevToolsActivePort 路径 / DevToolsActivePort Paths

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\DevToolsActivePort` |

## 安装与配置 / Installation and Setup

### 通过 Claude Code 安装（推荐） / Install with Claude Code (Recommended)

```bash
# 全局安装 / User scope
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# 项目级安装 / Project scope
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

`--scope user` 写入 `~/.claude/settings.json`；`--scope project` 写入 `.claude/settings.local.json`。  
`--scope user` writes to `~/.claude/settings.json`; `--scope project` writes to `.claude/settings.local.json`.

### 通过 npx 直接运行 / Run Directly with npx

```bash
npx -y chrome-pilot-mcp
```

### 手动配置 / Manual Configuration

将以下配置加入 Claude Code 的 MCP 配置文件：  
Add the following entry to your Claude Code MCP configuration:

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

配置文件路径：  
Config file paths:

- 全局 / User: `~/.claude/settings.json`
- 项目 / Project: `.claude/settings.local.json`

### 卸载 / Uninstall

```bash
# 全局卸载 / Remove from user scope
claude mcp remove --scope user chrome-pilot

# 项目级卸载 / Remove from project scope
claude mcp remove --scope project chrome-pilot
```

### 本地开发 / Local Development

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
npm run dev
```

`npm run dev` 会以 watch 模式编译 TypeScript；`npm start` 用于运行已编译的 MCP 服务。  
`npm run dev` runs TypeScript in watch mode; `npm start` runs the compiled MCP server.

### 旧版部署脚本 / Legacy Deployment Script

```bash
npm run deploy
npm run uninstall
```

该脚本会安装到 `~/.config/chrome-pilot-mcp/`，并修改用户级 Claude/MCP 配置。仅在你明确需要全局脚本式安装时使用。  
This script installs to `~/.config/chrome-pilot-mcp/` and modifies user-level Claude/MCP configuration. Use it only when you explicitly want the legacy global script-based setup.

## 工具列表 / Available Tools

| Category / 类别 | Tool | Description / 说明 |
| --- | --- | --- |
| Connection / 连接 | `chrome_status` | Show connection state / 查看连接状态 |
| Connection / 连接 | `chrome_connect` | Connect to a running Chrome instance / 连接到已运行的 Chrome |
| Connection / 连接 | `chrome_disconnect` | Disconnect without closing Chrome / 断开连接但不关闭 Chrome |
| Tabs / 标签页 | `chrome_list_tabs` | List open tabs / 列出打开的标签页 |
| Tabs / 标签页 | `chrome_select_tab` | Activate a tab by index / 按索引切换标签页 |
| Tabs / 标签页 | `chrome_close_tab` | Close a tab / 关闭标签页 |
| Navigation / 导航 | `chrome_navigate` | Navigate to a URL / 导航到指定 URL |
| Navigation / 导航 | `chrome_back` | Go back in history / 浏览器后退 |
| Navigation / 导航 | `chrome_forward` | Go forward in history / 浏览器前进 |
| Navigation / 导航 | `chrome_reload` | Reload the page / 刷新页面 |
| Interaction / 交互 | `chrome_click` | Click an element or coordinates / 点击元素或坐标 |
| Interaction / 交互 | `chrome_type` | Type into an input / 输入文本 |
| Interaction / 交互 | `chrome_scroll` | Scroll the page / 滚动页面 |
| Interaction / 交互 | `chrome_press_key` | Send keyboard input / 发送按键 |
| Inspection / 检视 | `chrome_screenshot` | Capture a screenshot / 截图 |
| Inspection / 检视 | `chrome_dump_dom` | Dump page DOM / 获取页面 DOM |
| Inspection / 检视 | `chrome_evaluate` | Execute JavaScript / 执行 JavaScript |
| Forms / 表单 | `chrome_fill_form` | Fill multiple fields at once / 批量填写表单 |
| Forms / 表单 | `chrome_select_option` | Select a dropdown option / 选择下拉项 |

## 使用示例 / Example Workflows

### 基础流程 / Basic Flow

```typescript
// 1. 连接到 Chrome / Connect to Chrome
await chrome_connect({});
// 返回 / Returns: { success: true, chrome_version: "...", tab_count: 5 }

// 2. 列出标签页 / List tabs
await chrome_list_tabs({});
// 返回 / Returns: { tabs: [{ index: 0, url: "...", title: "..." }, ...] }

// 3. 切换到目标标签页 / Select the target tab
await chrome_select_tab({ index: 2 });

// 4. 导航到页面 / Navigate
await chrome_navigate({ url: "https://example.com" });

// 5. 截图 / Capture a screenshot
await chrome_screenshot({});

// 6. 断开连接 / Disconnect
await chrome_disconnect({});
```

### 页面交互 / Page Interaction

```typescript
// 点击元素 / Click an element
await chrome_click({ selector: "#login-button" });

// 填写表单 / Fill a form
await chrome_fill_form({
  fields: [
    { selector: "#username", value: "user@example.com" },
    { selector: "#password", value: "password123" }
  ]
});

// 下拉选择 / Select from a dropdown
await chrome_select_option({ selector: "#country", label: "China" });

// 执行 JavaScript / Execute JavaScript
await chrome_evaluate({ expression: "document.title" });
```

### 高级用法 / Advanced Usage

```typescript
// 全页截图 / Full-page screenshot
await chrome_screenshot({ full_page: true });

// 元素截图 / Element screenshot
await chrome_screenshot({ selector: "#chart" });

// 操作指定标签页 / Work on a specific tab
await chrome_navigate({ url: "https://example.com", tab_index: 0 });

// 获取局部 DOM / Dump a DOM subtree
await chrome_dump_dom({ selector: "#main-content" });

// 带修饰键的按键 / Key press with modifiers
await chrome_press_key({ key: "a", modifiers: ["Meta"] }); // Cmd+A

// 绕过缓存刷新 / Reload while bypassing cache
await chrome_reload({ ignore_cache: true });
```

## 错误处理 / Error Handling

所有工具在失败时返回统一的错误结构：  
All tools return a shared error structure on failure:

```json
{
  "error": true,
  "code": "E101",
  "message": "Not connected to Chrome. Please call chrome_connect first."
}
```

### 错误码 / Error Codes

| Code | Meaning / 含义 |
| --- | --- |
| `E101` | Not connected to Chrome / 未连接 Chrome |
| `E102` | Connection failed / 连接失败 |
| `E103` | DevToolsActivePort not found / 未找到 DevToolsActivePort |
| `E104` | Chrome is not running or debug port is unreachable / Chrome 未运行或调试端口不可达 |
| `E201` | Tab not found / 标签页未找到 |
| `E301` | Navigation failed / 导航失败 |
| `E401` | Element not found / 元素未找到 |
| `E501` | Screenshot failed / 截图失败 |
| `E601` | JavaScript execution failed / JS 执行失败 |
| `E901` | Invalid arguments / 参数无效 |
| `E999` | Internal error / 内部错误 |

## 常见问题 / FAQ

### Q: 连接失败，提示 DevToolsActivePort 未找到？ / Connection fails because DevToolsActivePort was not found?

确认已经在 Chrome 中打开 `chrome://inspect/#remote-debugging` 并启用远程调试。  
Make sure `chrome://inspect/#remote-debugging` has been opened in Chrome and remote debugging is enabled.

### Q: Chrome 重启后需要重新启用远程调试吗？ / Do I need to re-enable remote debugging after Chrome restarts?

是的，通常每次重启 Chrome 后都需要重新启用。  
Yes. In most cases, you need to enable it again after each Chrome restart.

### Q: 支持多个 Chrome Profile 吗？ / Does it support multiple Chrome profiles?

当前默认读取主用户数据目录中的 `DevToolsActivePort`。如果你使用多个 Profile，通常需要通过单独的 `--user-data-dir` 启动对应实例。  
It currently reads `DevToolsActivePort` from the main user data directory by default. If you use multiple profiles, you typically need to launch the target instance with a separate `--user-data-dir`.

### Q: 和 chrome-devtools-mcp 有什么区别？ / How is this different from chrome-devtools-mcp?

`chrome-pilot-mcp` 连接已运行的 Chrome，重点是保留登录态和当前浏览器环境；`chrome-devtools-mcp` 更常见的用法是启动一个新的自动化浏览器实例。  
`chrome-pilot-mcp` connects to an already-running Chrome and focuses on preserving session state and the current browser environment; `chrome-devtools-mcp` is more commonly used to launch a fresh automation browser instance.
