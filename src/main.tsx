import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import './styles/tokens.css';
import './styles/global.css';
import './styles/buttons.css';
import { router } from './app/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
