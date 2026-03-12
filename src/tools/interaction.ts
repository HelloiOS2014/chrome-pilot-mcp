/**
 * Interaction tools: chrome_click, chrome_type, chrome_scroll, chrome_press_key
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from '../browser.js';
import { ChromeError, ErrorCode } from '../types.js';

export const tools: Tool[] = [
  {
    name: 'chrome_click',
    description: 'Click on an element by CSS selector or coordinates',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the element to click',
        },
        x: {
          type: 'number',
          description: 'X coordinate (use with y instead of selector)',
        },
        y: {
          type: 'number',
          description: 'Y coordinate (use with x instead of selector)',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
        click_count: {
          type: 'number',
          description: 'Number of clicks (1=single, 2=double, default: 1)',
        },
      },
    },
  },
  {
    name: 'chrome_type',
    description: 'Type text into a focused element or a specific element by selector',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to type',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to focus before typing (optional)',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
        clear_first: {
          type: 'boolean',
          description: 'Clear the field before typing (default: false)',
        },
        delay: {
          type: 'number',
          description: 'Delay between keystrokes in ms (default: 0)',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'chrome_scroll',
    description: 'Scroll the page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Scroll direction (default: down)',
        },
        amount: {
          type: 'number',
          description: 'Scroll amount in pixels (default: 500)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of scrollable element (optional, defaults to page)',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
      },
    },
  },
  {
    name: 'chrome_press_key',
    description: 'Press a keyboard key',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key to press (e.g., Enter, Tab, Escape, ArrowDown, Backspace, a, etc.)',
        },
        modifiers: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['Shift', 'Control', 'Alt', 'Meta'],
          },
          description: 'Modifier keys to hold (optional)',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
      },
      required: ['key'],
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
    case 'chrome_click': {
      const page = await getPage(bm, args.tab_index as number | undefined);
      const clickCount = (args.click_count as number | undefined) ?? 1;

      if (args.selector) {
        const selector = args.selector as string;
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector, { count: clickCount });
        } catch (err) {
          throw new ChromeError(
            ErrorCode.CLICK_FAILED,
            `Failed to click "${selector}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
        return { success: true, clicked: { selector, click_count: clickCount } };
      }

      if (args.x !== undefined && args.y !== undefined) {
        const x = args.x as number;
        const y = args.y as number;
        await page.mouse.click(x, y, { count: clickCount });
        return { success: true, clicked: { x, y, click_count: clickCount } };
      }

      throw new ChromeError(
        ErrorCode.INVALID_PARAMETER,
        'Either "selector" or "x" and "y" coordinates must be provided.'
      );
    }

    case 'chrome_type': {
      const text = args.text as string;
      const page = await getPage(bm, args.tab_index as number | undefined);
      const delay = (args.delay as number | undefined) ?? 0;

      if (args.selector) {
        const selector = args.selector as string;
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          if (args.clear_first) {
            await page.click(selector, { count: 3 }); // select all
            await page.keyboard.press('Backspace');
          }
          await page.type(selector, text, { delay });
        } catch (err) {
          throw new ChromeError(
            ErrorCode.TYPE_FAILED,
            `Failed to type into "${selector}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } else {
        if (args.clear_first) {
          await page.keyboard.down('Meta');
          await page.keyboard.press('a');
          await page.keyboard.up('Meta');
          await page.keyboard.press('Backspace');
        }
        await page.keyboard.type(text, { delay });
      }

      return { success: true, typed: text.length > 50 ? text.slice(0, 50) + '...' : text };
    }

    case 'chrome_scroll': {
      const direction = (args.direction as string | undefined) ?? 'down';
      const amount = (args.amount as number | undefined) ?? 500;
      const page = await getPage(bm, args.tab_index as number | undefined);

      let deltaX = 0;
      let deltaY = 0;
      switch (direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }

      if (args.selector) {
        await page.evaluate(
          (sel: string, dx: number, dy: number) => {
            const el = document.querySelector(sel);
            if (el) el.scrollBy(dx, dy);
          },
          args.selector as string,
          deltaX,
          deltaY
        );
      } else {
        await page.evaluate(
          (dx: number, dy: number) => window.scrollBy(dx, dy),
          deltaX,
          deltaY
        );
      }

      return { success: true, direction, amount };
    }

    case 'chrome_press_key': {
      const key = args.key as string;
      const modifiers = (args.modifiers as string[] | undefined) ?? [];
      const page = await getPage(bm, args.tab_index as number | undefined);

      const modsDown: string[] = [];
      try {
        for (const mod of modifiers) {
          await page.keyboard.down(mod as 'Shift' | 'Control' | 'Alt' | 'Meta');
          modsDown.push(mod);
        }
        await page.keyboard.press(key as Parameters<typeof page.keyboard.press>[0]);
      } finally {
        for (const mod of [...modsDown].reverse()) {
          await page.keyboard.up(mod as 'Shift' | 'Control' | 'Alt' | 'Meta').catch(() => {});
        }
      }

      return { success: true, key, modifiers };
    }

    default:
      return undefined;
  }
}
