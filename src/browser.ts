/**
 * Chrome Pilot MCP - Browser Manager
 *
 * Reads DevToolsActivePort from Chrome's user data directory
 * and connects via patchright-core (anti-detection Playwright fork).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { chromium, type Browser, type Page, type BrowserContext } from 'patchright-core';
import { ChromeError, ErrorCode } from './types.js';

// Stealth script injected into every page to hide remaining fingerprints.
// Patchright handles: navigator.webdriver, Error.stack pptr frames, cdc_* vars.
// We still need: hasFocus, chrome.runtime, plugins, vendor, permissions, WebGL, etc.
const STEALTH_JS = `
  // === P0: High-risk mitigations ===

  // document.hasFocus() — always return true (background tabs return false, exposing automation)
  Document.prototype.hasFocus = function() { return true; };

  // chrome.runtime emulation — real Chrome has this object but extension-less
  // browsers have runtime.id === undefined
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: function() { return { onMessage: { addListener: function(){} }, postMessage: function(){}, disconnect: function(){} }; },
      sendMessage: function() {},
      onMessage: { addListener: function(){}, removeListener: function(){} },
      onConnect: { addListener: function(){}, removeListener: function(){} },
      id: undefined,
    };
  }

  // navigator.vendor — CDP connections may leave this empty
  if (!navigator.vendor || navigator.vendor === '') {
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
  }

  // navigator.plugins — realistic Plugin/MimeType objects
  (function() {
    function makeMimeType(type, suffixes, description, plugin) {
      const mt = Object.create(MimeType.prototype);
      Object.defineProperties(mt, {
        type:        { get: () => type },
        suffixes:    { get: () => suffixes },
        description: { get: () => description },
        enabledPlugin: { get: () => plugin },
      });
      return mt;
    }
    function makePlugin(name, description, filename, mimeTypes) {
      const p = Object.create(Plugin.prototype);
      const mimes = [];
      Object.defineProperties(p, {
        name:        { get: () => name },
        description: { get: () => description },
        filename:    { get: () => filename },
        length:      { get: () => mimes.length },
      });
      for (let i = 0; i < mimeTypes.length; i++) {
        const m = makeMimeType(mimeTypes[i].type, mimeTypes[i].suffixes, mimeTypes[i].description, p);
        mimes.push(m);
        Object.defineProperty(p, i, { get: () => m });
        Object.defineProperty(p, mimeTypes[i].type, { get: () => m });
      }
      return p;
    }
    const pluginData = [
      { name: 'Chrome PDF Plugin', desc: 'Portable Document Format', file: 'internal-pdf-viewer',
        mimes: [{ type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
      { name: 'Chrome PDF Viewer', desc: '', file: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        mimes: [{ type: 'application/pdf', suffixes: 'pdf', description: '' }] },
      { name: 'Native Client', desc: '', file: 'internal-nacl-plugin',
        mimes: [
          { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
          { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
        ] },
    ];
    const plugins = pluginData.map(d => makePlugin(d.name, d.desc, d.file, d.mimes));
    const pluginArray = Object.create(PluginArray.prototype);
    Object.defineProperty(pluginArray, 'length', { get: () => plugins.length });
    plugins.forEach((p, i) => {
      Object.defineProperty(pluginArray, i, { get: () => p });
      Object.defineProperty(pluginArray, p.name, { get: () => p });
    });
    pluginArray.item = function(i) { return plugins[i] || null; };
    pluginArray.namedItem = function(n) { return plugins.find(p => p.name === n) || null; };
    pluginArray.refresh = function() {};
    pluginArray[Symbol.iterator] = function() { return plugins[Symbol.iterator](); };
    Object.defineProperty(navigator, 'plugins', { get: () => pluginArray });
  })();

  // === P1: Medium-risk mitigations ===

  // Mask the Permissions API to hide "notifications" anomaly
  const origQuery = window.Permissions?.prototype?.query;
  if (origQuery) {
    window.Permissions.prototype.query = function(params) {
      if (params?.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return origQuery.call(this, params);
    };
  }

  // WebGL fingerprint — hide "Google SwiftShader" (headless indicator)
  (function() {
    const getParamProto = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      // UNMASKED_VENDOR_WEBGL = 0x9245, UNMASKED_RENDERER_WEBGL = 0x9246
      if (param === 0x9245) return 'Intel Inc.';
      if (param === 0x9246) return 'Intel Iris OpenGL Engine';
      return getParamProto.call(this, param);
    };
    // Same for WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParam2Proto = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 0x9245) return 'Intel Inc.';
        if (param === 0x9246) return 'Intel Iris OpenGL Engine';
        return getParam2Proto.call(this, param);
      };
    }
  })();

  // navigator.hardwareConcurrency — ensure reasonable value
  if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency < 2) {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  }

  // navigator.deviceMemory — ensure present and reasonable
  if (!navigator.deviceMemory) {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  }

  // === P2: Low-risk optimizations ===

  // navigator.languages — keep browser value if present, only fallback to default
  if (!navigator.languages || navigator.languages.length === 0) {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en'],
    });
  }

  // === Debug port blocking ===

  // Intercept fetch requests to localhost/127.0.0.1 debug endpoints
  const origFetch = window.fetch;
  window.fetch = function(url, ...args) {
    const urlStr = (url instanceof Request ? url.url : String(url));
    if (/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\/(json|devtools)/i.test(urlStr)) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    return origFetch.call(this, url, ...args);
  };

  // Intercept WebSocket connections to localhost/127.0.0.1
  const OrigWebSocket = window.WebSocket;
  window.WebSocket = function(url, ...args) {
    if (/^wss?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?/i.test(String(url))) {
      throw new DOMException("WebSocket connection failed", "SecurityError");
    }
    return new OrigWebSocket(url, ...args);
  };
  window.WebSocket.prototype = OrigWebSocket.prototype;
  Object.defineProperty(window.WebSocket, 'CONNECTING', { value: 0 });
  Object.defineProperty(window.WebSocket, 'OPEN', { value: 1 });
  Object.defineProperty(window.WebSocket, 'CLOSING', { value: 2 });
  Object.defineProperty(window.WebSocket, 'CLOSED', { value: 3 });

  // Intercept XMLHttpRequest to localhost/127.0.0.1 debug endpoints
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\/(json|devtools)/i.test(String(url))) {
      throw new DOMException("Network error", "NetworkError");
    }
    return origXHROpen.call(this, method, url, ...args);
  };
`;

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
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
    if (this.browser && this.browser.isConnected()) {
      const pages = this.context!.pages();
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
      const connectPromise = chromium.connectOverCDP(wsEndpoint);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out after 15s')), 15000)
      );
      this.browser = await Promise.race([connectPromise, timeoutPromise]);
      this.context = this.browser.contexts()[0];
    } catch (err) {
      throw new ChromeError(
        ErrorCode.CONNECTION_FAILED,
        `Failed to connect to Chrome: ${err instanceof Error ? err.message : String(err)}`,
        { wsEndpoint }
      );
    }

    // Get version
    try {
      this.chromeVersion = this.browser.version();
    } catch {
      this.chromeVersion = 'unknown';
    }

    this.connectedAt = new Date();

    // Apply stealth to all existing pages
    await this.applyStealthToAllPages();

    // Apply stealth to any new pages automatically
    this.context!.on('page', async (page) => {
      try {
        await this.applyStealthToPage(page);
      } catch {
        // ignore - page may have closed
      }
    });

    const pages = this.context!.pages();
    return {
      version: this.chromeVersion,
      tabCount: pages.length,
    };
  }

  // ----------------------------------------------------------
  // Stealth: hide CDP fingerprints
  // ----------------------------------------------------------

  private async applyStealthToPage(page: Page): Promise<void> {
    try {
      // addInitScript runs on every new document (equivalent to evaluateOnNewDocument)
      await page.addInitScript(STEALTH_JS);
      // Also run immediately on the current document
      const evalPromise = page.evaluate(STEALTH_JS);
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
      await Promise.race([evalPromise, timeout]);
    } catch {
      // ignore - some pages (chrome://) don't allow script injection
    }
  }

  private async applyStealthToAllPages(): Promise<void> {
    const pages = await this.getPages();
    const allStealth = Promise.all(pages.map((p) => this.applyStealthToPage(p)));
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 10000));
    await Promise.race([allStealth, timeout]);
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.connectedAt = null;
      this.chromeVersion = null;
    }
  }

  // ----------------------------------------------------------
  // Status
  // ----------------------------------------------------------

  isConnected(): boolean {
    return this.browser !== null && this.browser.isConnected();
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
    if (!this.browser || !this.browser.isConnected()) {
      throw new ChromeError(
        ErrorCode.NOT_CONNECTED,
        'Not connected to Chrome. Please call chrome_connect first.'
      );
    }
    return this.browser;
  }

  async getPages(): Promise<Page[]> {
    if (!this.context) {
      throw new ChromeError(
        ErrorCode.NOT_CONNECTED,
        'Not connected to Chrome. Please call chrome_connect first.'
      );
    }
    return this.context.pages();
  }

  async getActivePage(): Promise<Page> {
    const pages = await this.getPages();
    if (pages.length === 0) {
      throw new ChromeError(ErrorCode.TAB_NOT_FOUND, 'No tabs available.');
    }
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
