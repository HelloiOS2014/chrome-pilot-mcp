# chrome-pilot-mcp

[English](README.en.md)

通过 CDP（Chrome DevTools Protocol）连接已运行的 Chrome，并以 MCP 服务的形式暴露浏览器控制能力。

项目基于 [patchright-core](https://github.com/AjjayK/patchright)，适合需要保留登录态、Cookie、浏览器扩展和现有标签页的自动化场景。

## 核心特点

- 连接已有 Chrome 实例，无需重新启动浏览器。
- 保留登录态、用户数据和当前标签页上下文。
- 基于 patchright-core，尽量降低常见 CDP 自动化指纹。
- 提供连接、标签页、导航、交互、检视、表单等 18 个 MCP 工具。

## 安装

### Claude Code（推荐）

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

### 从源码运行

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
npm start
```

## 前置条件

### Node.js / npx

`npx` 用于 Claude Code 启动 MCP 子进程。请先确认 Node.js 与 npx 可用（Node `>= 18`）：

```bash
node -v
npx -v
```

如果缺失可按平台安装 Node.js（安装后会包含 npx）：

```bash
# macOS
brew install node

# Ubuntu / Debian
sudo apt-get update && sudo apt-get install -y nodejs npm

# Windows (PowerShell)
winget install OpenJS.NodeJS.LTS
```

### Chrome 版本

需要 Chrome `>= 144`，以支持通过 `chrome://inspect/#remote-debugging` 启用远程调试。

### 启用远程调试

在 Chrome 地址栏打开 `chrome://inspect/#remote-debugging` 并启用远程调试。Chrome 重启后通常需要重新启用。

### DevToolsActivePort 路径

| 平台 | 路径 |
| --- | --- |
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\DevToolsActivePort` |

## 工具概览

| 类别 | 工具 | 用途 |
| --- | --- | --- |
| 连接 | `chrome_status`, `chrome_connect`, `chrome_disconnect` | 管理 Chrome 连接状态 |
| 标签页 | `chrome_list_tabs`, `chrome_select_tab`, `chrome_close_tab` | 查看并切换标签页 |
| 导航 | `chrome_navigate`, `chrome_back`, `chrome_forward`, `chrome_reload` | 执行页面导航 |
| 交互 | `chrome_click`, `chrome_type`, `chrome_scroll`, `chrome_press_key` | 与页面元素交互 |
| 检视 | `chrome_screenshot`, `chrome_dump_dom`, `chrome_evaluate` | 截图并检查页面状态 |
| 表单 | `chrome_fill_form`, `chrome_select_option` | 批量填写表单 |

## 详细文档

- 中文使用手册：[docs/usage.md](docs/usage.md)
- English usage guide: [docs/usage.en.md](docs/usage.en.md)

## License

MIT
