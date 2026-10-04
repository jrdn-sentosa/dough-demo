import { Navigate, Outlet, useLocation } from 'react-router';
import { isDemoMode } from './demoFlag';
import { useData } from './DataProvider';
import { guardRedirect } from './guard';

export function AppShell() {
  const { data } = useData();
  const { pathname, search } = useLocation();
  const redirect = data ? guardRedirect(pathname, data, search) : null;

  return (
    <div className="app-backdrop">
      <div className="phone-frame">
        <div className="phone-frame__scroll">
          <main className="app-screen">
            {isDemoMode() && <span className="demo-pill">Demo</span>}
            {/* Nothing shows until saved data has loaded, so no screen flashes before the guard decides. */}
            {data && (redirect ? <Navigate to={redirect} replace /> : <Outlet />)}
          </main>
        </div>
      </div>
    </div>
  );
}
