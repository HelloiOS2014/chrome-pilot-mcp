/**
 * Chrome Pilot MCP - Browser Manager
 *
 * Reads DevToolsActivePort from Chrome's user data directory
 * and connects via puppeteer-core.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { ChromeError, ErrorCode } from './types.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private connectedAt: Date | null = null;
  private chromeVersion: string | null = null;

  // ----------------------------------------------------------
  // Chrome data dir (cross-platform)
  // ----------------------------------------------------------

  getChromeDataDir(): string {
    switch (process.platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
      case 'win32': {
        const localAppData = process.env.LOCALAPPDATA;
        if (!localAppData) {
          throw new ChromeError(
            ErrorCode.INTERNAL_ERROR,
            'LOCALAPPDATA environment variable is not set.'
          );
        }
        return path.join(localAppData, 'Google/Chrome/User Data');
      }
      case 'linux':
        return path.join(os.homedir(), '.config/google-chrome');
      default:
        throw new ChromeError(
          ErrorCode.INTERNAL_ERROR,
          `Unsupported platform: ${process.platform}`
        );
    }
  }

  // ----------------------------------------------------------
  // Read DevToolsActivePort
  // ----------------------------------------------------------

  private readDevToolsActivePort(): { port: number; wsPath: string } {
    const dataDir = this.getChromeDataDir();
    const filePath = path.join(dataDir, 'DevToolsActivePort');

    if (!fs.existsSync(filePath)) {
      throw new ChromeError(
        ErrorCode.DEVTOOLS_PORT_NOT_FOUND,
        'DevToolsActivePort file not found. Please open chrome://inspect/#remote-debugging in Chrome and enable remote debugging.',
        { path: filePath }
      );
    }

    const content = fs.readFileSync(filePath, 'utf8').trim();
    const lines = content.split('\n');

    if (lines.length < 2) {
      throw new ChromeError(
        ErrorCode.DEVTOOLS_PORT_NOT_FOUND,
        'DevToolsActivePort file has unexpected format.',
        { content }
      );
    }

    const port = parseInt(lines[0], 10);
    const wsPath = lines[1];

    if (isNaN(port) || !wsPath) {
      throw new ChromeError(
        ErrorCode.DEVTOOLS_PORT_NOT_FOUND,
        'Failed to parse DevToolsActivePort.',
        { content }
      );
    }

    return { port, wsPath };
  }

  // ----------------------------------------------------------
  // Check port connectivity
  // ----------------------------------------------------------

  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });
  }

  // ----------------------------------------------------------
  // Connect / Disconnect
  // ----------------------------------------------------------

  async connect(): Promise<{ version: string; tabCount: number }> {
    if (this.browser && this.browser.connected) {
      const pages = await this.browser.pages();
      return {
        version: this.chromeVersion || 'unknown',
        tabCount: pages.length,
      };
    }

    const { port, wsPath } = this.readDevToolsActivePort();

    const reachable = await this.checkPort(port);
    if (!reachable) {
      throw new ChromeError(
        ErrorCode.CHROME_NOT_RUNNING,
        `Chrome remote debugging port ${port} is not reachable. Make sure Chrome is running and remote debugging is enabled.`,
        { port }
      );
    }

    const wsEndpoint = `ws://127.0.0.1:${port}${wsPath}`;

    try {
      this.browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
        defaultViewport: null,
      });
    } catch (err) {
      throw new ChromeError(
        ErrorCode.CONNECTION_FAILED,
        `Failed to connect to Chrome: ${err instanceof Error ? err.message : String(err)}`,
        { wsEndpoint }
      );
    }

    // Get version
    try {
      this.chromeVersion = await this.browser.version();
    } catch {
      this.chromeVersion = 'unknown';
    }

    this.connectedAt = new Date();

    const pages = await this.browser.pages();
    return {
      version: this.chromeVersion,
      tabCount: pages.length,
    };
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      this.browser.disconnect();
      this.browser = null;
      this.connectedAt = null;
      this.chromeVersion = null;
    }
  }

  // ----------------------------------------------------------
  // Status
  // ----------------------------------------------------------

  isConnected(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  getStatus(): {
    connected: boolean;
    version: string | null;
    connectedAt: string | null;
  } {
    return {
      connected: this.isConnected(),
      version: this.chromeVersion,
      connectedAt: this.connectedAt?.toISOString() ?? null,
    };
  }

  // ----------------------------------------------------------
  // Browser & Page access
  // ----------------------------------------------------------

  getBrowser(): Browser {
    if (!this.browser || !this.browser.connected) {
      throw new ChromeError(
        ErrorCode.NOT_CONNECTED,
        'Not connected to Chrome. Please call chrome_connect first.'
      );
    }
    return this.browser;
  }

  async getPages(): Promise<Page[]> {
    return this.getBrowser().pages();
  }

  async getActivePage(): Promise<Page> {
    const pages = await this.getPages();
    if (pages.length === 0) {
      throw new ChromeError(ErrorCode.TAB_NOT_FOUND, 'No tabs available.');
    }
    // Return the last focused page (puppeteer-core doesn't track focus,
    // so we use the last page in the list as a reasonable default)
    return pages[pages.length - 1];
  }

  async getPageByIndex(index: number): Promise<Page> {
    const pages = await this.getPages();
    if (index < 0 || index >= pages.length) {
      throw new ChromeError(ErrorCode.TAB_NOT_FOUND, `Tab index ${index} out of range (0-${pages.length - 1}).`);
    }
    return pages[index];
  }
}

// ----------------------------------------------------------
// Singleton
// ----------------------------------------------------------

let instance: BrowserManager | null = null;

export function getBrowserManager(): BrowserManager {
  if (!instance) {
    instance = new BrowserManager();
  }
  return instance;
}
