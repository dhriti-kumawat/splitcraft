/** Where "Log in" and "Start free" go (the dashboard). Set VITE_DASHBOARD_URL when deploying. */
export const DASHBOARD_URL =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.replace(/\/$/, '') ??
  // Unset: the local dashboard in development, the live one in any build (previews too).
  (import.meta.env.DEV ? 'http://localhost:5173' : 'https://splitcraft-app.vercel.app');

export const GITHUB_URL = 'https://github.com/dhriti-kumawat/splitcraft';
