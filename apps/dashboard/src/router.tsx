import { createBrowserRouter, Navigate } from 'react-router';

// Placeholder routes; real screens arrive in Phase 3 (see design/README.md).
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/projects" replace /> },
  { path: '/projects', element: <h1>Projects</h1> },
  { path: '*', element: <h1>Page not found</h1> },
]);
