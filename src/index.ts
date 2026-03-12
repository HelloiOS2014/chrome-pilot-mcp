#!/usr/bin/env node
/**
 * Chrome Pilot MCP Server
 *
 * MCP server for controlling an already-running Chrome browser via CDP.
 * Connects through DevToolsActivePort (requires Chrome remote debugging enabled).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { getBrowserManager } from './browser.js';
import { ChromeError, ErrorCode, type ToolModule } from './types.js';

// Import tool modules
import * as connectionTools from './tools/connection.js';
import * as tabsTools from './tools/tabs.js';
import * as navigationTools from './tools/navigation.js';
import * as interactionTools from './tools/interaction.js';
import * as inspectionTools from './tools/inspection.js';
import * as formTools from './tools/form.js';

// ============================================================
// Collect all tools
// ============================================================

const toolModules: ToolModule[] = [
  connectionTools,
  tabsTools,
  navigationTools,
  interactionTools,
  inspectionTools,
  formTools,
];

const allTools: Tool[] = toolModules.flatMap((m) => m.tools);

// Tools that don't require an active connection
const connectionFreeTools = new Set([
  'chrome_status',
  'chrome_connect',
  'chrome_disconnect',
]);

// ============================================================
// Tool call handler
// ============================================================

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const bm = getBrowserManager();

  // Check connection for tools that require it
  if (!connectionFreeTools.has(name) && !bm.isConnected()) {
    throw new ChromeError(
      ErrorCode.NOT_CONNECTED,
      'Not connected to Chrome. Please call chrome_connect first.'
    );
  }

  // Route to the correct module
  for (const mod of toolModules) {
    if (mod.tools.some((t) => t.name === name)) {
      const result = await mod.handleToolCall(name, args, bm);
      if (result !== undefined) return result;
    }
  }

  throw new ChromeError(ErrorCode.INTERNAL_ERROR, `Unknown tool: ${name}`);
}

// ============================================================
// MCP Server Setup
// ============================================================

const server = new Server(
  { name: 'chrome-pilot-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: allTools };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, (args as Record<string, unknown>) || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const errorResponse =
      error instanceof ChromeError
        ? error.toJSON()
        : {
            error: true,
            code: ErrorCode.INTERNAL_ERROR,
            message: error instanceof Error ? error.message : String(error),
          };

    return {
      content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
      isError: true,
    };
  }
});

// ============================================================
// Startup
// ============================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Chrome Pilot MCP server running');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
