// Starting points for variant code (template picker in step 2). Only public SDK helpers.

export interface Template {
  id: string;
  name: string;
  js: string;
  css: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    js: `// Runs once per page for visitors in this variant.\n// splitcraft.* helpers are listed on the right.\n`,
    css: '',
  },
  {
    id: 'text',
    name: 'Change text',
    js: `splitcraft.waitForElement('h1', (el) => {\n  el.textContent = 'Your new headline';\n});\n`,
    css: '',
  },
  {
    id: 'trust',
    name: 'Trust row',
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
    id: 'sticky',
    name: 'Sticky bar',
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
    id: 'hide',
    name: 'Hide element',
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
