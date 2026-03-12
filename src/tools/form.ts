/**
 * Form tools: chrome_fill_form, chrome_select_option
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from '../browser.js';
import { ChromeError, ErrorCode } from '../types.js';

export const tools: Tool[] = [
  {
    name: 'chrome_fill_form',
    description: 'Fill multiple form fields at once',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          description: 'Array of { selector, value } pairs to fill',
          items: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector of the input field',
              },
              value: {
                type: 'string',
                description: 'Value to fill in',
              },
            },
            required: ['selector', 'value'],
          },
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
        clear_first: {
          type: 'boolean',
          description: 'Clear fields before filling (default: true)',
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'chrome_select_option',
    description: 'Select an option from a <select> dropdown',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the <select> element',
        },
        value: {
          type: 'string',
          description: 'Option value to select (the "value" attribute)',
        },
        label: {
          type: 'string',
          description: 'Option label text to select (alternative to value)',
        },
        tab_index: {
          type: 'number',
          description: 'Tab index (optional)',
        },
      },
      required: ['selector'],
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
    case 'chrome_fill_form': {
      const fields = args.fields as Array<{ selector: string; value: string }>;
      const clearFirst = (args.clear_first as boolean | undefined) ?? true;
      const page = await getPage(bm, args.tab_index as number | undefined);

      const results: Array<{ selector: string; success: boolean; error?: string }> = [];

      for (const field of fields) {
        try {
          await page.waitForSelector(field.selector, { timeout: 5000 });
          if (clearFirst) {
            // Triple-click to select all, then delete
            await page.click(field.selector, { count: 3 });
            await page.keyboard.press('Backspace');
          }
          await page.type(field.selector, field.value);
          results.push({ selector: field.selector, success: true });
        } catch (err) {
          results.push({
            selector: field.selector,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const allSuccess = results.every((r) => r.success);
      return {
        success: allSuccess,
        filled: results.filter((r) => r.success).length,
        total: results.length,
        results,
      };
    }

    case 'chrome_select_option': {
      const selector = args.selector as string;
      const page = await getPage(bm, args.tab_index as number | undefined);

      try {
        await page.waitForSelector(selector, { timeout: 5000 });

        let selected: string[];
        if (args.value !== undefined) {
          selected = await page.select(selector, args.value as string);
        } else if (args.label !== undefined) {
          // Select by label text
          const label = args.label as string;
          selected = await page.evaluate(
            (sel: string, lbl: string) => {
              const selectEl = document.querySelector(sel) as HTMLSelectElement;
              if (!selectEl) return [];
              const option = Array.from(selectEl.options).find(
                (o) => o.textContent?.trim() === lbl
              );
              if (option) {
                selectEl.value = option.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                return [option.value];
              }
              return [];
            },
            selector,
            label
          );
        } else {
          throw new ChromeError(
            ErrorCode.INVALID_PARAMETER,
            'Either "value" or "label" must be provided.'
          );
        }

        if (selected.length === 0) {
          throw new ChromeError(
            ErrorCode.ELEMENT_NOT_FOUND,
            'No matching option found in the select element.'
          );
        }

        return { success: true, selector, selected_values: selected };
      } catch (err) {
        if (err instanceof ChromeError) throw err;
        throw new ChromeError(
          ErrorCode.CLICK_FAILED,
          `Failed to select option in "${selector}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    default:
      return undefined;
  }
}
