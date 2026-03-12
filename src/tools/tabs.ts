/**
 * Tab management tools: chrome_list_tabs, chrome_select_tab, chrome_close_tab
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from '../browser.js';
import type { TabInfo } from '../types.js';

export const tools: Tool[] = [
  {
    name: 'chrome_list_tabs',
    description: 'List all open tabs with their title and URL',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chrome_select_tab',
    description: 'Switch to a tab by index (from chrome_list_tabs)',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'number',
          description: 'Tab index (0-based)',
        },
      },
      required: ['index'],
    },
  },
  {
    name: 'chrome_close_tab',
    description: 'Close a tab by index',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'number',
          description: 'Tab index to close (0-based)',
        },
      },
      required: ['index'],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  bm: BrowserManager
): Promise<unknown> {
  switch (name) {
    case 'chrome_list_tabs': {
      const pages = await bm.getPages();
      const tabs: TabInfo[] = pages.map((page, i) => ({
        index: i,
        url: page.url(),
        title: '',
        active: false,
      }));

      // Fetch titles (may fail for some pages)
      for (let i = 0; i < pages.length; i++) {
        try {
          tabs[i].title = await pages[i].title();
        } catch {
          tabs[i].title = '(unavailable)';
        }
      }

      return { success: true, tabs, total: tabs.length };
    }

    case 'chrome_select_tab': {
      const index = args.index as number;
      const page = await bm.getPageByIndex(index);
      await page.bringToFront();
      return {
        success: true,
        index,
        url: page.url(),
        title: await page.title().catch(() => '(unavailable)'),
      };
    }

    case 'chrome_close_tab': {
      const index = args.index as number;
      const page = await bm.getPageByIndex(index);
      await page.close();
      const remaining = await bm.getPages();
      return { success: true, closed_index: index, remaining_tabs: remaining.length };
    }

    default:
      return undefined;
  }
}
