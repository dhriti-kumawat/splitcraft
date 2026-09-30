import type { PreviewState } from './types';

export const PANEL_ID = 'splitcraft-preview';

// Same look as the QA panel (design/screens/17-qa-mode-mobile.html), in a shadow root so
// the site's CSS can't reach it.
const CSS = `
:host{all:initial;position:fixed;right:12px;bottom:12px;z-index:2147483647;width:min(340px,calc(100vw - 24px))}
*{box-sizing:border-box}
section{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:#15171A;color:#D8DCD5;box-shadow:0 16px 40px rgba(21,23,26,.35);font:13px/1.4 'Instrument Sans',system-ui,-apple-system,sans-serif}
.head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.brand{font-weight:700;color:#FFF;white-space:nowrap}
.src{flex:1;font:11px 'JetBrains Mono',ui-monospace,monospace;color:#F2B37A}
.name{color:#FFF;font-weight:600}
.vars{display:flex;flex-wrap:wrap;gap:6px}
.vars button{height:30px;padding:0 10px}
.vars button[aria-pressed=true]{background:#F2B37A;border-color:#F2B37A;color:#15171A}
.msg{margin:0;color:#8C938A}
.err{margin:0;color:#F0A39D}
.actions{display:flex;gap:8px}
button{height:34px;padding:0 12px;border-radius:7px;border:1px solid #3A4044;background:#262B2E;color:#FFF;font:600 13px 'Instrument Sans',system-ui,sans-serif;cursor:pointer}
button.ghost{background:transparent;color:#D8DCD5}
button:focus-visible{outline:2px solid #F2B37A;outline-offset:2px}
`;

export interface Panel {
  render(state: PreviewState, note: string, error: string): void;
  remove(): void;
}

/** The floating preview panel: which variant shows, switch buttons, stop. */
export function mountPanel(handlers: { onSwitch(key: string): void; onStop(): void }): Panel {
  document.getElementById(PANEL_ID)?.remove();
  const host = document.createElement('div');
  host.id = PANEL_ID;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  const section = el('section', { 'aria-label': 'Splitcraft preview' });
  root.append(style, section);
  let collapsed = false;
  let last: [PreviewState, string, string] | null = null;

  const render = (state: PreviewState, note: string, error: string): void => {
    last = [state, note, error];
    const toggle = el(
      'button',
      { type: 'button', class: 'ghost', 'aria-expanded': String(!collapsed) },
      collapsed ? 'Show' : 'Hide',
    );
    toggle.onclick = () => {
      collapsed = !collapsed;
      render(...last!);
    };
    const head = el(
      'div',
      { class: 'head' },
      el('span', { class: 'brand' }, 'Splitcraft preview'),
      el('span', { class: 'src' }, state.source === 'live' ? 'live from dashboard' : 'saved code'),
      toggle,
    );
    const parts: Node[] = [head];
    if (!collapsed) {
      if (state.experimentName) parts.push(el('span', { class: 'name' }, state.experimentName));
      if (state.variants.length) {
        parts.push(
          el(
            'div',
            { class: 'vars', role: 'group', 'aria-label': 'Variant' },
            ...state.variants.map((v) => {
              const b = el(
                'button',
                { type: 'button', 'aria-pressed': String(v.key === state.variantKey) },
                v.name,
              );
              b.onclick = () => v.key !== state.variantKey && handlers.onSwitch(v.key);
              return b;
            }),
          ),
        );
      }
      if (error) parts.push(el('p', { class: 'err', role: 'alert' }, error));
      if (note) parts.push(el('p', { class: 'msg' }, note));
      const stop = el('button', { type: 'button', class: 'ghost' }, 'Stop preview');
      stop.onclick = handlers.onStop;
      parts.push(el('div', { class: 'actions' }, stop));
    }
    section.replaceChildren(...parts);
  };

  const attach = () => (document.body ?? document.documentElement).append(host);
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });

  return { render, remove: () => host.remove() };
}

/** Build an element. Text goes in as text, never HTML, so names are safe. */
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
