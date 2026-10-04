import script from '../../public/video-cache.js?raw';
import { describe, expect, it, vi } from 'vitest';

// public/video-cache.js runs inside the service worker. Here it runs against a fake cache and a fake network.

interface Handler {
  handle: (request: Request, waitUntil: (p: Promise<unknown>) => void) => Promise<Response | null>;
  parseRange: (header: string | null, size: number) => { start: number; end: number } | null;
}

function setup(network: (request: Request) => Promise<Response> | Response) {
  const store = new Map<string, Response>();
  const cache = {
    match: async (key: string) => store.get(key)?.clone(),
    put: async (key: string, response: Response) => void store.set(key, response),
  };
  const caches = { open: async () => cache };
  const fetchFn = vi.fn(async (input: Request | string) => network(typeof input === 'string' ? new Request(input) : input));
  const self = { location: { origin: 'https://dough.test' }, addEventListener: () => undefined } as Record<string, unknown>;
  new Function('self', 'caches', 'fetch', script)(self, caches, fetchFn);
  const waits: Promise<unknown>[] = [];
  return {
    handler: self.doughVideoCache as Handler,
    store,
    fetchFn,
    waitUntil: (p: Promise<unknown>) => void waits.push(p),
    settle: () => Promise.all(waits),
  };
}

const VIDEO = 'https://dough.test/videos/emergency-fund/ef-what-its-for.mp4';
const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
const mp4 = (init: ResponseInit = {}) => new Response(bytes, { headers: { 'content-type': 'video/mp4' }, ...init });
const ranged = (range: string) => new Request(VIDEO, { headers: { range } });

describe('parseRange', () => {
  const { handler } = setup(() => mp4());
  it('reads open, closed and suffix ranges, and refuses nonsense', () => {
    expect(handler.parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(handler.parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(handler.parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(handler.parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(handler.parseRange('bytes=200-', 100)).toBeNull();
    expect(handler.parseRange('nope', 100)).toBeNull();
    expect(handler.parseRange(null, 100)).toBeNull();
  });
});

describe('video cache', () => {
  it('leaves other origins alone, Supabase included', async () => {
    const t = setup(() => mp4());
    for (const href of ['https://abc.supabase.co/rest/v1/loaves', 'https://abc.supabase.co/auth/v1/token', 'https://cdn.example.com/videos/a.mp4']) {
      expect(await t.handler.handle(new Request(href), t.waitUntil), href).toBeNull();
    }
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.store.size).toBe(0);
  });

  it('leaves same-origin pages and non-GET requests alone', async () => {
    const t = setup(() => mp4());
    expect(await t.handler.handle(new Request('https://dough.test/lessons'), t.waitUntil)).toBeNull();
    expect(await t.handler.handle(new Request(VIDEO, { method: 'POST' }), t.waitUntil)).toBeNull();
  });

  it('plays from the network the first time, then stores the whole file in the background', async () => {
    const t = setup((req) => (req.headers.has('range') ? mp4({ status: 206 }) : mp4()));
    const first = await t.handler.handle(ranged('bytes=0-'), t.waitUntil);
    expect(first?.status).toBe(206);
    await t.settle();
    expect(t.store.has(VIDEO)).toBe(true);
  });

  it('answers range requests from the stored file once it is there, without the network', async () => {
    const t = setup(() => mp4());
    await t.handler.handle(new Request(VIDEO), t.waitUntil);
    await t.settle();
    t.fetchFn.mockClear();
    const part = await t.handler.handle(ranged('bytes=10-19'), t.waitUntil);
    expect(part?.status).toBe(206);
    expect(part?.headers.get('content-range')).toBe('bytes 10-19/100');
    expect([...new Uint8Array(await (part as Response).arrayBuffer())]).toEqual(Array.from({ length: 10 }, (_, i) => 10 + i));
    expect(t.fetchFn).not.toHaveBeenCalled();
  });

  it('never stores a missing video, even when the server answers with the app page', async () => {
    const t = setup(() => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }));
    await t.handler.handle(new Request(VIDEO), t.waitUntil);
    await t.settle();
    expect(t.store.size).toBe(0);
    const notFound = setup(() => new Response('', { status: 404 }));
    await notFound.handler.handle(new Request(VIDEO), notFound.waitUntil);
    await notFound.settle();
    expect(notFound.store.size).toBe(0);
  });

  it('keeps captions for offline, using the network first', async () => {
    const vtt = 'https://dough.test/videos/emergency-fund/ef-what-its-for.vtt';
    let online = true;
    const t = setup(() => {
      if (!online) throw new TypeError('offline');
      return new Response('WEBVTT', { headers: { 'content-type': 'text/vtt' } });
    });
    await t.handler.handle(new Request(vtt), t.waitUntil);
    expect(t.store.has(vtt)).toBe(true);
    online = false;
    const offline = await t.handler.handle(new Request(vtt), t.waitUntil);
    expect(await offline?.text()).toBe('WEBVTT');
  });
});
