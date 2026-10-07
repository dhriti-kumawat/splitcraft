import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import '../../../design/tokens.css';
import './index.css';
import { App } from './App';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App path={location.pathname} />
  </StrictMode>
);

// The production build ships pre-rendered HTML; take it over instead of re-rendering.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
