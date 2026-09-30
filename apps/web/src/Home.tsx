import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Home.module.css';
import { DASHBOARD_URL, GITHUB_URL } from './links';

const NAV = [
  { href: '#why', label: 'Why CRO' },
  { href: '#product', label: 'Product' },
  { href: '#developers', label: 'Developers' },
  { href: '#stats', label: 'Statistics' },
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/docs/', label: 'Docs' },
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
        <WhyCro />
        <Product />
        <Capabilities />
        <Developers />
        <Statistics />
        <HowItWorks />
        <Pricing />
        <Faq />
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
            Reach estimates and automatic guardrail pauses
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
          <ul className={styles.trust} aria-label="At a glance">
            <li>
              <b>&lt; 8 KB</b> snippet
            </li>
            <li>
              <b>400 ms</b> max anti-flicker
            </li>
            <li>
              <b>95%</b> uplift ranges
            </li>
          </ul>
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
            splitcraft-app.vercel.app/trip-demo/experiments/sticky-book-bar
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

/**
 * Why conversion rate optimization matters, and why it should be decided by data. The
 * calculator only does arithmetic on the visitor's own numbers: no invented statistics
 * (decision #14).
 */
function WhyCro() {
  // [icon path, title, text]
  const points: Array<[string, string, string]> = [
    [
      'M10 2.5v15M13.5 5.5H8.3a2.3 2.3 0 000 4.6h3.4a2.3 2.3 0 010 4.6H6',
      'Traffic is expensive. Conversions are yours to improve.',
      'Ads, SEO and email all bring people to the site. Conversion rate optimization (CRO) makes more of them buy, sign up or book, and it lifts every channel at once.',
    ],
    [
      'M7 9a3 3 0 100-6 3 3 0 000 6zM2 17c0-2.8 2.2-5 5-5s5 2.2 5 5M14 8.5a2.5 2.5 0 100-5M15 12c1.9.5 3 2.3 3 4.5',
      'Opinions disagree. Visitors decide.',
      'A redesign that everyone in the room likes can still lose sales. An A/B test shows what real visitors do, so the loudest idea doesn’t win by default.',
    ],
    [
      'M3 14l4.5-4.5 3 3L17 6M12.5 6H17v4.5',
      'Small wins add up.',
      'A few percent on the product page, the cart and the sign-up form multiply along the funnel, and they keep paying every month after you ship them.',
    ],
    [
      'M10 2.5l6 2.2v4.6c0 3.9-2.6 6.9-6 8.2-3.4-1.3-6-4.3-6-8.2V4.7l6-2.2zM7.5 7.5l5 5M12.5 7.5l-5 5',
      'Knowing what not to ship is a win too.',
      'Many good-looking ideas change nothing or make things worse. Testing catches them on a slice of traffic, before they reach everyone.',
    ],
  ];
  return (
    <section id="why" className={`${styles.wrap} ${styles.section}`} aria-labelledby="why-title">
      <div className={styles.whyGrid}>
        <div className={styles.stackCol}>
          <span className={styles.eyebrow}>Why conversion rate optimization</span>
          <h2 className={styles.h2} id="why-title">
            More customers from the visitors you already have.
          </h2>
          <p className={styles.lede}>
            Your conversion rate is the share of visitors who do what the page is for: buy, sign up,
            book, get in touch. Every site has one, and nearly every site can raise it. The sites
            that do it well stop guessing and let data decide.
          </p>
          <ul className={styles.whyList}>
            {points.map(([icon, title, text]) => (
              <li key={title} className={styles.whyItem}>
                <span className={styles.whyIcon} aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={icon} />
                  </svg>
                </span>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardText}>{text}</p>
              </li>
            ))}
          </ul>
          <p className={styles.whyClose}>
            Splitcraft exists to make that routine for any website: add one snippet, change the page
            in code, and get results with the statistics checks built in.{' '}
            <a href="#how" className={styles.textLink}>
              See how it works
            </a>
          </p>
        </div>
        <ConversionMath />
      </div>
    </section>
  );
}

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "Try your numbers": what a relative lift in conversion rate is worth, as plain arithmetic. */
function ConversionMath() {
  const [visitors, setVisitors] = useState('20000');
  const [rate, setRate] = useState('2');
  const [lift, setLift] = useState('10');
  const id = useId();
  const v = Math.max(0, Number(visitors) || 0);
  const r = Math.min(100, Math.max(0, Number(rate) || 0));
  const l = Math.max(0, Number(lift) || 0);
  const now = (v * r) / 100;
  const next = now * (1 + l / 100);
  const extra = next - now;
  const newRate = Math.min(100, r * (1 + l / 100));

  const field = (
    key: string,
    label: string,
    value: string,
    set: (v: string) => void,
    unit: string,
  ) => (
    <div className={styles.mathField}>
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <span className={styles.mathInputWrap}>
        <input
          id={`${id}-${key}`}
          className={styles.mathInput}
          inputMode="decimal"
          value={value}
          onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        {unit && (
          <span className={styles.mathUnit} aria-hidden="true">
            {unit}
          </span>
        )}
      </span>
    </div>
  );

  return (
    <section className={styles.mathCard} aria-labelledby={`${id}-title`}>
      <h3 className={styles.mathTitle} id={`${id}-title`}>
        Try your numbers
      </h3>
      <div className={styles.mathFields}>
        {field('visitors', 'Visitors a month', visitors, setVisitors, '')}
        <div className={styles.mathPair}>
          {field('rate', 'Conversion rate', rate, setRate, '%')}
          {field('lift', 'Improvement', lift, setLift, '%')}
        </div>
      </div>
      <dl className={styles.mathResults} aria-live="polite">
        <div>
          <dt>Conversions a month</dt>
          <dd>
            {whole.format(now)} → <b>{whole.format(next)}</b>
          </dd>
        </div>
        <div>
          <dt>Extra conversions a year</dt>
          <dd>
            <b>+{whole.format(extra * 12)}</b>
          </dd>
        </div>
        <div>
          <dt>Or buy this many more visitors a month</dt>
          <dd>
            <b>+{whole.format((v * l) / 100)}</b>
          </dd>
        </div>
      </dl>
      <p className={styles.mathNote}>
        A {whole.format(l)}% improvement takes a {r}% conversion rate to{' '}
        {newRate.toFixed(2).replace(/\.?0+$/, '')}%. Multiply the extra conversions by your average
        order value to see the revenue. Arithmetic on your numbers, not a promise: tests find out
        which changes really help.
      </p>
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
        <span className={styles.s}>"https://splitcraft.vercel.app/sdk/v1.js"</span>
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
        <span className={styles.s}>"https://splitcraft.vercel.app/sdk/v1.js"</span>
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
        <span className={styles.s}>"https://splitcraft.vercel.app/sdk/v1.js"</span>
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

/** Icons for the capabilities grid: decorative, paired with visible titles. */
const ICONS: Record<string, string> = {
  guard: 'M10 2.5l6 2.2v4.6c0 3.9-2.6 6.9-6 8.2-3.4-1.3-6-4.3-6-8.2V4.7l6-2.2zM7 10l2 2 4-4',
  reach: 'M3 16.5h14M5 14V9M9 14V5M13 14v-3M17 14V7',
  qa: 'M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5zM10 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z',
  vitals: 'M2.5 10.5h3.2l2-4.5 3.2 9 2.1-4.5h4.5',
  audience:
    'M7 9a3 3 0 100-6 3 3 0 000 6zM1.8 16.5c.6-2.8 2.7-4.5 5.2-4.5s4.6 1.7 5.2 4.5M13.5 8.5a2.4 2.4 0 100-4.8M14.8 11.8c1.9.4 3.1 1.9 3.5 4',
  team: 'M4 4.5h12v8H8.5L5 15.5v-3H4zM7.5 8.5h5',
  react:
    'M10 11.3a1.3 1.3 0 100-2.6 1.3 1.3 0 000 2.6zM10 14.5c4.4 0 8-2 8-4.5s-3.6-4.5-8-4.5-8 2-8 4.5 3.6 4.5 8 4.5z',
  search: 'M9 14.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM13 13l4 4',
};

function Capabilities() {
  const items: Array<[keyof typeof ICONS, string, string]> = [
    [
      'guard',
      'Guardrails that act',
      'A variant that hurts purchases or Core Web Vitals is paused automatically.',
    ],
    [
      'reach',
      'Reach before launch',
      'See how many visitors your targeting matches, per rule group, and how long the test will take.',
    ],
    [
      'qa',
      'Preview on any page',
      'Force a variant on your own screen with a QA panel, even before the snippet is on that page.',
    ],
    [
      'vitals',
      'Web Vitals per variant',
      'LCP, INP and CLS measured in the browser, without adding weight for everyone else.',
    ],
    [
      'audience',
      'Reusable audiences',
      'Save segments, triggers and page sets once and use them in every test.',
    ],
    [
      'team',
      'Built for teams',
      'Workspaces with owners, admins and members, invite links, and an activity feed.',
    ],
    [
      'react',
      'React and npm',
      'Install with a script tag or npm, and branch in components with useExperiment.',
    ],
    [
      'search',
      'Fast to work in',
      'Command palette, duplicate and archive, and a dashboard that works on your phone.',
    ],
  ];
  return (
    <section
      id="features"
      className={`${styles.wrap} ${styles.section} ${styles.capabilities}`}
      aria-labelledby="cap-title"
    >
      <div className={`${styles.stackCol} ${styles.intro}`} style={{ maxWidth: 720 }}>
        <span className={styles.eyebrow}>And everything around it</span>
        <h2 className={styles.h2} id="cap-title">
          The details that make testing safe.
        </h2>
      </div>
      <ul className={styles.capGrid}>
        {items.map(([icon, title, text]) => (
          <li key={title} className={styles.cap}>
            <span className={styles.capIcon} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={ICONS[icon]} />
              </svg>
            </span>
            <h3 className={styles.capTitle}>{title}</h3>
            <p className={styles.capText}>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pricing() {
  const included = [
    '100,000 events a month',
    'Unlimited projects and experiments',
    'Every targeting rule and metric',
    'Guardrails, reach estimates, QA mode',
    'Team roles and invite links',
  ];
  return (
    <section
      id="pricing"
      className={`${styles.wrap} ${styles.section}`}
      aria-labelledby="price-title"
    >
      <div className={styles.pricing}>
        <div className={styles.stackCol}>
          <span className={styles.eyebrow}>Pricing</span>
          <h2 className={styles.h2} id="price-title">
            Free while you find what works.
          </h2>
          <p className={styles.lede}>
            One plan, no card, every feature. When a workspace reaches its monthly events,
            experiments pause and visitors see your original site until the month resets.
          </p>
        </div>
        <div className={styles.priceCard}>
          <div className={styles.priceHead}>
            <span className={styles.priceName}>Free</span>
            <span className={styles.price}>
              $0 <small>/ month</small>
            </span>
          </div>
          <ul className={styles.priceList}>
            {included.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <a className={styles.primary} href={`${DASHBOARD_URL}/signup`}>
            Start free
          </a>
          <span className={styles.fine}>Higher-volume plans aren&apos;t available yet.</span>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs: Array<[string, string]> = [
    [
      'Will it slow my site down?',
      'The snippet is under 8 KB compressed and loads async. Anti-flicker hides the page for at most 400 ms while variants apply, and you can turn it off per project.',
    ],
    [
      'Does it work with React, Next.js and single-page apps?',
      'Yes. Splitcraft re-checks targeting on every route change, and the npm package has a useExperiment hook for branching in components.',
    ],
    [
      'Do I need to write code?',
      'Variants are written in JavaScript and CSS, with helpers like waitForElement and templates. Splitcraft is for teams comfortable with code, not a visual editor.',
    ],
    [
      'How do I know a result is real?',
      'Every result shows its 95% range, a chance to win, a sample ratio check and how close it is to its planned sample, and says in plain words when it is not ready.',
    ],
    [
      'What data does it collect?',
      'A random visitor id, the pages and goals your experiments use, and per-session traits like device, traffic source and country. No names, emails or form contents, unless your own tracking code sends them.',
    ],
    [
      'Can I read how it works?',
      'Yes. The developer docs cover install, the SDK, targeting, metrics and the statistics, and the code is on GitHub.',
    ],
  ];
  return (
    <section
      id="faq"
      className={`${styles.wrap} ${styles.section} ${styles.faqSection}`}
      aria-labelledby="faq-title"
    >
      <div className={styles.faqLayout}>
        <div className={styles.faqSide}>
          <div className={styles.stackCol}>
            <span className={styles.eyebrow}>Questions</span>
            <h2 className={styles.h2} id="faq-title">
              Before you install.
            </h2>
            <p className={styles.lede}>Short answers to what people ask first.</p>
          </div>
          <div className={styles.faqHelp}>
            <h3 className={styles.faqHelpTitle}>Still deciding?</h3>
            <ul>
              <li>
                <a href="/docs/">
                  <span>Browse the documentation</span>
                  <span aria-hidden="true">→</span>
                </a>
              </li>
              <li>
                <a href={GITHUB_URL}>
                  <span>Look through the code on GitHub</span>
                  <span aria-hidden="true">→</span>
                </a>
              </li>
              <li>
                <a href={`${DASHBOARD_URL}/signup`}>
                  <span>Try it with demo data</span>
                  <span aria-hidden="true">→</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
        <ol className={styles.faq}>
          {faqs.map(([q, a], i) => (
            <li key={q}>
              <details className={styles.faqItem} open={i === 0}>
                <summary>
                  <span className={styles.faqNum} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.faqQ}>{q}</span>
                </summary>
                <p>{a}</p>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

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
                <b>Under 8 KB gzipped</b>, loaded async, no dependencies
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
          <div className={styles.devLinks}>
            <a className={`${styles.secondary} ${styles.ghost}`} href="/docs/">
              Read the developer docs
            </a>
            <a className={`${styles.secondary} ${styles.ghost}`} href={GITHUB_URL}>
              Read the code on GitHub
            </a>
          </div>
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
      <div className={`${styles.stackCol} ${styles.intro}`} style={{ maxWidth: 760 }}>
        <span className={styles.eyebrow}>Statistics</span>
        <h2 className={styles.h2} id="stats-title">
          Results you can defend in any review.
        </h2>
        <p className={styles.lede}>
          Splitcraft checks the things that quietly break experiments, and tells you in plain words
          when a result is not ready.
        </p>
      </div>
      <ResultCard />
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

/** Illustration of a result, using the spec's worked example (not customer data). */
function ResultCard() {
  return (
    <figure
      className={styles.resultCard}
      aria-label="Example result: B is up 9.7%, 95% range −1.4% to +20.8%, 96% chance to beat Control"
    >
      <div className={styles.resultTop}>
        <span className={styles.resultVerdict}>B is ahead, with a 96% chance to beat Control</span>
        <span className={styles.resultPill}>SRM check: pass</span>
      </div>
      <div className={styles.rangeRow} aria-hidden="true">
        <span className={styles.rangeLabel}>Uplift, B vs Control</span>
        <div className={styles.rangeTrack}>
          <span className={styles.rangeZero} />
          <span className={styles.rangeBar} />
          <span className={styles.rangeDot} />
        </div>
        <div className={styles.rangeTicks}>
          <span>−1.4%</span>
          <b>+9.7%</b>
          <span>+20.8%</span>
        </div>
      </div>
      <figcaption className={styles.resultCaption}>
        Worked example from the product spec: 12,480 vs 12,380 visitors, 92% of the planned sample.
      </figcaption>
    </figure>
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
      <div className={`${styles.stackCol} ${styles.intro}`}>
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
  // 00-home.html: a green banner, text left and buttons right.
  return (
    // Sits on the edge of the dark footer, so there is no empty band around it.
    <section id="start" className={styles.ctaBand} aria-labelledby="cta-title">
      <div className={`${styles.wrap} ${styles.ctaWrap}`}>
        <div className={styles.cta}>
          <div className={`${styles.stackCol} ${styles.ctaText}`}>
            <h2 className={`${styles.h2} ${styles.ctaTitle}`} id="cta-title">
              Run your first test today.
            </h2>
            <p className={`${styles.lede} ${styles.ctaLede}`}>
              Free up to 100,000 events a month. No card needed.
            </p>
          </div>
          <div className={styles.ctaActions}>
            <a
              className={`${styles.primary} ${styles.ctaPrimary}`}
              href={`${DASHBOARD_URL}/signup`}
            >
              Start free
            </a>
            <a className={`${styles.secondary} ${styles.ctaSecondary}`} href={GITHUB_URL}>
              View on GitHub
            </a>
          </div>
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
        ['Documentation', '/docs/'],
        ['SDK reference', '/docs/sdk/'],
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
          <span>© {new Date().getFullYear()} Splitcraft</span>
          <span>Example numbers on this page come from a demo test, not a customer.</span>
        </div>
      </div>
    </footer>
  );
}
