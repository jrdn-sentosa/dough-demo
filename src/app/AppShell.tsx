import { Outlet } from 'react-router';
import { isDemoMode } from './demoFlag';

export function AppShell() {
  return (
    <div className="app-backdrop">
      <div className="phone-frame">
        <div className="phone-frame__scroll">
          <main className="app-screen">
            {isDemoMode() && <span className="demo-pill">Demo</span>}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
