import type { QaExperiment, QaSource } from './types';

export const QA_HOST_ID = 'splitly-qa';

// Matches design/screens/17-qa-mode-mobile.html. `:host { all: initial }` stops the
// site's inherited styles (font, colour, line-height) leaking into the shadow root.
const CSS = `
:host{all:initial;position:fixed;right:12px;bottom:12px;z-index:2147483647;width:min(366px,calc(100vw - 24px))}
*{box-sizing:border-box}
section{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:12px;background:#15171A;color:#D8DCD5;box-shadow:0 16px 40px rgba(21,23,26,.35);font:13px/1.4 'Instrument Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:12px}
.head,.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#FFF}
.mode{font-size:11px;color:#F2B37A}
.list{display:flex;flex-direction:column;gap:6px}
.forced{color:#F2B37A}
.bucketed{color:#7FC4E8}
.events{display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:8px;background:#1D2124}
.label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#8C938A}
.sent{color:#A8D8A0}
.waiting{color:#8C938A}
.switch{display:flex;flex-direction:column;gap:8px}
.switch label{display:flex;justify-content:space-between;align-items:center;gap:10px}
select{height:32px;border-radius:7px;border:1px solid #3A4044;background:#262B2E;color:#FFF;font:inherit;padding:0 8px}
.actions{display:flex;gap:8px}
button{height:36px;border-radius:7px;border:1px solid #3A4044;background:transparent;color:#D8DCD5;font:600 13px 'Instrument Sans',system-ui,sans-serif;cursor:pointer}
button.primary{flex:1;background:#262B2E;color:#FFF}
button.secondary{flex:1}
button.close{width:36px;display:flex;align-items:center;justify-content:center}
button:focus-visible,select:focus-visible{outline:2px solid #F2B37A;outline-offset:2px}
`;

const LOGO =
  '<svg width="18" height="18" viewBox="0 0 26 26" aria-hidden="true"><rect x="1" y="1" width="24" height="24" rx="6" fill="#0F6B57"/><rect x="6.5" y="7" width="5.5" height="12" rx="1.5" fill="#FFF"/><rect x="14" y="7" width="5.5" height="12" rx="1.5" fill="#F2B37A"/></svg>';
const CLOSE =
  '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#D8DCD5" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>';

/**
 * Render the QA panel in a shadow root, so the site's CSS cannot break it and its
 * CSS cannot touch the site. Returns a function that removes it.
 */
export function mountQaPanel(source: QaSource): () => void {
  document.getElementById(QA_HOST_ID)?.remove();
  const host = document.createElement('div');
  host.id = QA_HOST_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const section = el('section', { 'aria-label': 'Splitly QA panel' });
  root.append(style, section);

  let switcherOpen = false;

  const render = (): void => {
    const { experiments, events } = source.getState();
    const anyForced = experiments.some((e) => e.assignedBy === 'forced');

    const brand = el('span', { class: 'brand' });
    brand.innerHTML = LOGO;
    brand.append('Splitly QA');
    const head = el(
      'div',
      { class: 'head' },
      brand,
      el('span', { class: 'mono mode' }, anyForced ? 'forced by URL' : 'bucketed'),
    );

    const list = el(
      'div',
      { class: 'list' },
      ...(experiments.length
        ? experiments.map(experimentRow)
        : [el('span', { class: 'waiting' }, 'No active experiments on this page')]),
    );

    const eventList = el(
      'div',
      { class: 'events' },
      el('span', { class: 'label' }, 'Events sent'),
      ...(events.length
        ? events.map((e) =>
            el(
              'span',
              { class: `mono ${e.sent ? 'sent' : 'waiting'}` },
              e.sent ? `✓ ${e.label}` : `· waiting: ${e.label}`,
            ),
          )
        : [el('span', { class: 'mono waiting' }, 'No events yet')]),
    );

    const toggle = el(
      'button',
      {
        type: 'button',
        class: 'primary',
        'aria-expanded': String(switcherOpen),
      },
      'Switch variant',
    );
    toggle.disabled = experiments.length === 0;
    toggle.onclick = () => {
      switcherOpen = !switcherOpen;
      render();
      root.querySelector<HTMLButtonElement>('button.primary')?.focus();
    };

    const reset = el('button', { type: 'button', class: 'secondary' }, 'Reset');
    reset.onclick = () => source.reset();

    const close = el('button', { type: 'button', class: 'close', 'aria-label': 'Hide QA panel' });
    close.innerHTML = CLOSE;
    close.onclick = () => unmount();

    const parts: Node[] = [head, list];
    if (switcherOpen) parts.push(switcher(experiments));
    parts.push(eventList, el('div', { class: 'actions' }, toggle, reset, close));
    section.replaceChildren(...parts);
  };

  const switcher = (experiments: QaExperiment[]): HTMLElement =>
    el(
      'div',
      { class: 'switch' },
      ...experiments.map((exp) => {
        const select = el('select', { 'aria-label': `Variant for ${exp.name}` });
        for (const v of exp.variants) {
          const option = el('option', { value: v.key }, v.name);
          option.selected = v.key === exp.variantKey;
          select.append(option);
        }
        select.onchange = () => source.switchVariant(exp.key, select.value);
        return el('label', {}, el('span', {}, exp.name), select);
      }),
    );

  const unsubscribe = source.subscribe(render);
  const unmount = (): void => {
    unsubscribe();
    host.remove();
  };

  render();
  document.body.append(host);
  return unmount;
}

function experimentRow(exp: QaExperiment): HTMLElement {
  const variant = exp.variants.find((v) => v.key === exp.variantKey)?.name ?? exp.variantKey;
  return el(
    'div',
    { class: 'row' },
    el('span', {}, exp.name),
    el('span', { class: `mono ${exp.assignedBy}` }, `${variant} · ${exp.assignedBy}`),
  );
}

/** Build an element. Text children go in as text, never HTML, so names from config are safe. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}
