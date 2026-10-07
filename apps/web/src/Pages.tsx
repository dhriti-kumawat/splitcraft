import type { ReactNode } from 'react';
import home from './Home.module.css';
import { Footer, Header } from './Home';
import { DASHBOARD_URL } from './links';
import styles from './Pages.module.css';

/** A marketing page below the home page: the site header and footer around its content. */
function PageShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className={home.page}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Header home={false} />
      <main id="main">
        <section className={`${home.wrap} ${styles.intro}`} aria-labelledby="page-title">
          <span className={home.eyebrow}>{eyebrow}</span>
          <h1 className={styles.title} id="page-title">
            {title}
          </h1>
          <p className={`${home.lede} ${styles.lede}`}>{lede}</p>
        </section>
        <div className={`${home.wrap} ${styles.body}`}>{children}</div>
        <section className={`${home.wrap} ${styles.cta}`} aria-labelledby="cta-title">
          <h2 className={styles.ctaTitle} id="cta-title">
            Run your first test today.
          </h2>
          <div className={styles.ctaRow}>
            <a className={home.primary} href={`${DASHBOARD_URL}/signup`}>
              Start free
            </a>
            <a className={home.secondary} href="/docs/">
              Read the docs
            </a>
          </div>
        </section>
      </main>
      <Footer home={false} />
    </div>
  );
}

const Check = ({ on }: { on: boolean | 'part' }) => (
  <span className={on === true ? styles.yes : on === 'part' ? styles.part : styles.no}>
    {on === true ? 'Yes' : on === 'part' ? 'Partly' : 'No'}
  </span>
);

// ------------------------------------------------------------------ pricing

export function PricingPage() {
  const included = [
    '100,000 events a month per workspace',
    'Unlimited projects and experiments',
    'A/B, split URL, multivariate tests and personalization',
    'Visual editor and code editor, preview on any page',
    'Targeting, reach estimates, exclusion groups',
    'Feature flags with gradual rollout',
    'Guardrails that pause a losing test, Slack and webhook alerts',
    'Results with uplift ranges, chance to win and sample ratio checks',
  ];
  const faq: Array<[string, string]> = [
    [
      'What counts as an event?',
      'Each exposure (a visitor seeing a variant) and each goal the snippet sends: a click, a page view, a custom event or a purchase.',
    ],
    [
      'What happens at 100,000 events?',
      'Experiments stop being served for the rest of the month, so visitors see your original site. Nothing breaks, and the count resets on the first of the month. The dashboard shows how close you are.',
    ],
    ['Do I need a card?', 'No. Sign up with GitHub or email and start testing.'],
    [
      'Are there paid plans?',
      'Not yet. Splitcraft is a portfolio project, so there is one free plan with every feature. Higher-volume plans aren’t available.',
    ],
  ];
  return (
    <PageShell
      eyebrow="Pricing"
      title="Free, with every feature."
      lede="One plan with no card and no feature gates. When a workspace uses its monthly events, tests pause and visitors see your original site until the month resets."
    >
      <div className={styles.pricing}>
        <div className={home.priceCard}>
          <div className={home.priceHead}>
            <span className={home.priceName}>Free</span>
            <span className={home.price}>
              $0 <small>/ month</small>
            </span>
          </div>
          <ul className={home.priceList}>
            {included.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <a className={home.primary} href={`${DASHBOARD_URL}/signup`}>
            Start free
          </a>
        </div>
        <div>
          <h2 className={styles.h2}>Questions about the plan</h2>
          <dl className={styles.faq}>
            {faq.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </PageShell>
  );
}

// ------------------------------------------------------------------ compare

export function ComparePage() {
  const rows: Array<[string, boolean | 'part', string]> = [
    ['A/B, split URL and multivariate tests', true, 'All three, from one workspace'],
    ['Visual editor', true, 'Point and click on your live page, code comes back for review'],
    ['Code editor for JS and CSS', true, 'Monaco editor with helpers for late content and SPAs'],
    ['Targeting', true, 'Who / Where / How / When, nested ALL / ANY / NONE groups'],
    ['Activation (element, JS condition, manual)', true, 'Like page activation in Optimizely'],
    ['Personalization', true, 'Show a change to a segment, no comparison'],
    ['Feature flags with gradual rollout', true, 'splitcraft.isEnabled(key) in the browser'],
    ['Mutual exclusion groups', true, 'Tests in a group never share a visitor'],
    ['Statistics', true, 'Z-test and Bayesian chance to win, uplift range, sample ratio check'],
    ['Guardrails that pause a test', true, 'Checked every 15 minutes'],
    ['Server-side SDKs (Node, Python, Java…)', false, 'Browser and React only'],
    ['Native mobile SDKs', false, 'Web only'],
    ['Heatmaps and session recordings', false, 'Use a dedicated tool alongside'],
    ['Warehouse-native metrics', false, 'Events live in Splitcraft’s own database'],
    ['Sequential testing or CUPED', false, 'Fixed-horizon tests with a sample size planner'],
  ];
  return (
    <PageShell
      eyebrow="Compare"
      title="How Splitcraft compares."
      lede="Splitcraft covers what most teams use day to day in Optimizely, VWO or AB Tasty, for free. Here is what it does, and where those tools still go further."
    >
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">Splitcraft capabilities</caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Splitcraft</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, on, note]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>
                  <Check on={on} />
                </td>
                <td>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.grid2}>
        <div className={styles.panel}>
          <h2 className={styles.h3}>Where the big suites go further</h2>
          <ul className={styles.list}>
            <li>
              <b>Optimizely</b> has server-side and mobile SDKs, a sequential stats engine and
              enterprise governance.
            </li>
            <li>
              <b>VWO</b> pairs testing with heatmaps, session recordings and surveys.
            </li>
            <li>
              <b>AB Tasty</b> adds AI-driven personalization and recommendations.
            </li>
            <li>
              <b>GrowthBook</b> is open source and reads metrics straight from your data warehouse.
            </li>
          </ul>
        </div>
        <div className={styles.panel}>
          <h2 className={styles.h3}>Why teams pick Splitcraft</h2>
          <ul className={styles.list}>
            <li>Free, with every feature: no sales call, no seat limits.</li>
            <li>A main snippet under 8.5 KB gzipped, with at most 400 ms of anti-flicker.</li>
            <li>Built for the person who writes the variant: real code, real previews.</li>
            <li>Results that show their uncertainty, so a call holds up in review.</li>
          </ul>
        </div>
      </div>
      <p className={styles.note}>
        Other products change often. This page reflects their public sites as of October 2026; check
        them for the latest. Product names belong to their owners.
      </p>
    </PageShell>
  );
}

// ------------------------------------------------------------------ use cases

export function UseCasesPage() {
  const cases: Array<{ title: string; goal: string; tests: string[]; uses: string }> = [
    {
      title: 'Online store',
      goal: 'More orders and higher order value',
      tests: [
        'A sticky Add to cart bar on product pages for mobile visitors',
        'Delivery dates and returns shown next to the price',
        'One-page checkout against the current steps (split URL test)',
      ],
      uses: 'Transaction goal from the dataLayer, revenue per visitor, a purchase-rate guardrail',
    },
    {
      title: 'SaaS sign-up',
      goal: 'More trials that turn into active accounts',
      tests: [
        'A shorter sign-up form with GitHub first',
        'Pricing page with the annual price shown first',
        'A new onboarding checklist behind a feature flag, rolled out to 10% first',
      ],
      uses: 'Custom events with splitcraft.trackEvent, feature flags, personalization for returning visitors',
    },
    {
      title: 'Travel and bookings',
      goal: 'More searches and bookings',
      tests: [
        'Trust badges and free cancellation under the Book button',
        'Search box above the fold on mobile',
        'Urgency message ("3 spots left") against no message',
      ],
      uses: 'Click goals from CSS selectors, country and device targeting, activation when the results load',
    },
    {
      title: 'Content and media',
      goal: 'More engaged readers and newsletter sign-ups',
      tests: [
        'Headline variants on article pages',
        'Newsletter box after the second paragraph against the end of the article',
        'Related articles with images against text links',
      ],
      uses: 'Browsing goals (engaged visitors, pages per visitor), multivariate tests for headline and image',
    },
  ];
  return (
    <PageShell
      eyebrow="Use cases"
      title="What teams test with Splitcraft."
      lede="Example playbooks for common sites: the goal, a few first tests, and the Splitcraft features that make them work. Use them as a starting point for your own ideas."
    >
      <div className={styles.grid2}>
        {cases.map((c) => (
          <article key={c.title} className={styles.panel}>
            <h2 className={styles.h3}>{c.title}</h2>
            <p className={styles.goal}>
              <b>Goal:</b> {c.goal}
            </p>
            <ol className={styles.list}>
              {c.tests.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <p className={styles.uses}>
              <b>Uses:</b> {c.uses}
            </p>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        These are example playbooks, not customer stories. The Experiments page can also scan your
        site and suggest tests to start from.
      </p>
    </PageShell>
  );
}

// ------------------------------------------------------------------ integrations

export function IntegrationsPage() {
  const items: Array<{ name: string; kind: string; text: string; docs: string }> = [
    {
      name: 'Google Analytics 4',
      kind: 'Analytics',
      text: 'Every exposure and goal is pushed to the dataLayer as splitcraft_event, so GA4 can segment by experiment and variant. One switch turns it off per project.',
      docs: '/docs/sdk/',
    },
    {
      name: 'Google Tag Manager',
      kind: 'Install',
      text: 'Install the snippet as a Custom HTML tag, and use any dataLayer event your site or GTM pushes as a goal.',
      docs: '/docs/install/',
    },
    {
      name: 'dataLayer and e-commerce events',
      kind: 'Goals',
      text: 'Count purchases, revenue and order value from the standard purchase event, or any dataLayer event with filters.',
      docs: '/docs/metrics/',
    },
    {
      name: 'Slack',
      kind: 'Alerts',
      text: 'An incoming webhook gets a message when a test has a clear winner, reaches its planned sample, or is paused by a guardrail.',
      docs: '/docs/dashboard/',
    },
    {
      name: 'Webhooks',
      kind: 'Alerts',
      text: 'The same alerts as JSON to any HTTPS endpoint, for your own tools.',
      docs: '/docs/dashboard/',
    },
    {
      name: 'React and Next.js',
      kind: 'SDK',
      text: 'Install from npm, branch in components with useExperiment, and read flags with isEnabled.',
      docs: '/docs/install/',
    },
    {
      name: 'Single-page apps',
      kind: 'SDK',
      text: 'Route changes in React, Vue, Angular or any History API app re-check targeting automatically.',
      docs: '/docs/sdk/',
    },
    {
      name: 'Chrome, Edge, Brave and Arc',
      kind: 'Preview',
      text: 'The Splitcraft Preview extension shows a variant on any page, with the visual editor, before the snippet is installed.',
      docs: '/docs/experiments/',
    },
    {
      name: 'Claude',
      kind: 'AI',
      text: 'Optional: with an Anthropic API key, experiment ideas from a scan of your site are written by Claude.',
      docs: '/docs/backend/',
    },
  ];
  return (
    <PageShell
      eyebrow="Integrations"
      title="Works with the tools you already use."
      lede="Splitcraft sends its events where your analytics already live, alerts the channels your team reads, and installs the way your site is built."
    >
      <ul className={styles.cards}>
        {items.map((i) => (
          <li key={i.name} className={styles.panel}>
            <span className={styles.kind}>{i.kind}</span>
            <h2 className={styles.h3}>{i.name}</h2>
            <p>{i.text}</p>
            <a className={styles.more} href={i.docs}>
              How it works →
            </a>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

// ------------------------------------------------------------------ changelog

const RELEASES: Array<{ date: string; title: string; items: string[] }> = [
  {
    date: '2026-10-08',
    title: 'Full visual editor',
    items: [
      'Select precisely with parent, child and sibling steps, a breadcrumb and an editable selector; Interactive mode to open menus first',
      'Edit text and HTML, 14 style properties, images and links; move, insert, hide or remove elements',
      'Undo, redo and a change list; the code comes back to the dashboard for review',
    ],
  },
  {
    date: '2026-10-07',
    title: 'Activation, new sign-in and navigation',
    items: [
      'Activation modes: when an element appears, when a JS condition is true, or manually with splitcraft.activate',
      'Redesigned log in and sign up',
      'Edit visually from each variation, a Back button on detail pages, clearer breadcrumbs',
      'Roomier developer docs',
    ],
  },
  {
    date: '2026-10-02',
    title: 'Flags, personalization and alerts',
    items: [
      'Feature flags with gradual rollout and segments',
      'Personalization as a test type',
      'Mutual exclusion groups',
      'Slack and webhook alerts',
      'First visual editor, experiment ideas from a scan of your site, easier goals',
    ],
  },
  {
    date: '2026-09-30',
    title: 'Test types and preview anywhere',
    items: [
      'Split URL and multivariate tests',
      'The Splitcraft Preview extension and preview bookmark',
      'Variant template gallery, results by device and traffic source',
      'New home page with a contact form',
    ],
  },
  {
    date: '2026-09-29',
    title: 'Metrics and targeting',
    items: [
      'dataLayer, transaction, browsing and Web Vitals goals',
      'Automatic guardrail pauses, reach estimates, country targeting',
      'npm package with a React hook, magic link sign-in',
      'Developer documentation',
    ],
  },
];

export function ChangelogPage() {
  return (
    <PageShell
      eyebrow="Changelog"
      title="What’s new in Splitcraft."
      lede="Every release, newest first. Developer details for each change are in the docs."
    >
      <ol className={styles.timeline}>
        {RELEASES.map((r) => (
          <li key={r.date}>
            <time className={styles.date} dateTime={r.date}>
              {new Date(`${r.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            <div className={styles.panel}>
              <h2 className={styles.h3}>{r.title}</h2>
              <ul className={styles.list}>
                {r.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}

// ------------------------------------------------------------------ tour

const STEPS: Array<{ title: string; text: string; image: string; alt: string }> = [
  {
    title: 'See every test at a glance',
    text: 'Status, split, visitors, uplift and chance to win for every experiment in a project, plus what is ready to call.',
    image: '/shots/experiments.jpg',
    alt: 'The Experiments list with five tests and their results',
  },
  {
    title: 'Write the variant, or point and click',
    text: 'JS and CSS with helpers for late content and SPAs, templates to start from, and Edit visually to change the live page directly.',
    image: '/shots/variants.jpg',
    alt: 'The variant code editor with a sticky booking bar',
  },
  {
    title: 'Target exactly who you mean',
    text: 'Segments, pages, visit triggers and frequency, with a live reach estimate and a URL tester.',
    image: '/shots/targeting.jpg',
    alt: 'The targeting step with segments, page rules and triggers',
  },
  {
    title: 'Choose what counts as a win',
    text: 'A primary goal, secondary goals and guardrails, from ready-made metrics or your own events.',
    image: '/shots/goals.jpg',
    alt: 'The goals step with a primary goal and guardrails',
  },
  {
    title: 'Read a result you can defend',
    text: 'Uplift with its 95% range, Bayesian chance to win, a sample ratio check and how long is left.',
    image: '/shots/results.jpg',
    alt: 'The results page showing variant B ahead with a 96% chance to win',
  },
];

export function TourPage() {
  return (
    <PageShell
      eyebrow="Product tour"
      title="From idea to result, in five steps."
      lede="A walk through the dashboard with example data. Every screen here is the real product."
    >
      <ol className={styles.tour}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <div className={styles.stepText}>
              <span className={styles.stepNo}>{String(i + 1).padStart(2, '0')}</span>
              <h2 className={styles.h3}>{s.title}</h2>
              <p>{s.text}</p>
            </div>
            <figure className={styles.shot}>
              <div className={styles.chrome} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <img src={s.image} alt={s.alt} width={1440} height={900} loading="lazy" />
            </figure>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        Want to click around yourself? Sign up and choose “Try with demo data” on the first screen.
      </p>
    </PageShell>
  );
}
