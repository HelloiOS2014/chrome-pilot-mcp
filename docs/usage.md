# Chrome Pilot MCP - 使用指南

## 概述

Chrome Pilot MCP 是一个 MCP 服务器，用于通过 CDP (Chrome DevTools Protocol) 连接并操控已运行的 Chrome 浏览器。

**核心优势：** 使用已有的 Chrome 实例，保留登录态，无需重新启动浏览器。

## 前置条件

### 1. Chrome 版本

Chrome >= 144（支持通过 `chrome://inspect` 启用远程调试）

### 2. 启用远程调试

在 Chrome 地址栏输入：

```
chrome://inspect/#remote-debugging
```

点击启用远程调试（一次性操作，Chrome 重启后需重新启用）。

启用后，Chrome 会在用户数据目录下写入 `DevToolsActivePort` 文件，包含调试端口和 WebSocket 路径。

### DevToolsActivePort 路径

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\Google\Chrome\User Data\DevToolsActivePort` |

## 安装

### 通过 Claude Code 安装（推荐）

```bash
# 全局安装 — 所有项目可用
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# 项目级安装 — 仅当前项目可用
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

> `--scope user` 写入 `~/.claude/settings.json`，`--scope project` 写入项目下的 `.claude/settings.local.json`。

### 通过 npx 直接运行

```bash
npx -y chrome-pilot-mcp
```

### 手动配置

在 Claude Code 的 MCP 配置文件中添加：

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

### 卸载

```bash
# 全局卸载
claude mcp remove --scope user chrome-pilot

# 项目级卸载
claude mcp remove --scope project chrome-pilot
```

### 本地开发

```bash
cd chrome-pilot-mcp
npm install
npm run build
```

### 全局部署（旧方式）

```bash
cd chrome-pilot-mcp
npm run deploy         # 一键部署到 ~/.config/chrome-pilot-mcp/
npm run uninstall      # 卸载
```

部署脚本会：
1. 构建项目
2. 复制到 `~/.config/chrome-pilot-mcp/`
3. 安全合并 Claude Code 全局配置（只添加/更新 `chrome-pilot` 条目）

## 工具列表（18 个）

### 连接管理

| 工具 | 说明 |
|------|------|
| `chrome_status` | 查看连接状态 |
| `chrome_connect` | 连接到已运行的 Chrome |
| `chrome_disconnect` | 断开连接（不关闭浏览器） |

### 标签页管理

| 工具 | 说明 |
|------|------|
| `chrome_list_tabs` | 列出所有标签页（title + URL） |
| `chrome_select_tab` | 切换到指定标签页 |
| `chrome_close_tab` | 关闭标签页 |

### 导航

| 工具 | 说明 |
|------|------|
| `chrome_navigate` | 导航到 URL |
| `chrome_back` | 浏览器后退 |
| `chrome_forward` | 浏览器前进 |
| `chrome_reload` | 刷新页面 |

### 交互

| 工具 | 说明 |
|------|------|
| `chrome_click` | 点击（CSS selector 或坐标） |
| `chrome_type` | 输入文本 |
| `chrome_scroll` | 滚动页面 |
| `chrome_press_key` | 按键 |

### 检视

| 工具 | 说明 |
|------|------|
| `chrome_screenshot` | 截图（返回 base64） |
| `chrome_dump_dom` | 获取页面 DOM |
| `chrome_evaluate` | 执行 JavaScript |

### 表单

| 工具 | 说明 |
|------|------|
| `chrome_fill_form` | 批量填写表单 |
| `chrome_select_option` | 下拉选择 |

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

// 4. 导航
await chrome_navigate({ url: "https://example.com" });

// 5. 截图
await chrome_screenshot({});

// 6. 断开
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
await chrome_select_option({ selector: "#country", label: "中国" });

// 执行 JavaScript
await chrome_evaluate({ expression: "document.title" });
```

### 高级用法

```typescript
// 全页截图
await chrome_screenshot({ full_page: true });

// 元素截图
await chrome_screenshot({ selector: "#chart" });

// 操作特定标签页
await chrome_navigate({ url: "https://example.com", tab_index: 0 });

// 获取部分 DOM
await chrome_dump_dom({ selector: "#main-content" });

// 带修饰键的按键
await chrome_press_key({ key: "a", modifiers: ["Meta"] }); // Cmd+A

// 缓存绕过刷新
await chrome_reload({ ignore_cache: true });
```

## 错误处理

所有工具在出错时返回统一的错误格式：

```json
{
  "error": true,
  "code": "E101",
  "message": "Not connected to Chrome. Please call chrome_connect first."
}
```

### 错误码

| 码 | 含义 |
|----|------|
| E101 | 未连接 Chrome |
| E102 | 连接失败 |
| E103 | DevToolsActivePort 未找到 |
| E104 | Chrome 未运行或调试端口不可达 |
| E201 | 标签页未找到 |
| E301 | 导航失败 |
| E401 | 元素未找到 |
| E501 | 截图失败 |
| E601 | JS 执行失败 |
| E901 | 参数无效 |
| E999 | 内部错误 |

## 常见问题

### Q: 连接失败，提示 DevToolsActivePort 未找到？

确认已在 Chrome 中打开 `chrome://inspect/#remote-debugging` 并启用远程调试。

### Q: Chrome 重启后需要重新启用吗？

是的，每次 Chrome 重启后需要重新在 `chrome://inspect/#remote-debugging` 启用。

### Q: 支持多个 Chrome Profile 吗？

目前默认读取主 Profile 的 DevToolsActivePort。如需支持多 Profile，可通过设置 Chrome 的 `--user-data-dir` 启动参数。

### Q: 与 chrome-devtools-mcp 插件有什么区别？

chrome-pilot-mcp 连接到已运行的 Chrome（保留登录态），而 chrome-devtools-mcp 通常启动新的 Chrome 实例。
