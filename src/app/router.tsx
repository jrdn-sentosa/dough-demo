import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { Home } from '../screens/Home';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [{ path: '/', element: <Home /> }],
  },
]);
