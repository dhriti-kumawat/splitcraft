/** Where "Log in" and "Start free" go (the dashboard). Set VITE_DASHBOARD_URL when deploying. */
export const DASHBOARD_URL =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:5173';

export const GITHUB_URL = 'https://github.com/dhriti-kumawat/splitcraft';
