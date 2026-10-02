// Experiment suggestions: scan a project's site for pages and the things on them worth
// testing, then match those to the dashboard's variant templates. Pure functions, so the
// Edge Function stays small and these run in the backend tests.

/** Template ids from apps/dashboard/src/lib/templates.ts that a suggestion can start from. */
export const TEMPLATE_IDS = ['headline', 'button', 'promo', 'sticky', 'trust', 'hide'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface PageScan {
  url: string;
  title: string;
  h1: string;
  /** Text of buttons and button-like links, first few only. */
  ctas: string[];
  forms: number;
  /** Form actions and same-site links that look like API or app endpoints. */
  endpoints: string[];
  hasPrice: boolean;
  hasReviews: boolean;
}

export interface Suggestion {
  name: string;
  hypothesis: string;
  /** Page the experiment runs on; becomes its preview URL. */
  page: string;
  template: TemplateId;
}

export const MAX_PAGES = 6;
export const MAX_SUGGESTIONS = 6;

/**
 * The site origin for a project's main domain, or null when it isn't a public host name
 * (IP addresses, localhost and single-label names are refused so the scan can't reach
 * private networks).
 */
export function siteOrigin(domain: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^[\d.]+$/.test(host) ||
    host.includes(':')
  )
    return null;
  return `https://${host}`;
}

/** Page URLs on the same site from a sitemap, in order, without duplicates. */
export function sitemapPages(xml: string, origin: string): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]!));
  return unique(urls.filter((u) => sameSite(u, origin)).map(clean));
}

const strip = (html: string) =>
  decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

function decode(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function sameSite(url: string, origin: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
}

function clean(url: string) {
  const u = new URL(url);
  u.hash = '';
  return u.href;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

/** What a page offers to test (heading, calls to action, forms, prices, reviews) and its links. */
export function scanPage(html: string, url: string): { page: PageScan; links: string[] } {
  const body = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ');
  const first = (re: RegExp) => strip(body.match(re)?.[1] ?? '').slice(0, 140);
  const hrefs = [...body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)/gi)].flatMap((m) => {
    try {
      return [clean(new URL(decode(m[1]!), url).href)];
    } catch {
      return [];
    }
  });
  const links = unique(hrefs.filter((h) => sameSite(h, url) && /^https:/.test(h)));
  const actions = [...body.matchAll(/<form\b[^>]*action\s*=\s*["']([^"']+)/gi)].flatMap((m) => {
    try {
      return [new URL(decode(m[1]!), url).pathname];
    } catch {
      return [];
    }
  });
  const apiLinks = links
    .map((l) => new URL(l).pathname)
    .filter((p) => /^\/(api|graphql|checkout|cart|signup|register|subscribe)\b/i.test(p));
  const ctas = [
    ...body.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi),
    ...body.matchAll(
      /<a\b[^>]*class\s*=\s*["'][^"']*\b(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ]
    .map((m) => strip(m[1]!).slice(0, 60))
    .filter((t) => t.length > 1);
  const text = strip(body).slice(0, 20000);
  const page: PageScan = {
    url: clean(url),
    title: first(/<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: first(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),
    ctas: unique(ctas).slice(0, 5),
    forms: (body.match(/<form\b/gi) ?? []).length,
    endpoints: unique([...actions, ...apiLinks]).slice(0, 8),
    hasPrice: /(?:[$€£₹]\s?\d|\d\s?(?:usd|eur|gbp)\b|\/\s?mo(?:nth)?\b)/i.test(text),
    hasReviews: /\b(reviews?|testimonials?|rated|stars?|customers love)\b/i.test(text),
  };
  return { page, links };
}

/**
 * Pages to scan after the home page: sitemap first, then home page links, with pages that
 * usually matter most (pricing, product, checkout, sign-up) moved to the front.
 */
export function pagesToScan(home: string, sitemap: string[], links: string[]): string[] {
  const score = (u: string) =>
    /pric|plan|product|shop|checkout|cart|signup|sign-up|register|book|demo|trial|contact/i.test(
      new URL(u).pathname,
    )
      ? 0
      : 1;
  const rest = unique([...sitemap, ...links])
    .filter((u) => u !== home && !/\.(pdf|jpe?g|png|gif|svg|webp|zip|xml|css|js)$/i.test(u))
    .map((u, i) => ({ u, i }))
    .sort((a, b) => score(a.u) - score(b.u) || a.i - b.i)
    .map((x) => x.u);
  return [home, ...rest].slice(0, MAX_PAGES);
}

const pathOf = (url: string) => new URL(url).pathname;

/** Rule-based suggestions, used when the AI model isn't configured or fails. */
export function ruleSuggestions(pages: PageScan[]): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (s: Suggestion) => {
    if (!out.some((o) => o.template === s.template && o.page === s.page)) out.push(s);
  };
  for (const page of pages) {
    const path = pathOf(page.url);
    const where = path === '/' ? 'home page' : path;
    if (page.h1)
      add({
        name: `Headline on ${where}`,
        hypothesis: `A headline that names the main benefit will get more visitors past "${page.h1.slice(0, 60)}" and into the page.`,
        page: page.url,
        template: 'headline',
      });
    if (page.ctas.length)
      add({
        name: `Button copy on ${where}`,
        hypothesis: `Clearer wording than "${page.ctas[0]}" and a stronger colour will raise clicks on the main button.`,
        page: page.url,
        template: 'button',
      });
    if (page.hasPrice || /pric|plan|checkout|cart/i.test(path))
      add({
        name: `Reviews near prices on ${where}`,
        hypothesis:
          'Showing reviews and guarantees next to prices will reduce doubt and raise conversions.',
        page: page.url,
        template: 'trust',
      });
    if (page.forms && /signup|sign-up|register|contact|demo|trial|checkout/i.test(path))
      add({
        name: `Fewer distractions on ${where}`,
        hypothesis: 'Hiding secondary links around the form will help more visitors finish it.',
        page: page.url,
        template: 'hide',
      });
  }
  const home = pages[0];
  if (home?.ctas.length)
    add({
      name: 'Sticky call to action',
      hypothesis: `Keeping "${home.ctas[0]}" in view while visitors scroll will raise clicks.`,
      page: home.url,
      template: 'sticky',
    });
  if (home)
    add({
      name: 'Offer banner',
      hypothesis: 'A slim offer bar at the top will lead more visitors to the key page.',
      page: home.url,
      template: 'promo',
    });
  return out.slice(0, MAX_SUGGESTIONS);
}

/** Keeps only well-formed suggestions on scanned pages; the AI's answer is not trusted. */
export function validSuggestions(raw: unknown, pages: PageScan[]): Suggestion[] {
  const urls = new Set(pages.map((p) => p.url));
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter(
      (s): s is Suggestion =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.name === 'string' &&
        typeof s.hypothesis === 'string' &&
        urls.has(s.page) &&
        (TEMPLATE_IDS as readonly string[]).includes(s.template),
    )
    .map((s) => ({
      name: s.name.trim().slice(0, 120),
      hypothesis: s.hypothesis.trim().slice(0, 400),
      page: s.page,
      template: s.template,
    }))
    .filter((s) => s.name && s.hypothesis)
    .slice(0, MAX_SUGGESTIONS);
}
