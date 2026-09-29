import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './context';
import { oauthError } from './next';

/** Sends signed-out visitors to /login, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <div aria-busy="true" aria-label="Loading" />;
  if (state.status === 'signedOut') {
    const failed = oauthError(location.search, location.hash);
    const next = failed ? location.pathname : location.pathname + location.search;
    const error = failed ? `&error=${encodeURIComponent(failed)}` : '';
    return <Navigate to={`/login?next=${encodeURIComponent(next)}${error}`} replace />;
  }
  return children;
}
