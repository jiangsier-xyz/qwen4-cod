// Minimal CDP client over the browser's per-target WebSocket (Chrome :9222).
import fs from 'node:fs';

const BASE = process.env.CDP_BASE || 'http://localhost:9222';

export async function listPages() {
  const r = await fetch(BASE + '/json/list');
  return r.json();
}

export async function newPage(url = 'about:blank') {
  const r = await fetch(BASE + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!r.ok) throw new Error('json/new failed: ' + r.status);
  return r.json();
}

export class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl; this.id = 0; this.pending = new Map();
    this.handlers = new Map(); this.events = [];
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('ws connect error'));
    });
    this.ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
        for (const h of this.handlers.get(msg.method) || []) h(msg.params);
      }
    };
    return this;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('CDP timeout: ' + method)); }
      }, 60000);
    });
  }
  on(method, cb) {
    const a = this.handlers.get(method) || []; a.push(cb); this.handlers.set(method, a);
  }
  async evaluate(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('eval exception: ' + (d.exception?.description || d.text || JSON.stringify(d)));
    }
    return r.result.value;
  }
  async screenshot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  async key(type, key, code, windowsVirtualKeyCode) {
    await this.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode });
  }
  async mouse(type, x, y, button = 'none', buttons = 0) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 1 });
  }
  close() { try { this.ws.close(); } catch {} }
}

export async function attachPage(url) {
  const pages = await listPages();
  let page = pages.find((p) => p.type === 'page');
  if (!page) page = await newPage('about:blank');
  const cdp = await new CDP(page.webSocketDebuggerUrl).connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  // occluded host windows throttle rAF — force foreground + focus so frames run
  try { await cdp.send('Page.bringToFront'); } catch {}
  try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch {}
  if (url) await cdp.send('Page.navigate', { url });
  return cdp;
}

export async function waitFor(cdp, expr, timeoutMs = 20000, interval = 150) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await cdp.evaluate(expr); } catch {}
    if (v) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, interval));
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));