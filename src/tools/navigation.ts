/**
 * Navigation tools: chrome_navigate, chrome_back, chrome_forward, chrome_reload
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from '../browser.js';
import { ChromeError, ErrorCode } from '../types.js';

export const tools: Tool[] = [
  {
    name: 'chrome_navigate',
    description: 'Navigate the active tab to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index to navigate (optional, defaults to active tab)',
        },
        wait_until: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'],
          description: 'When to consider navigation complete (default: load)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'chrome_back',
    description: 'Go back in browser history',
    inputSchema: {
      type: 'object',
      properties: {
        tab_index: {
          type: 'number',
          description: 'Tab index (optional, defaults to active tab)',
        },
      },
    },
  },
  {
    name: 'chrome_forward',
    description: 'Go forward in browser history',
    inputSchema: {
      type: 'object',
      properties: {
        tab_index: {
          type: 'number',
          description: 'Tab index (optional, defaults to active tab)',
        },
      },
    },
  },
  {
    name: 'chrome_reload',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        tab_index: {
          type: 'number',
          description: 'Tab index (optional, defaults to active tab)',
        },
        ignore_cache: {
          type: 'boolean',
          description: 'Whether to bypass cache (default: false)',
        },
      },
    },
  },
];

async function getPage(bm: BrowserManager, tabIndex?: number) {
  if (tabIndex !== undefined) {
    return bm.getPageByIndex(tabIndex);
  }
  return bm.getActivePage();
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  bm: BrowserManager
): Promise<unknown> {
  switch (name) {
    case 'chrome_navigate': {
      const url = args.url as string;
      const waitUntil = (args.wait_until as string | undefined) ?? 'load';
      const page = await getPage(bm, args.tab_index as number | undefined);

      try {
        const response = await page.goto(url, {
          waitUntil: waitUntil as 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2',
          timeout: 30000,
        });
        return {
          success: true,
          url: page.url(),
          status: response?.status() ?? null,
          title: await page.title().catch(() => '(unavailable)'),
        };
      } catch (err) {
        throw new ChromeError(
          ErrorCode.NAVIGATION_FAILED,
          `Navigation to ${url} failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    case 'chrome_back': {
      const page = await getPage(bm, args.tab_index as number | undefined);
      await page.goBack({ timeout: 10000 }).catch(() => null);
      return {
        success: true,
        url: page.url(),
        title: await page.title().catch(() => '(unavailable)'),
      };
    }

    case 'chrome_forward': {
      const page = await getPage(bm, args.tab_index as number | undefined);
      await page.goForward({ timeout: 10000 }).catch(() => null);
      return {
        success: true,
        url: page.url(),
        title: await page.title().catch(() => '(unavailable)'),
      };
    }

    case 'chrome_reload': {
      const page = await getPage(bm, args.tab_index as number | undefined);
      // Note: Puppeteer's page.reload() doesn't support ignoreCache directly,
      // so we use the CDP protocol for cache bypass if needed
      if (args.ignore_cache) {
        const client = await page.createCDPSession();
        try {
          await client.send('Network.setCacheDisabled', { cacheDisabled: true });
          await page.reload({ timeout: 30000 });
        } finally {
          await client.send('Network.setCacheDisabled', { cacheDisabled: false }).catch(() => {});
          await client.detach().catch(() => {});
        }
      } else {
        await page.reload({ timeout: 30000 });
      }
      return {
        success: true,
        url: page.url(),
        title: await page.title().catch(() => '(unavailable)'),
      };
    }

    default:
      return undefined;
  }
}
