import { el, PANEL_ID } from './panel';
import type { VisualChange } from './types';

const BAR_ID = 'splitcraft-visual';

const CSS = `
:host{all:initial;position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2147483647;width:min(560px,calc(100vw - 24px))}
*{box-sizing:border-box}
section{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:#15171A;color:#D8DCD5;box-shadow:0 16px 40px rgba(21,23,26,.35);font:13px/1.4 'Instrument Sans',system-ui,sans-serif}
code{flex:1 1 100%;font:11px 'JetBrains Mono',ui-monospace,monospace;color:#F2B37A;overflow-wrap:anywhere}
button{height:30px;padding:0 10px;border-radius:7px;border:1px solid #3A4044;background:#262B2E;color:#FFF;font:600 12px 'Instrument Sans',system-ui,sans-serif;cursor:pointer}
button[disabled]{opacity:.45;cursor:default}
button.done{background:#F2B37A;border-color:#F2B37A;color:#15171A}
label{display:flex;align-items:center;gap:4px}
input{width:28px;height:24px;padding:0;border:0;background:none}
button:focus-visible,input:focus-visible{outline:2px solid #F2B37A;outline-offset:2px}
`;

/**
 * A short CSS selector that finds `node` on this page: its id when that is simple and
 * unique, otherwise a path of tags, up to two simple classes and :nth-of-type.
 */
export function selectorFor(node: Element): string {
  const parts: string[] = [];
  for (let cur: Element | null = node; cur && cur !== document.documentElement;) {
    if (/^[A-Za-z][\w-]*$/.test(cur.id) && document.querySelectorAll(`#${cur.id}`).length === 1) {
      parts.unshift(`#${cur.id}`);
      break;
    }
    let part = cur.tagName.toLowerCase();
    const classes = [...cur.classList].filter((c) => /^[A-Za-z][\w-]*$/.test(c)).slice(0, 2);
    if (classes.length) part += `.${classes.join('.')}`;
    const parent: Element | null = cur.parentElement;
    const same = parent ? [...parent.children].filter((c) => c.tagName === cur!.tagName) : [];
    if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    parts.unshift(part);
    if (document.querySelector(parts.join(' > ')) === node) break;
    cur = parent;
  }
  return parts.join(' > ');
}

/**
 * Point-and-click editing: hover outlines an element, click selects it, then change its
 * text, colours or hide it. The page changes at once; `onDone` gets the list of changes,
 * which the dashboard turns into variant code.
 */
export function startVisual(o: { onDone(changes: VisualChange[]): void }): () => void {
  const changes: VisualChange[] = [];
  let selected: HTMLElement | null = null;
  const record = (kind: VisualChange['kind'], value?: string) => {
    if (!selected) return;
    const selector = selectorFor(selected);
    const i = changes.findIndex((c) => c.selector === selector && c.kind === kind);
    if (i >= 0) changes.splice(i, 1);
    changes.push({ selector, kind, ...(value !== undefined && { value }) });
    render();
  };

  const box = el('div');
  box.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483646;outline:2px solid #F2B37A;outline-offset:1px;display:none';
  const host = el('div', { id: BAR_ID });
  const root = host.attachShadow({ mode: 'open' });
  const section = el('section', { 'aria-label': 'Splitcraft visual editor' });
  root.append(el('style', {}, CSS), section);
  document.body.append(box, host);

  const ours = (t: EventTarget | null) =>
    t === host || t === box || (t instanceof Element && t.closest(`#${PANEL_ID},#${BAR_ID}`));
  const outline = (t: Element) => {
    const r = t.getBoundingClientRect();
    box.style.cssText += `;display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  };
  const onMove = (e: MouseEvent) => {
    if (!ours(e.target) && e.target instanceof Element && !selected?.isContentEditable)
      outline(e.target);
  };
  const onClick = (e: MouseEvent) => {
    if (ours(e.target) || selected?.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.target instanceof HTMLElement) {
      selected = e.target;
      outline(selected);
      render();
    }
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);

  const button = (label: string, onClick: () => void, extra: Record<string, string> = {}) => {
    const b = el('button', { type: 'button', ...extra }, label);
    b.onclick = onClick;
    return b;
  };
  const colour = (label: string, prop: 'color' | 'backgroundColor', kind: VisualChange['kind']) => {
    const input = el('input', { type: 'color', 'aria-label': label });
    input.oninput = () => {
      if (!selected) return;
      selected.style[prop] = input.value;
      record(kind, input.value);
    };
    return el('label', {}, label, input);
  };

  function render(): void {
    const parts: Node[] = [
      el(
        'code',
        {},
        selected ? selectorFor(selected) : 'Click an element on the page to change it.',
      ),
    ];
    if (selected) {
      const s = selected;
      parts.push(
        button(
          'Edit text',
          () => {
            s.contentEditable = 'true';
            s.focus();
            s.addEventListener(
              'blur',
              () => {
                s.contentEditable = 'inherit';
                record('text', s.textContent ?? '');
              },
              { once: true },
            );
          },
          // Replacing the text of an element with children would remove them.
          s.children.length ? { disabled: '', title: 'Pick an element with only text' } : {},
        ),
        button('Hide', () => {
          s.style.display = 'none';
          record('hide');
          selected = null;
          box.style.display = 'none';
          render();
        }),
        colour('Text', 'color', 'color'),
        colour('Fill', 'backgroundColor', 'background'),
      );
    }
    parts.push(
      button(
        changes.length ? `Done (${changes.length})` : 'Done',
        () => {
          stop();
          o.onDone(changes);
        },
        { class: 'done' },
      ),
    );
    section.replaceChildren(...parts);
  }
  render();

  function stop(): void {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    if (selected) selected.contentEditable = 'inherit';
    box.remove();
    host.remove();
  }
  return stop;
}
