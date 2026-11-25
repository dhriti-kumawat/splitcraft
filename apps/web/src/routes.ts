import type { ReactNode } from 'react';
import {
  ChangelogPage,
  ComparePage,
  IntegrationsPage,
  PricingPage,
  RequestAccessPage,
  TourPage,
  UseCasesPage,
} from './Pages';

/** Pages beside the home page, with their titles and descriptions for the HTML head. */
export const PAGES: Record<
  string,
  { component: () => ReactNode; title: string; description: string }
> = {
  '/pricing/': {
    component: PricingPage,
    title: 'Pricing · Splitcraft',
    description: 'Splitcraft is in early access by invitation, with every feature included.',
  },
  '/request-access/': {
    component: RequestAccessPage,
    title: 'Request access · Splitcraft',
    description: 'Splitcraft is invite-only during early access. Request an invite.',
  },
  '/compare/': {
    component: ComparePage,
    title: 'Compare · Splitcraft',
    description: 'How Splitcraft compares with Optimizely, VWO, AB Tasty and GrowthBook.',
  },
  '/use-cases/': {
    component: UseCasesPage,
    title: 'Use cases · Splitcraft',
    description: 'Example A/B testing playbooks for online stores, SaaS, travel and media sites.',
  },
  '/integrations/': {
    component: IntegrationsPage,
    title: 'Integrations · Splitcraft',
    description: 'GA4, Google Tag Manager, dataLayer, Slack, webhooks, React and more.',
  },
  '/changelog/': {
    component: ChangelogPage,
    title: 'Changelog · Splitcraft',
    description: 'Every Splitcraft release, newest first.',
  },
  '/tour/': {
    component: TourPage,
    title: 'Product tour · Splitcraft',
    description: 'A walk through Splitcraft, from writing a variant to reading the result.',
  },
};
