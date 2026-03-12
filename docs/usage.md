# Chrome Pilot MCP 使用指南

[English](usage.en.md)

## 概述

Chrome Pilot MCP 通过 CDP 连接已运行的 Chrome，并将浏览器能力暴露为 MCP 工具。它适合需要保留登录态、Cookie、浏览器扩展和现有标签页的自动化场景。

## 前置条件

### 1. Chrome 版本

需要 Chrome `>= 144`。

### 2. 启用远程调试

在 Chrome 地址栏打开：

```text
chrome://inspect/#remote-debugging
```

启用后，Chrome 会写入 `DevToolsActivePort` 文件，其中包含调试端口和 WebSocket 路径。Chrome 重启后通常需要重新启用。

### 3. DevToolsActivePort 路径

| 平台 | 路径 |
| --- | --- |
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\DevToolsActivePort` |

## 安装与配置

### 通过 Claude Code 安装（推荐）

```bash
# 全局安装
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# 项目级安装
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

`--scope user` 写入 `~/.claude/settings.json`，`--scope project` 写入 `.claude/settings.local.json`。

### 通过 npx 直接运行

```bash
npx -y chrome-pilot-mcp
```

### 手动配置

将以下配置加入 Claude Code 的 MCP 配置文件：

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

- 全局：`~/.claude/settings.json`
- 项目：`.claude/settings.local.json`

### 卸载

```bash
# 全局卸载
claude mcp remove --scope user chrome-pilot

# 项目级卸载
claude mcp remove --scope project chrome-pilot
```

### 本地开发

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
npm run dev
```

`npm run dev` 会以 watch 模式编译 TypeScript，`npm start` 用于运行已编译的 MCP 服务。

### 旧版部署脚本

```bash
npm run deploy
npm run uninstall
```

该脚本会安装到 `~/.config/chrome-pilot-mcp/`，并修改用户级 Claude/MCP 配置。仅在你明确需要全局脚本式安装时使用。

## 工具列表

| 类别 | 工具 | 说明 |
| --- | --- | --- |
| 连接 | `chrome_status` | 查看连接状态 |
| 连接 | `chrome_connect` | 连接到已运行的 Chrome |
| 连接 | `chrome_disconnect` | 断开连接但不关闭 Chrome |
| 标签页 | `chrome_list_tabs` | 列出打开的标签页 |
| 标签页 | `chrome_select_tab` | 按索引切换标签页 |
| 标签页 | `chrome_close_tab` | 关闭标签页 |
| 导航 | `chrome_navigate` | 导航到指定 URL |
| 导航 | `chrome_back` | 浏览器后退 |
| 导航 | `chrome_forward` | 浏览器前进 |
| 导航 | `chrome_reload` | 刷新页面 |
| 交互 | `chrome_click` | 点击元素或坐标 |
| 交互 | `chrome_type` | 输入文本 |
| 交互 | `chrome_scroll` | 滚动页面 |
| 交互 | `chrome_press_key` | 发送按键 |
| 检视 | `chrome_screenshot` | 截图 |
| 检视 | `chrome_dump_dom` | 获取页面 DOM |
| 检视 | `chrome_evaluate` | 执行 JavaScript |
| 表单 | `chrome_fill_form` | 批量填写表单 |
| 表单 | `chrome_select_option` | 选择下拉项 |

## 使用示例

### 基础流程

```typescript
// 1. 连接到 Chrome
await chrome_connect({});
// 返回: { success: true, chrome_version: "...", tab_count: 5 }

// 2. 列出标签页
await chrome_list_tabs({});
// 返回: { tabs: [{ index: 0, url: "...", title: "..." }, ...] }

// 3. 切换到目标标签页
await chrome_select_tab({ index: 2 });

// 4. 导航到页面
await chrome_navigate({ url: "https://example.com" });

// 5. 截图
await chrome_screenshot({});

// 6. 断开连接
await chrome_disconnect({});
```

### 页面交互

```typescript
// 点击元素
await chrome_click({ selector: "#login-button" });

// 填写表单
await chrome_fill_form({
  fields: [
    { selector: "#username", value: "user@example.com" },
    { selector: "#password", value: "password123" }
  ]
});

// 下拉选择
await chrome_select_option({ selector: "#country", label: "China" });

// 执行 JavaScript
await chrome_evaluate({ expression: "document.title" });
```

### 高级用法

```typescript
// 全页截图
await chrome_screenshot({ full_page: true });

// 元素截图
await chrome_screenshot({ selector: "#chart" });

// 操作指定标签页
await chrome_navigate({ url: "https://example.com", tab_index: 0 });

// 获取局部 DOM
await chrome_dump_dom({ selector: "#main-content" });

// 带修饰键的按键
await chrome_press_key({ key: "a", modifiers: ["Meta"] }); // Cmd+A

// 绕过缓存刷新
await chrome_reload({ ignore_cache: true });
```

## 错误处理

所有工具在失败时返回统一的错误结构：

```json
{
  "error": true,
  "code": "E101",
  "message": "Not connected to Chrome. Please call chrome_connect first."
}
```

### 错误码

| 码 | 含义 |
| --- | --- |
| `E101` | 未连接 Chrome |
| `E102` | 连接失败 |
| `E103` | 未找到 DevToolsActivePort |
| `E104` | Chrome 未运行或调试端口不可达 |
| `E201` | 标签页未找到 |
| `E301` | 导航失败 |
| `E401` | 元素未找到 |
| `E501` | 截图失败 |
| `E601` | JS 执行失败 |
| `E901` | 参数无效 |
| `E999` | 内部错误 |

## 常见问题

### Q: 连接失败，提示 DevToolsActivePort 未找到？

确认已经在 Chrome 中打开 `chrome://inspect/#remote-debugging` 并启用远程调试。

### Q: Chrome 重启后需要重新启用远程调试吗？

是的，通常每次重启 Chrome 后都需要重新启用。

### Q: 支持多个 Chrome Profile 吗？

当前默认读取主用户数据目录中的 `DevToolsActivePort`。如果你使用多个 Profile，通常需要通过单独的 `--user-data-dir` 启动对应实例。

### Q: 和 chrome-devtools-mcp 有什么区别？

`chrome-pilot-mcp` 连接已运行的 Chrome，重点是保留登录态和当前浏览器环境；`chrome-devtools-mcp` 更常见的用法是启动一个新的自动化浏览器实例。
