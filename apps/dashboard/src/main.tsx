import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '../../../design/tokens.css';
import './index.css';
import { WorkspaceProvider } from './data/WorkspaceProvider';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <RouterProvider router={router} />
    </WorkspaceProvider>
  </StrictMode>,
);
