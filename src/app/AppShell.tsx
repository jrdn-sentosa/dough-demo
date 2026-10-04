import { Navigate, Outlet, useLocation } from 'react-router';
import { isDemoMode } from './demoFlag';
import { useData } from './DataProvider';
import { guardRedirect } from './guard';

/** Real accounts only. There is no offline syncing: changes made without a connection are not kept. */
export const OFFLINE_MESSAGE = "You're offline. Your loaf is safe, but changes can't be saved until you're back online.";
export const ERROR_MESSAGE = "We couldn't save that just now. Your loaf is safe. Please try again in a moment.";

export function AppShell() {
  const { data, connection } = useData();
  const { pathname, search } = useLocation();
  const redirect = data ? guardRedirect(pathname, data, search) : null;

  return (
    <div className="app-backdrop">
      <div className="phone-frame">
        <div className="phone-frame__scroll">
          <main className="app-screen">
            {isDemoMode() && <span className="demo-pill">Demo</span>}
            {connection !== 'online' && (
              <p className="connection-banner" role="status">
                {connection === 'offline' ? OFFLINE_MESSAGE : ERROR_MESSAGE}
              </p>
            )}
            {/* Nothing shows until saved data has loaded, so no screen flashes before the guard decides. */}
            {data && (redirect ? <Navigate to={redirect} replace /> : <Outlet />)}
          </main>
        </div>
      </div>
    </div>
  );
}
