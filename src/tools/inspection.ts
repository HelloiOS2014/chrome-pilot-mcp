/**
 * Inspection tools: chrome_screenshot, chrome_dump_dom, chrome_evaluate
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from '../browser.js';
import { ChromeError, ErrorCode } from '../types.js';

export const tools: Tool[] = [
  {
    name: 'chrome_screenshot',
    description: 'Take a screenshot of the current page (returns base64 image)',
    inputSchema: {
      type: 'object',
      properties: {
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
        full_page: {
          type: 'boolean',
          description: 'Capture full scrollable page (default: false, viewport only)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to capture a specific element (optional)',
        },
        quality: {
          type: 'number',
          description: 'JPEG quality 0-100 (only for jpeg format, default: 80)',
        },
        format: {
          type: 'string',
          enum: ['png', 'jpeg'],
          description: 'Image format (default: png)',
        },
      },
    },
  },
  {
    name: 'chrome_dump_dom',
    description: 'Get the DOM HTML of the page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to get HTML of a specific element (optional, defaults to full page)',
        },
        outer: {
          type: 'boolean',
          description: 'Return outerHTML instead of innerHTML (default: false)',
        },
      },
    },
  },
  {
    name: 'chrome_evaluate',
    description: 'Execute JavaScript in the page context and return the result',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'JavaScript expression to evaluate',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
      },
      required: ['expression'],
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
    case 'chrome_screenshot': {
      const page = await getPage(bm, args.tab_index as number | undefined);
      const format = (args.format as 'png' | 'jpeg' | undefined) ?? 'png';
      const fullPage = (args.full_page as boolean | undefined) ?? false;
      const quality = args.quality as number | undefined;

      try {
        let base64: string;

        if (args.selector) {
          const selector = args.selector as string;
          const element = await page.$(selector);
          if (!element) {
            throw new ChromeError(
              ErrorCode.ELEMENT_NOT_FOUND,
              `Element not found: ${selector}`
            );
          }
          const buffer = await element.screenshot({
            type: format,
            quality: format === 'png' ? undefined : (quality ?? 80),
          });
          base64 = Buffer.from(buffer).toString('base64');
        } else {
          const buffer = await page.screenshot({
            type: format,
            quality: format === 'png' ? undefined : (quality ?? 80),
            fullPage,
          });
          base64 = Buffer.from(buffer).toString('base64');
        }

        return {
          success: true,
          format,
          full_page: fullPage,
          base64,
        };
      } catch (err) {
        if (err instanceof ChromeError) throw err;
        throw new ChromeError(
          ErrorCode.SCREENSHOT_FAILED,
          `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    case 'chrome_dump_dom': {
      const page = await getPage(bm, args.tab_index as number | undefined);
      const outer = (args.outer as boolean | undefined) ?? false;

      let html: string;
      if (args.selector) {
        const selector = args.selector as string;
        const element = await page.$(selector);
        if (!element) {
          throw new ChromeError(
            ErrorCode.ELEMENT_NOT_FOUND,
            `Element not found: ${selector}`
          );
        }
        html = await element.evaluate(
          (el, useOuter) => (useOuter ? el.outerHTML : el.innerHTML),
          outer
        );
      } else {
        html = await page.evaluate(
          (useOuter: boolean) =>
            useOuter
              ? document.documentElement.outerHTML
              : document.documentElement.innerHTML,
          outer
        );
      }

      // Truncate if too large
      const maxLength = 100000;
      const truncated = html.length > maxLength;
      if (truncated) {
        html = html.slice(0, maxLength);
      }

      return {
        success: true,
        html,
        length: html.length,
        truncated,
      };
    }

    case 'chrome_evaluate': {
      const expression = args.expression as string;
      const page = await getPage(bm, args.tab_index as number | undefined);

      try {
        const result = await page.evaluate(expression);
        return {
          success: true,
          result: result !== undefined ? JSON.parse(JSON.stringify(result)) : undefined,
        };
      } catch (err) {
        throw new ChromeError(
          ErrorCode.EVALUATE_FAILED,
          `Evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
          { expression }
        );
      }
    }

    default:
      return undefined;
  }
}
