import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from './Home';
import { CONTACT_URL, GITHUB_URL } from './links';

describe('home page', () => {
  it('has one h1 and the sections from the spec in order', () => {
    render(<Home />);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Know what works before you ship it.',
    ]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Works with your stack',
      'More customers from the visitors you already have.',
      'Everything a test needs, from the first line of code to the final call.',
      'The details that make testing safe.',
      'Built for the person who writes the variant.',
      'Results you can defend in any review.',
      'Live in an afternoon.',
      'Free while you find what works.',
      'Before you install.',
      'Still have a question?',
      'Run your first test today.',
      'Product',
      'Developers',
      'Get started',
    ]);
  });

  it('explains CRO and works out what a lift is worth from the visitor’s numbers', async () => {
    const user = userEvent.setup();
    render(<Home />);
    const why = screen.getByRole('region', {
      name: 'More customers from the visitors you already have.',
    });
    expect(within(why).getByText(/Conversion rate optimization \(CRO\)/)).toBeInTheDocument();
    const calc = within(why).getByRole('region', { name: 'Try your numbers' });
    const result = (term: string) =>
      within(calc).getByText(term).parentElement!.querySelector('dd')!.textContent;
    expect(result('Conversions a month')).toBe('400 → 440');
    expect(result('Extra conversions a year')).toBe('+480');
    expect(result('Or buy this many more visitors a month')).toBe('+2,000');

    const rate = within(calc).getByLabelText('Conversion rate');
    await user.clear(rate);
    await user.type(rate, '3');
    const lift = within(calc).getByLabelText('Improvement');
    await user.clear(lift);
    await user.type(lift, '20');
    expect(result('Conversions a month')).toBe('600 → 720');
    expect(result('Extra conversions a year')).toBe('+1,440');
    expect(within(calc).getByText(/takes a 3% conversion rate to 3.6%/)).toBeInTheDocument();
  });

  it('links nav items to sections that exist', () => {
    const { container } = render(<Home />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const link of within(nav).getAllByRole('link')) {
      const href = link.getAttribute('href')!;
      if (href.startsWith('#')) expect(container.querySelector(href), href).not.toBeNull();
      else expect([GITHUB_URL, '/docs/']).toContain(href);
    }
  });

  it('links to the developer docs from the nav, the developer section and the footer', () => {
    render(<Home />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs/');
    expect(screen.getByRole('link', { name: 'Read the developer docs' })).toHaveAttribute(
      'href',
      '/docs/',
    );
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getByRole('link', { name: 'SDK reference' })).toHaveAttribute(
      'href',
      '/docs/sdk/',
    );
  });

  it('takes questions through a contact form beside the FAQ', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    render(<Home />);
    const form = screen.getByRole('form', { name: 'Ask us anything' });
    await user.type(within(form).getByLabelText('Your email'), 'ana@shop.test');
    await user.type(within(form).getByLabelText('Your question'), 'Does it work with Vue?');
    await user.click(within(form).getByRole('button', { name: 'Send question' }));
    expect(await screen.findByText('Thanks, your question is on its way.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CONTACT_URL);
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: 'ana@shop.test',
      message: 'Does it work with Vue?',
      website: '',
    });
    const footer = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footer).getByRole('link', { name: 'Contact us' })).toHaveAttribute(
      'href',
      '#contact',
    );
    vi.unstubAllGlobals();
  });

  it('shows why a question could not be sent', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'Too many messages. Please try again in an hour.' }),
            { status: 429 },
          ),
      ),
    );
    render(<Home />);
    const form = screen.getByRole('form', { name: 'Ask us anything' });
    await user.type(within(form).getByLabelText('Your email'), 'ana@shop.test');
    await user.type(within(form).getByLabelText('Your question'), 'Hi');
    await user.click(within(form).getByRole('button', { name: 'Send question' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Too many messages');
    vi.unstubAllGlobals();
  });

  it('sends Start free and Log in to the dashboard', () => {
    render(<Home />);
    for (const a of screen.getAllByRole('link', { name: 'Start free' })) {
      expect(a.getAttribute('href')).toMatch(/\/signup$/);
    }
    expect(screen.getAllByRole('link', { name: 'Log in' })[0]!.getAttribute('href')).toMatch(
      /\/login$/,
    );
  });

  it('keeps the pricing line from the spec', () => {
    render(<Home />);
    expect(screen.getAllByText('Free up to 100,000 events a month. No card needed.')).toHaveLength(
      2,
    );
  });

  it('makes no claims the product can’t back (PRODUCT_SPEC §1, DECISIONS #14)', () => {
    render(<Home />);
    const text = document.body.textContent!;
    for (const claim of [
      'Book a demo',
      '4.8 KB',
      '52 segment',
      // "Segment" the product, not an integration (useExperiment and LCP exist now).
      'Segment ',
      'support@splitcraft.app',
    ]) {
      expect(text, claim).not.toContain(claim);
    }
    expect(screen.getByText(/A portfolio project by Dhriti Kumawat/)).toBeInTheDocument();
    expect(
      screen.getByText('Example numbers on this page come from a demo test, not a customer.'),
    ).toBeInTheDocument();
  });

  it('answers common questions and shows the free plan', async () => {
    render(<Home />);
    const pricing = screen.getByRole('region', { name: 'Free while you find what works.' });
    expect(within(pricing).getByText('100,000 events a month')).toBeInTheDocument();
    expect(within(pricing).getByRole('link', { name: 'Start free' })).toHaveAttribute(
      'href',
      expect.stringContaining('/signup'),
    );
    const faq = screen.getByRole('region', { name: 'Before you install.' });
    expect(within(faq).getAllByRole('group')).toHaveLength(6);
  });

  it('describes the product illustration for screen readers', () => {
    render(<Home />);
    expect(
      screen.getByRole('figure', { name: /variant B is ahead with a 96% chance to beat Control/ }),
    ).toBeInTheDocument();
  });
});

describe('code tabs', () => {
  it('switch with clicks and arrow keys', async () => {
    const user = userEvent.setup();
    render(<Home />);
    const tabs = screen.getByRole('tablist', { name: 'Install examples' });
    expect(within(tabs).getByRole('tab', { name: 'index.html' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('splitcraft.trackEvent');
    await user.click(within(tabs).getByRole('tab', { name: 'app/layout.tsx' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('strategy="beforeInteractive"');
    await user.keyboard('{ArrowRight}');
    expect(within(tabs).getByRole('tab', { name: 'GTM' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('dataLayer');
  });
});

describe('mobile menu', () => {
  it('opens and closes with an accessible button', async () => {
    const user = userEvent.setup();
    render(<Home />);
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const menu = screen.getByRole('navigation', { name: 'Menu' });
    await user.click(within(menu).getByRole('link', { name: 'Statistics' }));
    expect(screen.queryByRole('navigation', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
