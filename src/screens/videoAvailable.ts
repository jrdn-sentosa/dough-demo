import { useEffect, useState } from 'react';

const probes = new Map<string, Promise<boolean>>();

/**
 * Whether a lesson video file really exists. A missing file must not count as found
 * even when a server answers every path with the app's index page, so the reply has to be a video.
 * Used only to pick link wording ("Rewatch this part" or "Read the summary"); the player has its own fallback.
 */
export function probeVideo(url: string): Promise<boolean> {
  let probe = probes.get(url);
  if (!probe) {
    probe = (async () => {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok && (res.headers.get('content-type') ?? '').startsWith('video/');
      } catch {
        return false;
      }
    })();
    probes.set(url, probe);
  }
  return probe;
}

export function resetVideoProbe(): void {
  probes.clear();
}

/** False until the probe says the video exists. */
export function useVideoAvailable(url: string): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let live = true;
    void probeVideo(url).then((found) => {
      if (live) setAvailable(found);
    });
    return () => {
      live = false;
    };
  }, [url]);
  return available;
}
