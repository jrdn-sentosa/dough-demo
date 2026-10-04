const HOUR_MS = 60 * 60 * 1000;

/**
 * Registers the service worker (built by vite-plugin-pwa) and calls `onNeedRefresh` when a new version has
 * downloaded and is waiting. Returns `apply`, which switches to the new version and reloads.
 * Only in the production build: during `npm run dev` there is no service worker, so nothing caches stale code.
 */
export async function registerServiceWorker(onNeedRefresh: () => void): Promise<() => void> {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  const { registerSW } = await import('virtual:pwa-register');
  const update = registerSW({
    onNeedRefresh,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Look for a new version hourly, and whenever the app comes back to the front (an installed app can stay open for days).
      const check = () => void registration.update().catch(() => undefined);
      window.setInterval(check, HOUR_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
  return () => {
    // Reload once the new version has taken over. The library's own reload only fires for some update paths, so don't rely on it.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    void update(true);
  };
}
