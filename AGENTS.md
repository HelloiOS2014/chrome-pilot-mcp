# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the TypeScript source for the MCP server. Use `src/index.ts` for server bootstrap and request routing, `src/browser.ts` for Chrome connection state, `src/types.ts` for shared types/errors, and `src/tools/*.ts` for tool groups such as navigation, tabs, inspection, and form handling. Build output goes to `dist/`. Keep user-facing documentation in `README.md` and `docs/usage.md`. Deployment and uninstall helpers live in `scripts/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run build`: compile `src/` to `dist/` with `tsc`; run this before opening a PR.
- `npm run dev`: watch-mode TypeScript build for local development.
- `npm start`: run the compiled MCP server from `dist/index.js`.
- `npm run deploy`: build and run the install script that copies files into `~/.config/chrome-pilot-mcp/`.
- `npm run uninstall`: remove installed files and Claude/MCP config entries.

## Coding Style & Naming Conventions
This repo uses strict TypeScript with ESM (`module: NodeNext`). Follow the existing style: 2-space indentation, semicolons, single quotes, and small focused modules. Use `camelCase` for variables/functions, `PascalCase` for types/classes, and keep MCP tool names in `snake_case` with the `chrome_` prefix (for example, `chrome_navigate`). No formatter or linter is checked in, so match the surrounding file style and keep imports explicit.

## Testing Guidelines
There is no automated test framework configured yet. Treat `npm run build` as the minimum gate, then manually smoke-test against a running Chrome instance with remote debugging enabled. Validate the changed tool end-to-end, including error handling and JSON response shape. If you add tests, prefer `*.test.ts` files near the affected module or under a new `tests/` directory.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries without prefixes, for example `Add npm publish support and claude mcp add installation`. Keep commits focused and descriptive. PRs should include a brief summary, manual verification steps, and note any changes to install/config behavior. When a tool response or workflow changes, include example commands or sample JSON output.

## Security & Configuration Tips
Do not commit machine-specific paths, Chrome profile data, or `DevToolsActivePort` contents. Be careful when editing `scripts/deploy.sh` or `scripts/uninstall.sh`: they modify user-level Claude/MCP configuration files and installation directories outside the repo.
