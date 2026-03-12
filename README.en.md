# chrome-pilot-mcp

[中文](README.md)

Expose browser control as an MCP server by connecting to an already-running Chrome instance over CDP (Chrome DevTools Protocol).

The project is built on [patchright-core](https://github.com/AjjayK/patchright) and is designed for automation flows that must preserve sign-in state, cookies, browser extensions, and existing tabs.

## Highlights

- Connect to an existing Chrome session instead of launching a fresh browser.
- Preserve session state, user data, and current tab context.
- Use patchright-core to reduce common CDP automation fingerprints.
- Provide 18 MCP tools for connection, tabs, navigation, interaction, inspection, and forms.

## Installation

### Claude Code (Recommended)

```bash
# User scope
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# Project scope
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

`--scope user` writes to `~/.claude/settings.json`; `--scope project` writes to `.claude/settings.local.json`.

### Run with npx

```bash
npx -y chrome-pilot-mcp
```

### Manual Configuration

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

### Run from Source

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
npm start
```

## Prerequisites

### Chrome Version

Chrome `>= 144` is required so remote debugging can be enabled from `chrome://inspect/#remote-debugging`.

### Enable Remote Debugging

Open `chrome://inspect/#remote-debugging` in Chrome and enable remote debugging. You usually need to enable it again after Chrome restarts.

### DevToolsActivePort Paths

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\DevToolsActivePort` |

## Tool Overview

| Category | Tools | Purpose |
| --- | --- | --- |
| Connection | `chrome_status`, `chrome_connect`, `chrome_disconnect` | Manage Chrome connection state |
| Tabs | `chrome_list_tabs`, `chrome_select_tab`, `chrome_close_tab` | Inspect and switch tabs |
| Navigation | `chrome_navigate`, `chrome_back`, `chrome_forward`, `chrome_reload` | Drive page navigation |
| Interaction | `chrome_click`, `chrome_type`, `chrome_scroll`, `chrome_press_key` | Interact with page elements |
| Inspection | `chrome_screenshot`, `chrome_dump_dom`, `chrome_evaluate` | Capture state and inspect the page |
| Forms | `chrome_fill_form`, `chrome_select_option` | Fill forms in batches |

## Detailed Documentation

- 中文使用手册: [docs/usage.md](docs/usage.md)
- English usage guide: [docs/usage.en.md](docs/usage.en.md)

## License

MIT
