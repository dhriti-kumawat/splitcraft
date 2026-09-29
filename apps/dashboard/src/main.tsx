import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '../../../design/tokens.css';
import './index.css';
import { AuthProvider } from './auth/AuthProvider';
import { createSupabase, createSupabaseAuth } from './auth/supabaseAuth';
import { DataContext } from './data/context';
import { createSupabaseData } from './data/supabaseData';
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
  const supabase = createSupabase(url, anonKey);
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider api={createSupabaseAuth(supabase)}>
          <DataContext.Provider value={createSupabaseData(supabase)}>
            <RouterProvider router={router} />
          </DataContext.Provider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
