/** Where "Log in" goes (the dashboard). Set VITE_DASHBOARD_URL when deploying. */
export const DASHBOARD_URL =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined)?.replace(/\/$/, '') ??
  // Unset: the local dashboard in development, the live one in any build (previews too).
  (import.meta.env.DEV ? 'http://localhost:5173' : 'https://splitcraft-app.vercel.app');

export const GITHUB_URL = 'https://github.com/dhriti-kumawat/splitcraft';

/** The contact form posts here (a Supabase Edge Function). Set VITE_CONTACT_URL to override. */
export const CONTACT_URL =
  (import.meta.env.VITE_CONTACT_URL as string | undefined) ??
  'https://lbpcankminixtztjuxqf.supabase.co/functions/v1/contact';

/** Splitcraft is invite-only: the main call to action asks for access. */
export const REQUEST_ACCESS_URL = '/request-access/';

/** The dashboard with example data, no account needed and nothing saved. */
export const DEMO_URL = `${DASHBOARD_URL}/demo.html`;
