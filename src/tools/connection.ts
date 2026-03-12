/**
 * Connection management tools: chrome_status, chrome_connect, chrome_disconnect
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from '../browser.js';

export const tools: Tool[] = [
  {
    name: 'chrome_status',
    description: 'Check Chrome connection status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_connect',
    description:
      'Connect to an already-running Chrome browser via DevTools Protocol. Chrome must have remote debugging enabled (chrome://inspect/#remote-debugging).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_disconnect',
    description: 'Disconnect from Chrome (does not close the browser)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function handleToolCall(
  name: string,
  _args: Record<string, unknown>,
  bm: BrowserManager
): Promise<unknown> {
  switch (name) {
    case 'chrome_status': {
      return { success: true, ...bm.getStatus() };
    }

    case 'chrome_connect': {
      const result = await bm.connect();
      return {
        success: true,
        connected: true,
        chrome_version: result.version,
        tab_count: result.tabCount,
      };
    }

    case 'chrome_disconnect': {
      await bm.disconnect();
      return { success: true, connected: false };
    }

    default:
      return undefined;
  }
}
