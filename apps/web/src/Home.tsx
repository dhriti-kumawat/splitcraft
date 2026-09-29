import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Home.module.css';
import { DASHBOARD_URL, GITHUB_URL } from './links';

const NAV = [
  { href: '#product', label: 'Product' },
  { href: '#developers', label: 'Developers' },
  { href: '#stats', label: 'Statistics' },
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
];

function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="24" height="24" rx="6" fill="#0F6B57" />
      <rect x="6.5" y="7" width="5.5" height="12" rx="1.5" fill="#FFFFFF" />
      <rect x="14" y="7" width="5.5" height="12" rx="1.5" fill="#F2B37A" />
    </svg>
  );
}

/** The marketing home page (design/screens/00-home.html, PRODUCT_SPEC §9). */
export function Home() {
  return (
    <div className={styles.page}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Stack />
        <Product />
        <Developers />
        <Statistics />
        <HowItWorks />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  return (
    <header className={styles.header}>
      <div className={`${styles.wrap} ${styles.headerInner}`}>
        <div className={styles.navLeft}>
          <a href="#main" className={styles.brand} aria-label="Splitcraft home">
            <Logo size={28} />
            Splitcraft
          </a>
          <nav aria-label="Main" className={styles.nav}>
            {NAV.map((n) => (
              <a key={n.href} className={styles.navLink} href={n.href}>
                {n.label}
              </a>
            ))}
            <a className={styles.navLink} href={GITHUB_URL}>
              GitHub
            </a>
          </nav>
        </div>
        <div className={styles.navRight}>
          <a className={styles.navLink} href={`${DASHBOARD_URL}/login`}>
            Log in
          </a>
          <a className={`${styles.primary} ${styles.small}`} href={`${DASHBOARD_URL}/signup`}>
            Start free
          </a>
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>
      <nav
        id={menuId}
        aria-label="Menu"
        className={styles.mobileNav}
        data-open={open}
        hidden={!open}
      >
        {NAV.map((n) => (
          <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
            {n.label}
          </a>
        ))}
        <a href={GITHUB_URL}>GitHub</a>
        <a href={`${DASHBOARD_URL}/login`}>Log in</a>
        <a href={`${DASHBOARD_URL}/signup`}>Start free</a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`${styles.wrap} ${styles.heroInner}`}>
        <div className={`${styles.heroText} ${styles.rise}`}>
          <span className={styles.badge}>
            <span className={`${styles.chip} ${styles.new}`}>New</span>
            Custom JS trackers and click trackers
          </span>
          <h1 className={styles.h1} id="hero-title">
            Know what works before you ship it.
          </h1>
          <p className={`${styles.lede} ${styles.heroLede}`}>
            Splitcraft runs A/B tests on your live site with one small snippet. Write variants in
            code, target exactly who you mean, and get results you can defend.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href={`${DASHBOARD_URL}/signup`}>
              Start free
            </a>
            <a className={styles.secondary} href="#how">
              See how it works
            </a>
          </div>
          <span className={styles.fine}>Free up to 100,000 events a month. No card needed.</span>
        </div>
        <div className={`${styles.shotWrap} ${styles.rise} ${styles.delay}`}>
          <ProductShot />
        </div>
      </div>
    </section>
  );
}

/** Illustration of the results screen, using the spec's worked example (not customer data). */
function ProductShot() {
  return (
    <figure
      style={{ margin: 0 }}
      aria-label="The Splitcraft results screen for an example test: variant B is ahead with a 96% chance to beat Control, uplift +9.7%, 24,860 visitors."
    >
      <div className={styles.shot} aria-hidden="true">
        <div className={styles.chrome}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.url}>
            app.splitcraft.app/trip-demo/experiments/sticky-book-bar
          </span>
        </div>
        <div className={styles.app}>
          <div className={styles.side}>
            <span className={styles.sideBrand}>Splitcraft</span>
            <span className={`${styles.sideItem} ${styles.sideOn}`}>Experiments</span>
            <span className={styles.sideItem}>Audiences</span>
            <span className={styles.sideItem}>Metrics</span>
            <span className={styles.sideItem}>Install</span>
          </div>
          <div className={styles.appMain}>
            <div className={styles.appHead}>
              Sticky Book Now bar
              <span className={`${styles.chip} ${styles.live}`}>
                <span className={styles.liveDot} />
                Live · day 14
              </span>
            </div>
            <div className={styles.verdict}>
              Variant B is ahead, with a 96% chance to beat Control
            </div>
            <div className={styles.kpis}>
              {[
                ['Visitors', '24,860', ''],
                ['Uplift', '+9.7%', styles.up],
                ['Chance to win', '96%', ''],
                ['Sample ratio', '50.2 / 49.8', ''],
              ].map(([label, value, cls]) => (
                <div key={label} className={styles.kpi}>
                  <span className={styles.kpiLabel}>{label}</span>
                  <span className={`${styles.kpiValue} ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className={styles.chartCard}>
              Cumulative conversion rate
              <svg viewBox="0 0 600 190" width="100%" height="190" preserveAspectRatio="none">
                <line x1="0" y1="40" x2="600" y2="40" stroke="#EEF0EB" />
                <line x1="0" y1="95" x2="600" y2="95" stroke="#EEF0EB" />
                <line x1="0" y1="150" x2="600" y2="150" stroke="#EEF0EB" />
                <polyline
                  fill="none"
                  stroke="#355E9C"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points="0,60 46,92 92,100 138,116 184,108 230,116 276,108 322,108 368,116 414,108 460,108 506,111 552,109 600,110"
                />
                <polyline
                  fill="none"
                  stroke="#D97A2B"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points="0,130 46,40 92,64 138,56 184,72 230,64 276,80 322,72 368,72 414,80 460,72 506,75 552,74 600,74"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.floatCode} aria-hidden="true">
        <pre>
          <span className={styles.c}>// variant B</span>
          {'\n'}splitcraft.<span className={styles.f}>waitForElement</span>(
          <span className={styles.s}>'.price'</span>, (el) <span className={styles.k}>=&gt;</span>{' '}
          {'{'}
          {'\n  '}
          <span className={styles.f}>mountStickyBar</span>(el);
          {'\n  '}splitcraft.<span className={styles.f}>trackEvent</span>(
          <span className={styles.s}>'book_click'</span>);
          {'\n'}
          {'});'}
        </pre>
      </div>
      <div className={styles.floatWho} aria-hidden="true">
        <span className={`${styles.chip} ${styles.dark}`}>WHO</span>
        High-intent returners <span className={styles.sep}>·</span>
        <span className={styles.mono} style={{ fontSize: 12 }}>
          /trips/*
        </span>
        <span className={styles.sep}>·</span> mobile
      </div>
    </figure>
  );
}

function Stack() {
  // Integrations as text only (DECISIONS #14). Each works through the snippet or dataLayer.
  return (
    <section className={styles.stack} aria-labelledby="stack-title">
      <div className={`${styles.wrap} ${styles.stackInner}`}>
        <h2 className={styles.stackLabel} id="stack-title" style={{ margin: 0, fontWeight: 400 }}>
          Works with your stack
        </h2>
        <ul className={styles.stackList}>
          {['React', 'Next.js', 'Vue', 'Shopify', 'Google Tag Manager', 'GA4'].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Product() {
  return (
    <section
      id="product"
      className={`${styles.wrap} ${styles.section}`}
      aria-labelledby="product-title"
    >
      <div className={styles.sectionHead}>
        <div className={styles.stackCol}>
          <span className={styles.eyebrow}>Product</span>
          <h2 className={styles.h2} id="product-title" style={{ maxWidth: 720 }}>
            Everything a test needs, from the first line of code to the final call.
          </h2>
        </div>
        <p className={styles.lede} style={{ maxWidth: 420, fontSize: 17 }}>
          One workspace for variants, targeting and metrics, so nobody has to stitch tools together
          to trust a result.
        </p>
      </div>
      <div className={styles.cards3}>
        <article className={styles.card}>
          <div className={`${styles.art} ${styles.artDark}`} aria-hidden="true">
            <div className={styles.fileTabs}>
              <span className={styles.fileOn}>variant.js</span>
              <span className={styles.fileOff}>variant.css</span>
            </div>
            <pre>
              splitcraft.<span className={styles.f}>waitForElement</span>(
              <span className={styles.s}>'.cta'</span>,{'\n  '}(btn){' '}
              <span className={styles.k}>=&gt;</span> {'{'}
              {'\n    '}btn.textContent = <span className={styles.s}>'Reserve now'</span>;{'\n    '}
              splitcraft.
              <span className={styles.f}>onceInView</span>(btn, (){' '}
              <span className={styles.k}>=&gt;</span>
              {'\n      '}splitcraft.<span className={styles.f}>trackEvent</span>(
              <span className={styles.s}>'cta_seen'</span>));
              {'\n'}
              {'});'}
            </pre>
          </div>
          <h3 className={styles.cardTitle}>Variants in real code</h3>
          <p className={styles.cardText}>
            Write JS and CSS in a proper editor with helpers for late-loading elements, SPA routes
            and exposure tracking. Preview any variant on your live site before launch.
          </p>
        </article>
        <article className={styles.card}>
          <div className={styles.art} aria-hidden="true">
            {[
              ['WHO', 'Returning · India · mobile', false],
              ['WHERE', '/trips/* · .book-now-btn exists', true],
              ['HOW', '2+ pages · paid search', false],
              ['WHEN', 'Every page load', false],
            ].map(([k, v, mono]) => (
              <div key={k as string} className={styles.artRow}>
                <span className={`${styles.chip} ${styles.dark}`}>{k}</span>
                <span className={mono ? styles.mono : undefined}>{v}</span>
              </div>
            ))}
          </div>
          <h3 className={styles.cardTitle}>Targeting without limits</h3>
          <p className={styles.cardText}>
            Nest ALL, ANY and NONE groups of visitor, visit and page conditions, down to cookies,
            dataLayer values and your own JavaScript.
          </p>
        </article>
        <article className={styles.card}>
          <div className={styles.art} aria-hidden="true" style={{ gap: 10 }}>
            <div className={`${styles.metricRow} ${styles.metricPrimary}`}>
              Book click <span className={`${styles.chip} ${styles.live}`}>Primary</span>
            </div>
            <div className={styles.metricRow}>
              Revenue per visitor <span className={styles.mono}>sum · p99 cap</span>
            </div>
            <div className={styles.metricRow}>
              add_on_selected <span className={styles.mono}>custom JS</span>
            </div>
            <div className={`${styles.metricRow} ${styles.metricGuard}`}>
              Purchase rate <span className={styles.mono}>guardrail −2%</span>
            </div>
          </div>
          <h3 className={styles.cardTitle}>Any metric you can name</h3>
          <p className={styles.cardText}>
            Click trackers from CSS selectors, custom JS trackers with values, and guardrails that
            flag a variant when it hurts a metric you care about.
          </p>
        </article>
      </div>
    </section>
  );
}

const SNIPPETS: Array<{ id: string; label: string; code: ReactNode }> = [
  {
    id: 'html',
    label: 'index.html',
    code: (
      <>
        <span className={styles.c}>{'<!-- 1. Paste once in <head> -->'}</span>
        {'\n'}
        <span className={styles.k}>{'<script'}</span> <span className={styles.f}>src</span>=
        <span className={styles.s}>"https://splitcraft.app/sdk/v1.js"</span>
        {'\n        '}
        <span className={styles.f}>data-project</span>=<span className={styles.s}>"prj_…"</span>{' '}
        <span className={styles.k}>{'async></script>'}</span>
        {'\n'}
        <span className={styles.c}>// 2. Track anything from your own code</span>
        {'\n'}splitcraft.<span className={styles.f}>trackEvent</span>(
        <span className={styles.s}>'purchase'</span>, {'{'}
        {'\n  '}value: <span className={styles.f}>142000</span>,{'\n  '}currency:{' '}
        <span className={styles.s}>'INR'</span>
        {'\n'}
        {'});'}
        {'\n'}
        <span className={styles.c}>// 3. React to SPA navigation in variant code</span>
        {'\n'}splitcraft.<span className={styles.f}>onRouteChange</span>((url){' '}
        <span className={styles.k}>=&gt;</span> <span className={styles.f}>refreshBadges</span>
        (url));
      </>
    ),
  },
  {
    id: 'next',
    label: 'app/layout.tsx',
    code: (
      <>
        <span className={styles.k}>import</span> Script <span className={styles.k}>from</span>{' '}
        <span className={styles.s}>'next/script'</span>;{'\n\n'}
        <span className={styles.k}>{'<Script'}</span>
        {'\n  '}
        <span className={styles.f}>src</span>=
        <span className={styles.s}>"https://splitcraft.app/sdk/v1.js"</span>
        {'\n  '}
        <span className={styles.f}>data-project</span>=<span className={styles.s}>"prj_…"</span>
        {'\n  '}
        <span className={styles.f}>strategy</span>=
        <span className={styles.s}>"beforeInteractive"</span>
        {'\n'}
        <span className={styles.k}>{'/>'}</span>
      </>
    ),
  },
  {
    id: 'gtm',
    label: 'GTM',
    code: (
      <>
        <span className={styles.c}>{'<!-- Tags › New › Custom HTML, trigger: All Pages -->'}</span>
        {'\n'}
        <span className={styles.k}>{'<script'}</span> <span className={styles.f}>src</span>=
        <span className={styles.s}>"https://splitcraft.app/sdk/v1.js"</span>
        {'\n        '}
        <span className={styles.f}>data-project</span>=<span className={styles.s}>"prj_…"</span>{' '}
        <span className={styles.k}>{'async></script>'}</span>
        {'\n'}
        <span className={styles.c}>
          {'<!-- Exposures and events also land in window.dataLayer for GA4. -->'}
        </span>
      </>
    ),
  },
];

function Developers() {
  const [tab, setTab] = useState(SNIPPETS[0]!.id);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + SNIPPETS.length) % SNIPPETS.length;
    setTab(SNIPPETS[next]!.id);
    refs.current[next]?.focus();
  };
  const current = SNIPPETS.find((s) => s.id === tab)!;
  return (
    <section id="developers" className={styles.devSection} aria-labelledby="dev-title">
      <div className={`${styles.wrap} ${styles.section} ${styles.devInner}`}>
        <div className={styles.devText}>
          <span className={`${styles.eyebrow} ${styles.highlightEyebrow}`}>For developers</span>
          <h2 className={`${styles.h2} ${styles.onDark}`} id="dev-title">
            Built for the person who writes the variant.
          </h2>
          <p className={`${styles.lede} ${styles.onDarkMuted}`}>
            Splitcraft is a TypeScript SDK first and a dashboard second. It loads async and keeps
            its work small.
          </p>
          <ul className={styles.checks}>
            <li>
              <span className={styles.tick} aria-hidden="true">
                ✓
              </span>
              <span>
                <b>Under 7 KB gzipped</b>, loaded async, no dependencies
              </span>
            </li>
            <li>
              <span className={styles.tick} aria-hidden="true">
                ✓
              </span>
              <span>
                <b>Anti-flicker</b> capped at 400 ms, then the page shows anyway
              </span>
            </li>
            <li>
              <span className={styles.tick} aria-hidden="true">
                ✓
              </span>
              <span>
                <b>SPA-aware</b>: re-targets and re-applies on every route change
              </span>
            </li>
            <li>
              <span className={styles.tick} aria-hidden="true">
                ✓
              </span>
              <span>
                <b>Deterministic bucketing</b>: same visitor, same variant, every visit
              </span>
            </li>
            <li>
              <span className={styles.tick} aria-hidden="true">
                ✓
              </span>
              <span>
                <b>QA mode</b>: force any variant with{' '}
                <span className={styles.inlineCode}>?splitcraft_force=</span>
              </span>
            </li>
          </ul>
          <a className={`${styles.secondary} ${styles.ghost}`} href={GITHUB_URL}>
            Read the code on GitHub
          </a>
        </div>
        <div className={styles.code}>
          <div className={styles.codeTabs} role="tablist" aria-label="Install examples">
            {SNIPPETS.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-${s.id}`}
                aria-selected={tab === s.id}
                aria-controls={`${baseId}-panel`}
                tabIndex={tab === s.id ? 0 : -1}
                className={styles.codeTab}
                onClick={() => setTab(s.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <pre
            role="tabpanel"
            id={`${baseId}-panel`}
            aria-labelledby={`${baseId}-${tab}`}
            tabIndex={0}
          >
            {current.code}
          </pre>
        </div>
      </div>
    </section>
  );
}

function Statistics() {
  const points = [
    [
      'Sample ratio check',
      'Flags broken splits from redirects, bots or caching before you trust the numbers.',
    ],
    [
      'Planned sample size',
      'Every test gets a target from your baseline and smallest lift, so nobody calls it on day three.',
    ],
    [
      'Guardrails',
      'Pick metrics that must not get worse. Results flag a variant that crosses its limit with 95% confidence.',
    ],
    [
      'Honest uplift ranges',
      'You see the full range, not just a headline number, with outliers capped at the 99th percentile.',
    ],
  ];
  return (
    <section
      id="stats"
      className={`${styles.wrap} ${styles.section}`}
      aria-labelledby="stats-title"
    >
      <div className={styles.stackCol} style={{ maxWidth: 760, marginBottom: 56 }}>
        <span className={styles.eyebrow}>Statistics</span>
        <h2 className={styles.h2} id="stats-title">
          Results you can defend in any review.
        </h2>
        <p className={styles.lede}>
          Splitcraft checks the things that quietly break experiments, and tells you in plain words
          when a result is not ready.
        </p>
      </div>
      <ol className={styles.stats}>
        {points.map(([title, text], i) => (
          <li key={title} className={styles.stat}>
            <span className={styles.statNum} aria-hidden="true">
              0{i + 1}
            </span>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardText}>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    [
      'Install the snippet',
      'Paste one script tag or add it through GTM. Splitcraft confirms the install on the first page view.',
    ],
    [
      'Build and QA the variant',
      'Write the change, set who sees it, pick a goal, then force it on your own screen to check it.',
    ],
    [
      'Launch and read the result',
      'Watch it reach its planned sample, then ship the winner or learn from the loss.',
    ],
  ];
  return (
    <section
      id="how"
      className={`${styles.wrap} ${styles.section} ${styles.how}`}
      aria-labelledby="how-title"
    >
      <div className={styles.stackCol} style={{ marginBottom: 48 }}>
        <span className={styles.eyebrow}>How it works</span>
        <h2 className={styles.h2} id="how-title">
          Live in an afternoon.
        </h2>
      </div>
      <ol className={styles.cards3} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {steps.map(([title, text], i) => (
          <li key={title} className={`${styles.card} ${styles.soft}`}>
            <span
              className={`${styles.stepNum} ${i === 2 ? styles.stepLast : ''}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardText}>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Cta() {
  return (
    <section id="pricing" className={styles.wrap} aria-labelledby="cta-title">
      <div className={styles.cta}>
        <div className={styles.stackCol} style={{ maxWidth: 640 }}>
          <h2 className={`${styles.h2} ${styles.ctaTitle}`} id="cta-title">
            Run your first test today.
          </h2>
          <p className={`${styles.lede} ${styles.ctaText}`}>
            Free up to 100,000 events a month. No card needed.
          </p>
        </div>
        <div className={styles.ctaActions}>
          <a className={`${styles.primary} ${styles.ctaPrimary}`} href={`${DASHBOARD_URL}/signup`}>
            Start free
          </a>
          <a className={`${styles.secondary} ${styles.ctaSecondary}`} href={GITHUB_URL}>
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    {
      title: 'Product',
      links: [
        ['Experiments', '#product'],
        ['Targeting', '#product'],
        ['Metrics', '#product'],
        ['Statistics', '#stats'],
      ],
    },
    {
      title: 'Developers',
      links: [
        ['SDK', '#developers'],
        ['Source on GitHub', GITHUB_URL],
        ['How it works', '#how'],
      ],
    },
    {
      title: 'Get started',
      links: [
        ['Start free', `${DASHBOARD_URL}/signup`],
        ['Log in', `${DASHBOARD_URL}/login`],
      ],
    },
  ];
  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerInner}`}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <span className={styles.brand}>
              <Logo />
              Splitcraft
            </span>
            <span>A/B testing for teams who write their own variants.</span>
            <span>
              A portfolio project by Dhriti Kumawat, built to understand how experimentation
              platforms work inside.
            </span>
          </div>
          <nav className={styles.footerCols} aria-label="Footer">
            {cols.map((c) => (
              <div key={c.title} className={styles.footerCol}>
                <h2 className={styles.footerHead}>{c.title}</h2>
                <ul>
                  {c.links.map(([label, href]) => (
                    <li key={label}>
                      <a className={styles.footerLink} href={href}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Splitcraft</span>
          <span>Example numbers on this page come from a demo test, not a customer.</span>
        </div>
      </div>
    </footer>
  );
}
