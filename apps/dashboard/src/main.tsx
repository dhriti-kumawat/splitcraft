import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '../../../design/tokens.css';
import './index.css';
import { AuthProvider } from './auth/AuthProvider';
import { createSupabaseAuth } from './auth/supabaseAuth';
import { WorkspaceProvider } from './data/WorkspaceProvider';
import { router } from './router';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const root = createRoot(document.getElementById('root')!);

if (!url || !anonKey) {
  root.render(
    <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', lineHeight: 1.5 }}>
      <h1>Supabase isn't configured</h1>
      <p>
        Copy <code>apps/dashboard/.env.example</code> to <code>apps/dashboard/.env.local</code>,
        fill in your project URL and anon key, then restart <code>npm run dev</code>.
      </p>
    </main>,
  );
} else {
  const auth = createSupabaseAuth(url, anonKey);
  root.render(
    <StrictMode>
      <AuthProvider api={auth}>
        <WorkspaceProvider>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </AuthProvider>
    </StrictMode>,
  );
}
