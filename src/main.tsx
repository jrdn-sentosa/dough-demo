import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './styles/tokens.css';
import './styles/global.css';
import './styles/buttons.css';
import './styles/screens.css';
import { router } from './app/router';
import { AuthProvider } from './app/AuthProvider';
import { DataProvider } from './app/DataProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DataProvider>
        <RouterProvider router={router} />
      </DataProvider>
    </AuthProvider>
  </StrictMode>,
);
