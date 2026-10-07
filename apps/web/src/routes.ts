import type { ReactNode } from 'react';
import {
  ChangelogPage,
  ComparePage,
  IntegrationsPage,
  PricingPage,
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
    description: 'Splitcraft is free with every feature: 100,000 events a month, no card needed.',
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
