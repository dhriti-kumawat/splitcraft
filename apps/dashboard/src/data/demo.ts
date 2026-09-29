// Demo data for the dashboard until Supabase is wired in (Phase 3 step 2).
// Values match the designs in design/screens/ and are clearly demo data.

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Project {
  id: string;
  name: string;
  mainDomain: string;
  allowedDomains: string[];
  installed: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  eventsThisMonth: number;
  eventsLimit: number;
}

export const demoUser: User = { id: 'u_demo', name: 'Dhriti Kumawat', role: 'owner' };

export const demoWorkspace: Workspace = {
  id: 'ws_demo',
  name: "Dhriti's Workspace",
  plan: 'free',
  eventsThisMonth: 48_210,
  eventsLimit: 100_000,
};

export const demoProjects: Project[] = [
  {
    id: 'trip-demo',
    name: 'Trip Demo',
    mainDomain: 'mytrips.dev',
    allowedDomains: ['staging.mytrips.dev', 'localhost:5173'],
    installed: true,
  },
  {
    id: 'checkout-lab',
    name: 'Checkout Lab',
    mainDomain: 'shoplab.dev',
    allowedDomains: ['*.vercel.app'],
    installed: true,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    mainDomain: 'dhriti.dev',
    allowedDomains: ['staging.dhriti.dev', 'localhost:3000'],
    installed: false,
  },
];
