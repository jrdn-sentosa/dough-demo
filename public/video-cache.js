// Loaded by the service worker (importScripts, see pwa.config.ts). Keeps lesson videos and captions
// under /videos/ for offline use, but only after the student has played them, so the install stays small.
//
// Why this is hand-written: a <video> asks for a byte range, and the server answers 206 (partial), which
// the Cache API cannot store. So the first play streams from the network as usual and, once, the whole file
// is fetched in the background and stored. After that, every range request is answered from the stored file.
//
// Only same-origin GET requests under /videos/ are touched. Nothing from Supabase or any other origin is.

const VIDEO_CACHE = 'dough-videos-v1';

/** A real video or caption file. A missing file can come back as the app's HTML page (dev and preview servers do that). */
function isMedia(response) {
  const type = response.headers.get('content-type') || '';
  return type.startsWith('video/') || type.startsWith('text/vtt');
}

/** "bytes=0-" or "bytes=100-199" against a file of `size` bytes, as { start, end } (inclusive), or null if it can't be served. */
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end;
  if (match[1] === '') {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}

/** Answers a range request from a stored whole file. */
async function partial(request, stored) {
  const blob = await stored.blob();
  const range = parseRange(request.headers.get('range'), blob.size);
  if (!range) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + blob.size } });
  }
  return new Response(blob.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      'Content-Type': stored.headers.get('content-type') || 'video/mp4',
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + blob.size,
      'Accept-Ranges': 'bytes',
    },
  });
}

const storing = new Set();

/** Fetches the whole file (no Range header) and stores it, once at a time per file. */
async function storeWhole(url) {
  if (storing.has(url)) return;
  storing.add(url);
  try {
    const response = await fetch(url);
    if (response.status === 200 && isMedia(response)) {
      await (await caches.open(VIDEO_CACHE)).put(url, response);
    }
  } catch {
    // Offline or interrupted: the next play tries again.
  } finally {
    storing.delete(url);
  }
}

/** Returns a Response, or null to leave the request alone. `waitUntil` keeps the worker alive while a file is stored. */
async function handle(request, waitUntil) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/videos/')) return null;

  const cache = await caches.open(VIDEO_CACHE);
  const stored = await cache.match(url.href);
  const isCaption = url.pathname.endsWith('.vtt');

  if (isCaption) {
    // Small and may be corrected later: the network first, the stored copy when offline.
    try {
      const fresh = await fetch(request);
      if (fresh.status === 200 && isMedia(fresh)) await cache.put(url.href, fresh.clone());
      return fresh;
    } catch (error) {
      if (stored) return stored;
      throw error;
    }
  }

  if (stored) return request.headers.has('range') ? partial(request, stored) : stored;

  // Not stored yet: play from the network now, keep a copy for next time.
  const response = await fetch(request);
  if (response.status === 200 && isMedia(response)) {
    waitUntil(cache.put(url.href, response.clone()));
  } else if (response.status === 206) {
    waitUntil(storeWhole(url.href));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/videos/')) return;
  event.respondWith(handle(event.request, (promise) => event.waitUntil(promise)).then((r) => r || fetch(event.request)));
});

// Lets tests drive the handler directly. Harmless in the worker.
self.doughVideoCache = { handle, parseRange, VIDEO_CACHE };
