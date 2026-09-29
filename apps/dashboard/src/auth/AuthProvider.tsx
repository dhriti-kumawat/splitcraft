import { useEffect, useState, type ReactNode } from 'react';
import type { AuthApi } from './api';
import { AuthContext, type AuthState } from './context';

export function AuthProvider({ api, children }: { api: AuthApi; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;
    const apply = (user: Awaited<ReturnType<AuthApi['getUser']>>) => {
      if (active)
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
    };
    void api.getUser().then(apply);
    const stop = api.onChange(apply);
    return () => {
      active = false;
      stop();
    };
  }, [api]);

  return <AuthContext.Provider value={{ state, api }}>{children}</AuthContext.Provider>;
}
