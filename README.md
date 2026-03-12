# chrome-pilot-mcp

MCP server for controlling an already-running Chrome browser via CDP (Chrome DevTools Protocol).

**核心优势：** 连接已有的 Chrome 实例，保留登录态，无需重新启动浏览器。

## 安装

### 通过 Claude Code 安装（推荐）

```bash
# 全局安装（所有项目可用）
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# 项目级安装（仅当前项目）
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

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

配置文件位置：
- 全局：`~/.claude/settings.json`
- 项目：`.claude/settings.local.json`

### 从源码安装

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
```

## 前置条件

### Chrome 版本

Chrome >= 144（支持通过 `chrome://inspect` 启用远程调试）

### 启用远程调试

在 Chrome 地址栏输入：

```
chrome://inspect/#remote-debugging
```

点击启用远程调试（一次性操作，Chrome 重启后需重新启用）。

### DevToolsActivePort 路径

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\Google\Chrome\User Data\DevToolsActivePort` |

## 工具列表

| 类别 | 工具 | 说明 |
|------|------|------|
| 连接 | `chrome_status` | 查看连接状态 |
| 连接 | `chrome_connect` | 连接到已运行的 Chrome |
| 连接 | `chrome_disconnect` | 断开连接 |
| 标签页 | `chrome_list_tabs` | 列出所有标签页 |
| 标签页 | `chrome_select_tab` | 切换标签页 |
| 标签页 | `chrome_close_tab` | 关闭标签页 |
| 导航 | `chrome_navigate` | 导航到 URL |
| 导航 | `chrome_back` / `chrome_forward` | 前进 / 后退 |
| 导航 | `chrome_reload` | 刷新页面 |
| 交互 | `chrome_click` | 点击元素 |
| 交互 | `chrome_type` | 输入文本 |
| 交互 | `chrome_scroll` | 滚动页面 |
| 交互 | `chrome_press_key` | 按键 |
| 检视 | `chrome_screenshot` | 截图 |
| 检视 | `chrome_dump_dom` | 获取 DOM |
| 检视 | `chrome_evaluate` | 执行 JavaScript |
| 表单 | `chrome_fill_form` | 批量填写表单 |
| 表单 | `chrome_select_option` | 下拉选择 |

## License

MIT
