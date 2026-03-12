# Chrome Pilot MCP Usage Guide

[中文](usage.md)

## Overview

Chrome Pilot MCP connects to an already-running Chrome instance over CDP and exposes browser actions as MCP tools. It is designed for automation flows that need to preserve sign-in state, cookies, browser extensions, and existing tabs.

## Prerequisites

### 1. Chrome Version

Chrome `>= 144` is required.

### 2. Enable Remote Debugging

Open the following page in Chrome:

```text
chrome://inspect/#remote-debugging
```

After remote debugging is enabled, Chrome writes a `DevToolsActivePort` file containing the debug port and WebSocket path. You usually need to enable it again after Chrome restarts.

### 3. DevToolsActivePort Paths

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Google/Chrome/DevToolsActivePort` |
| Linux | `~/.config/google-chrome/DevToolsActivePort` |
| Windows | `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\DevToolsActivePort` |

## Installation and Setup

### Install with Claude Code (Recommended)

```bash
# User scope
claude mcp add --scope user chrome-pilot -- npx -y chrome-pilot-mcp

# Project scope
claude mcp add --scope project chrome-pilot -- npx -y chrome-pilot-mcp
```

`--scope user` writes to `~/.claude/settings.json`; `--scope project` writes to `.claude/settings.local.json`.

### Run Directly with npx

```bash
npx -y chrome-pilot-mcp
```

### Manual Configuration

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

Config file paths:

- User: `~/.claude/settings.json`
- Project: `.claude/settings.local.json`

### Uninstall

```bash
# Remove from user scope
claude mcp remove --scope user chrome-pilot

# Remove from project scope
claude mcp remove --scope project chrome-pilot
```

### Local Development

```bash
git clone <repo-url>
cd chrome-pilot-mcp
npm install
npm run build
npm run dev
```

`npm run dev` compiles TypeScript in watch mode, and `npm start` runs the compiled MCP server.

### Legacy Deployment Script

```bash
npm run deploy
npm run uninstall
```

This script installs to `~/.config/chrome-pilot-mcp/` and modifies user-level Claude/MCP configuration. Use it only when you explicitly want the legacy global script-based setup.

## Available Tools

| Category | Tool | Description |
| --- | --- | --- |
| Connection | `chrome_status` | Show connection state |
| Connection | `chrome_connect` | Connect to a running Chrome instance |
| Connection | `chrome_disconnect` | Disconnect without closing Chrome |
| Tabs | `chrome_list_tabs` | List open tabs |
| Tabs | `chrome_select_tab` | Activate a tab by index |
| Tabs | `chrome_close_tab` | Close a tab |
| Navigation | `chrome_navigate` | Navigate to a URL |
| Navigation | `chrome_back` | Go back in history |
| Navigation | `chrome_forward` | Go forward in history |
| Navigation | `chrome_reload` | Reload the page |
| Interaction | `chrome_click` | Click an element or coordinates |
| Interaction | `chrome_type` | Type into an input |
| Interaction | `chrome_scroll` | Scroll the page |
| Interaction | `chrome_press_key` | Send keyboard input |
| Inspection | `chrome_screenshot` | Capture a screenshot |
| Inspection | `chrome_dump_dom` | Dump page DOM |
| Inspection | `chrome_evaluate` | Execute JavaScript |
| Forms | `chrome_fill_form` | Fill multiple fields at once |
| Forms | `chrome_select_option` | Select a dropdown option |

## Example Workflows

### Basic Flow

```typescript
// 1. Connect to Chrome
await chrome_connect({});
// Returns: { success: true, chrome_version: "...", tab_count: 5 }

// 2. List tabs
await chrome_list_tabs({});
// Returns: { tabs: [{ index: 0, url: "...", title: "..." }, ...] }

// 3. Select the target tab
await chrome_select_tab({ index: 2 });

// 4. Navigate
await chrome_navigate({ url: "https://example.com" });

// 5. Capture a screenshot
await chrome_screenshot({});

// 6. Disconnect
await chrome_disconnect({});
```

### Page Interaction

```typescript
// Click an element
await chrome_click({ selector: "#login-button" });

// Fill a form
await chrome_fill_form({
  fields: [
    { selector: "#username", value: "user@example.com" },
    { selector: "#password", value: "password123" }
  ]
});

// Select from a dropdown
await chrome_select_option({ selector: "#country", label: "China" });

// Execute JavaScript
await chrome_evaluate({ expression: "document.title" });
```

### Advanced Usage

```typescript
// Full-page screenshot
await chrome_screenshot({ full_page: true });

// Element screenshot
await chrome_screenshot({ selector: "#chart" });

// Work on a specific tab
await chrome_navigate({ url: "https://example.com", tab_index: 0 });

// Dump a DOM subtree
await chrome_dump_dom({ selector: "#main-content" });

// Key press with modifiers
await chrome_press_key({ key: "a", modifiers: ["Meta"] }); // Cmd+A

// Reload while bypassing cache
await chrome_reload({ ignore_cache: true });
```

## Error Handling

All tools return a shared error structure on failure:

```json
{
  "error": true,
  "code": "E101",
  "message": "Not connected to Chrome. Please call chrome_connect first."
}
```

### Error Codes

| Code | Meaning |
| --- | --- |
| `E101` | Not connected to Chrome |
| `E102` | Connection failed |
| `E103` | DevToolsActivePort not found |
| `E104` | Chrome is not running or the debug port is unreachable |
| `E201` | Tab not found |
| `E301` | Navigation failed |
| `E401` | Element not found |
| `E501` | Screenshot failed |
| `E601` | JavaScript execution failed |
| `E901` | Invalid arguments |
| `E999` | Internal error |

## FAQ

### Q: Connection fails because DevToolsActivePort was not found?

Make sure `chrome://inspect/#remote-debugging` has been opened in Chrome and remote debugging is enabled.

### Q: Do I need to re-enable remote debugging after Chrome restarts?

Yes. In most cases, you need to enable it again after each Chrome restart.

### Q: Does it support multiple Chrome profiles?

It currently reads `DevToolsActivePort` from the main user data directory by default. If you use multiple profiles, you typically need to launch the target instance with a separate `--user-data-dir`.

### Q: How is this different from chrome-devtools-mcp?

`chrome-pilot-mcp` connects to an already-running Chrome and focuses on preserving session state and the current browser environment. `chrome-devtools-mcp` is more commonly used to launch a fresh automation browser instance.
