// Starting points for variant code (template picker in step 2). Only public SDK helpers.

export interface Template {
  id: string;
  name: string;
  /** One line for the gallery. */
  description: string;
  category: 'Copy' | 'Layout' | 'Trust' | 'Start';
  js: string;
  css: string;
}

// Selectors in the templates are examples: each one says where to put your own.
export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty variant with a reminder of the helpers.',
    category: 'Start',
    js: `// Runs once per page for visitors in this variant.\n// splitcraft.* helpers are listed on the right.\n`,
    css: '',
  },
  {
    id: 'headline',
    name: 'Headline swap',
    description: 'New headline and subheading, the classic copy test.',
    category: 'Copy',
    js: `// Change the selectors to your page's heading and subheading.
splitcraft.waitForElement('h1', (el) => {
  el.textContent = 'Trips you will talk about for years';
});
splitcraft.waitForElement('.hero p', (el) => {
  el.textContent = 'Small groups, local guides, free cancellation up to 30 days.';
});
`,
    css: '',
  },
  {
    id: 'button',
    name: 'Button copy and colour',
    description: 'Clearer call to action text and a stronger colour.',
    category: 'Copy',
    js: `// Change '.book-now-btn' to your main button.
splitcraft.waitForElement('.book-now-btn', (btn) => {
  btn.textContent = 'Check dates and prices';
  btn.classList.add('spl-cta');
});
`,
    css: `.spl-cta {
  background: #0f6b57 !important;
  color: #fff !important;
  border-color: #0f6b57 !important;
  font-weight: 700;
}
`,
  },
  {
    id: 'promo',
    name: 'Promo banner',
    description: 'A slim bar at the top of the page with an offer and a link.',
    category: 'Layout',
    js: `const bar = document.createElement('a');
bar.className = 'spl-promo';
bar.href = '/deals'; // Where the banner goes
bar.textContent = 'Summer sale: 15% off trips booked this week';
document.body.prepend(bar);
splitcraft.onceInView(bar, () => splitcraft.trackEvent('promo_banner_seen'));
bar.addEventListener('click', () => splitcraft.trackEvent('promo_banner_click'));
`,
    css: `.spl-promo {
  display: block;
  padding: 10px 16px;
  background: #15171a;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}
.spl-promo:hover {
  text-decoration: underline;
}
`,
  },
  {
    id: 'sticky',
    name: 'Sticky bar',
    description: 'Keeps the main button in view on small screens.',
    category: 'Layout',
    js: `// Keeps the call to action in view on small screens
splitcraft.waitForElement('.book-now-btn', (btn) => {
  const bar = document.createElement('div');
  bar.className = 'spl-sticky';
  bar.appendChild(btn.cloneNode(true));
  document.body.appendChild(bar);
});
`,
    css: `.spl-sticky {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
}
@media (min-width: 768px) {
  .spl-sticky { display: none; }
}
`,
  },
  {
    id: 'reorder',
    name: 'Reorder sections',
    description: 'Move a section higher up the page, e.g. reviews above the fold.',
    category: 'Layout',
    js: `// Moves the first selector's element before the second one.
splitcraft.waitForElement('.reviews', (section) => {
  splitcraft.waitForElement('.features', (target) => {
    target.parentElement?.insertBefore(section, target);
  });
});
`,
    css: '',
  },
  {
    id: 'image',
    name: 'Image swap',
    description: 'Try a different hero image.',
    category: 'Layout',
    js: `splitcraft.waitForElement('.hero img', (img) => {
  img.src = 'https://example.com/new-hero.jpg'; // Your new image
  img.srcset = '';
  img.alt = 'Describe the new image';
});
`,
    css: '',
  },
  {
    id: 'trust',
    name: 'Trust row',
    description: 'Reassurance under the main button: cancellation, payment.',
    category: 'Trust',
    js: `// Trust badges under the Book button
splitcraft.waitForElement('.book-now-btn', (btn) => {
  const row = document.createElement('ul');
  row.className = 'spl-trust';
  row.innerHTML = \`
    <li>Free cancellation up to 30 days</li>
    <li>Secure payment</li>
    <li>Pay in 3 instalments</li>\`;
  btn.insertAdjacentElement('afterend', row);

  splitcraft.onceInView(row, () => {
    splitcraft.trackEvent('trust_badges_seen');
  });
});
`,
    css: `.spl-trust {
  list-style: none;
  margin: 12px 0 0;
  padding: 12px;
  border: 1.5px dashed #d97a2b;
  border-radius: 8px;
  display: grid;
  gap: 8px;
  font-size: 14px;
}
.spl-trust li::before {
  content: '✓ ';
  color: #0f6b57;
  font-weight: 700;
}
`,
  },
  {
    id: 'hide',
    name: 'Hide element',
    description: 'Remove a distraction, like a banner or a second button.',
    category: 'Layout',
    js: '',
    css: `/* Hide an element for this variant */\n.promo-banner {\n  display: none !important;\n}\n`,
  },
];

/** Type definitions so the editor autocompletes the variant helpers. */
export const SPLITCRAFT_DTS = `
declare const splitcraft: {
  /** Runs fn with the first element matching selector, once it exists (default wait 10 s). */
  waitForElement(selector: string, fn: (el: Element) => void, opts?: { timeout?: number }): void;
  /** Runs fn once, the first time el is visible. */
  onceInView(el: Element, fn: () => void): void;
  /** Calls fn with the new URL after SPA navigation. Returns an unsubscribe function. */
  onRouteChange(fn: (url: string) => void): () => void;
  /** Adds a <style> element. Returns a function that removes it. */
  injectStyles(css: string, id?: string): () => void;
  /** Sends a goal event (and a dataLayer push). */
  trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void;
};
`;
