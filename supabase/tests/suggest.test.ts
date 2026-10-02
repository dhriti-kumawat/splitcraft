import {
  pagesToScan,
  ruleSuggestions,
  scanPage,
  siteOrigin,
  sitemapPages,
  validSuggestions,
} from '../functions/_shared/suggest.ts';

const HOME = `<!doctype html><html><head><title>Trips &amp; tours</title>
<script>var x = '<h1>not this</h1>';</script></head><body>
<nav><a href="/pricing">Pricing</a> <a href="https://shop.test/signup">Sign up</a>
<a href="https://other.test/x">Elsewhere</a> <a href="#top">Top</a> <a href="/api/status">API</a></nav>
<h1>Trips <em>you</em> will love</h1>
<a class="btn btn-primary" href="/book">Book now</a><button type="button">Search</button>
<form action="/subscribe"><input name="email"></form>
<p>From $49 a night. Rated 4.8 stars by 2,000 customers.</p>
</body></html>`;

describe('siteOrigin', () => {
  it('accepts public host names with or without a scheme', () => {
    expect(siteOrigin('shop.test')).toBe('https://shop.test');
    expect(siteOrigin('http://www.Shop.test/path')).toBe('https://www.shop.test');
  });

  it('refuses private and malformed hosts', () => {
    for (const bad of [
      'localhost',
      'app.localhost',
      '127.0.0.1',
      '10.0.0.2',
      'intranet',
      'x.local',
      '[::1]',
      '',
      'http://',
    ])
      expect(siteOrigin(bad)).toBeNull();
  });
});

describe('scanPage', () => {
  it('finds the heading, calls to action, forms, endpoints, prices and reviews', () => {
    const { page: scan, links } = scanPage(HOME, 'https://shop.test/');
    expect(scan).toMatchObject({
      url: 'https://shop.test/',
      title: 'Trips & tours',
      h1: 'Trips you will love',
      ctas: ['Search', 'Book now'],
      forms: 1,
      hasPrice: true,
      hasReviews: true,
    });
    expect(scan.endpoints).toEqual(['/subscribe', '/signup', '/api/status']);
    expect(links).toEqual([
      'https://shop.test/pricing',
      'https://shop.test/signup',
      'https://shop.test/api/status',
      'https://shop.test/book',
    ]);
  });

  it('copes with an empty page', () => {
    expect(scanPage('', 'https://shop.test/').page).toMatchObject({ h1: '', ctas: [], forms: 0 });
  });
});

describe('pages to scan', () => {
  it('reads same-site sitemap URLs and puts key pages first', () => {
    const xml = `<urlset><url><loc>https://shop.test/about</loc></url>
      <url><loc> https://www.shop.test/pricing </loc></url><url><loc>https://cdn.test/a</loc></url>
      <url><loc>https://shop.test/brochure.pdf</loc></url></urlset>`;
    const sitemap = sitemapPages(xml, 'https://shop.test');
    expect(sitemap).toEqual([
      'https://shop.test/about',
      'https://www.shop.test/pricing',
      'https://shop.test/brochure.pdf',
    ]);
    expect(pagesToScan('https://shop.test/', sitemap, ['https://shop.test/signup'])).toEqual([
      'https://shop.test/',
      'https://www.shop.test/pricing',
      'https://shop.test/signup',
      'https://shop.test/about',
    ]);
  });

  it('scans at most six pages', () => {
    const many = Array.from({ length: 20 }, (_, i) => `https://shop.test/p${i}`);
    expect(pagesToScan('https://shop.test/', many, [])).toHaveLength(6);
  });
});

describe('suggestions', () => {
  const home = scanPage(HOME, 'https://shop.test/').page;
  const pricing = { ...home, url: 'https://shop.test/pricing', h1: '', ctas: [], forms: 0 };

  it('match what each page has to the variant templates', () => {
    const list = ruleSuggestions([home, pricing]);
    expect(list.map((s) => [s.template, s.page])).toEqual([
      ['headline', 'https://shop.test/'],
      ['button', 'https://shop.test/'],
      ['trust', 'https://shop.test/'],
      ['trust', 'https://shop.test/pricing'],
      ['sticky', 'https://shop.test/'],
      ['promo', 'https://shop.test/'],
    ]);
    expect(list[1]!.hypothesis).toContain('"Search"');
  });

  it('are empty when nothing was scanned', () => {
    expect(ruleSuggestions([])).toEqual([]);
  });

  it('from the AI keep only known pages and templates', () => {
    const raw = [
      {
        name: ' Clearer headline ',
        hypothesis: 'Better.',
        page: 'https://shop.test/',
        template: 'headline',
      },
      { name: 'Elsewhere', hypothesis: 'x', page: 'https://evil.test/', template: 'headline' },
      {
        name: 'Unknown',
        hypothesis: 'x',
        page: 'https://shop.test/',
        template: 'rewrite-everything',
      },
      { name: '', hypothesis: 'x', page: 'https://shop.test/', template: 'promo' },
      'junk',
    ];
    expect(validSuggestions(raw, [home])).toEqual([
      {
        name: 'Clearer headline',
        hypothesis: 'Better.',
        page: 'https://shop.test/',
        template: 'headline',
      },
    ]);
    expect(validSuggestions(null, [home])).toEqual([]);
  });
});
