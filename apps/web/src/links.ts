/** Where "Log in" and "Start free" go (the dashboard). Set VITE_DASHBOARD_URL when deploying. */
export const DASHBOARD_URL =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.replace(/\/$/, '') ??
  // Unset: the local dashboard in development, the live one in any build (previews too).
  (import.meta.env.DEV ? 'http://localhost:5173' : 'https://splitcraft-app.vercel.app');

export const GITHUB_URL = 'https://github.com/dhriti-kumawat/splitcraft';

/** The contact form posts here (a Supabase Edge Function). Set VITE_CONTACT_URL to override. */
export const CONTACT_URL =
  (import.meta.env.VITE_CONTACT_URL as string | undefined) ??
  'https://lbpcankminixtztjuxqf.supabase.co/functions/v1/contact';
