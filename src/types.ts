/**
 * Chrome Pilot MCP - Type Definitions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { BrowserManager } from './browser.js';

// ============================================================
// Error Types
// ============================================================

export enum ErrorCode {
  // Connection errors (1xx)
  NOT_CONNECTED = 'E101',
  CONNECTION_FAILED = 'E102',
  DEVTOOLS_PORT_NOT_FOUND = 'E103',
  CHROME_NOT_RUNNING = 'E104',

  // Tab errors (2xx)
  TAB_NOT_FOUND = 'E201',

  // Navigation errors (3xx)
  NAVIGATION_FAILED = 'E301',

  // UI errors (4xx)
  ELEMENT_NOT_FOUND = 'E401',
  ELEMENT_TIMEOUT = 'E402',
  CLICK_FAILED = 'E403',
  TYPE_FAILED = 'E404',

  // Screenshot errors (5xx)
  SCREENSHOT_FAILED = 'E501',

  // Evaluation errors (6xx)
  EVALUATE_FAILED = 'E601',

  // General errors (9xx)
  INVALID_PARAMETER = 'E901',
  OPERATION_TIMEOUT = 'E902',
  INTERNAL_ERROR = 'E999',
}

export class ChromeError extends Error {
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ChromeError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================================
// Tool Module Interface
// ============================================================

export interface ToolModule {
  tools: Tool[];
  handleToolCall: (
    name: string,
    args: Record<string, unknown>,
    bm: BrowserManager
  ) => Promise<unknown>;
}

// ============================================================
// Tab Types
// ============================================================

export interface TabInfo {
  index: number;
  url: string;
  title: string;
  active: boolean;
}
