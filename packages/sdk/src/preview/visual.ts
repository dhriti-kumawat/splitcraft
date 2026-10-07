import { el, PANEL_ID } from './panel';
import type { VisualChange, VisualPosition } from './types';

const ID = 'splitcraft-visual';

// A panel docked on the right, in a shadow root so the site's CSS can't reach it.
const CSS = `
:host{all:initial;position:fixed;top:12px;right:12px;z-index:2147483647;width:min(340px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex}
*{box-sizing:border-box}
section{flex:1;display:flex;flex-direction:column;gap:10px;overflow:auto;padding:12px;border-radius:12px;background:#15171A;color:#D8DCD5;box-shadow:0 16px 40px rgba(21,23,26,.35);font:13px/1.4 'Instrument Sans',system-ui,sans-serif}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.head{justify-content:space-between}
b{color:#FFF}
p{margin:0;color:#8C938A}
.err{color:#F0A39D}
code,.crumbs button{font:11px 'JetBrains Mono',ui-monospace,monospace}
.crumbs button{height:24px;padding:0 6px;color:#F2B37A}
details{border-top:1px solid #2B3033;padding-top:8px}
summary{cursor:pointer;color:#FFF;font-weight:600;margin-bottom:6px}
label{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:6px;margin-top:6px}
input,select,textarea{width:100%;min-width:0;height:28px;padding:0 8px;border-radius:6px;border:1px solid #3A4044;background:#1D2023;color:#FFF;font:12px 'Instrument Sans',system-ui,sans-serif}
textarea{height:64px;padding:6px 8px;font-family:'JetBrains Mono',ui-monospace,monospace;resize:vertical}
input[type=color]{padding:2px;height:28px}
button{height:28px;padding:0 9px;border-radius:7px;border:1px solid #3A4044;background:#262B2E;color:#FFF;font:600 12px 'Instrument Sans',system-ui,sans-serif;cursor:pointer}
button[disabled]{opacity:.4;cursor:default}
button[aria-pressed=true],button.done{background:#F2B37A;border-color:#F2B37A;color:#15171A}
ol{margin:0;padding-left:18px;font-size:12px}
:focus-visible{outline:2px solid #F2B37A;outline-offset:2px}
`;

/** Style properties the editor offers: [label, CSS property, input]. */
const STYLES: Array<[string, string, 'color' | 'text' | string[]]> = [
  ['Text colour', 'color', 'color'],
  ['Background', 'background-color', 'color'],
  ['Font size', 'font-size', 'text'],
  ['Font weight', 'font-weight', ['400', '500', '600', '700', '800']],
  ['Line height', 'line-height', 'text'],
  ['Align', 'text-align', ['left', 'center', 'right']],
  ['Padding', 'padding', 'text'],
  ['Margin', 'margin', 'text'],
  ['Border', 'border', 'text'],
  ['Corner radius', 'border-radius', 'text'],
  ['Width', 'width', 'text'],
  ['Height', 'height', 'text'],
  ['Opacity', 'opacity', 'text'],
  ['Display', 'display', ['block', 'inline-block', 'flex', 'grid', 'inline', 'none']],
];

const POSITIONS: Array<[VisualPosition, string]> = [
  ['before', 'Before it'],
  ['after', 'After it'],
  ['prepend', 'Inside, at the start'],
  ['append', 'Inside, at the end'],
];

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
    // Position only when the tag and classes don't already single it out among siblings.
    const twins = parent ? [...parent.children].filter((c) => c.matches(part)) : [];
    if (twins.length > 1) {
      const same = [...parent!.children].filter((c) => c.tagName === cur!.tagName);
      part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    if (document.querySelector(parts.join(' > ')) === node) break;
    cur = parent;
  }
  return parts.join(' > ');
}

/** rgb(a) from getComputedStyle as #rrggbb, for colour inputs. */
function hex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  return m && m.length >= 3
    ? `#${m
        .slice(0, 3)
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('')}`
    : '#000000';
}

const find = (selector: string): HTMLElement | null => {
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
};

/** Puts `node` at `position` relative to `target`. */
function place(target: Element, position: VisualPosition, ...nodes: Node[]): void {
  if (position === 'before') target.before(...nodes);
  else if (position === 'after') target.after(...nodes);
  else if (position === 'prepend') target.prepend(...nodes);
  else target.append(...nodes);
}

/**
 * Applies one change to the page and returns how to undo it, or null when its element
 * isn't on the page. Both the editor and redo use it, so the page always matches the list.
 */
export function perform(c: VisualChange): (() => void) | null {
  const node = find(c.selector);
  if (!node) return null;
  switch (c.kind) {
    case 'text':
    case 'html': {
      const before = node.innerHTML;
      if (c.kind === 'text') node.textContent = c.value;
      else node.innerHTML = c.value;
      return () => (node.innerHTML = before);
    }
    case 'hide':
    case 'remove': {
      if (c.kind === 'hide') {
        const before = node.style.display;
        node.style.display = 'none';
        return () => (node.style.display = before);
      }
      const parent = node.parentNode;
      const next = node.nextSibling;
      node.remove();
      return () => parent?.insertBefore(node, next);
    }
    case 'style':
    case 'color':
    case 'background': {
      const prop = c.kind === 'style' ? c.prop : c.kind === 'color' ? 'color' : 'background-color';
      const before = node.style.getPropertyValue(prop);
      const priority = node.style.getPropertyPriority(prop);
      node.style.setProperty(prop, c.value, 'important');
      return () => node.style.setProperty(prop, before, priority);
    }
    case 'attr': {
      const before = node.getAttribute(c.name);
      node.setAttribute(c.name, c.value);
      return () =>
        before === null ? node.removeAttribute(c.name) : node.setAttribute(c.name, before);
    }
    case 'move': {
      const target = find(c.target);
      if (!target || target === node || node.contains(target)) return null;
      const parent = node.parentNode;
      const next = node.nextSibling;
      place(target, c.position, node);
      return () => parent?.insertBefore(node, next);
    }
    case 'insert': {
      // A template parses the HTML without running scripts.
      const tpl = document.createElement('template');
      tpl.innerHTML = c.value;
      const nodes = [...tpl.content.childNodes];
      place(node, c.position, ...nodes);
      return () => nodes.forEach((n) => n.parentNode?.removeChild(n));
    }
  }
}

/**
 * The visual editor, like Optimizely's: hover outlines elements and a click selects one
 * (Interactive mode lets you use the page first, e.g. to open a menu). The panel edits
 * the selected element's content, style, attributes, position and visibility, and inserts
 * HTML. Every change shows at once; Undo, Redo and Cancel put the page back. Done hands the
 * list of changes to `onDone` (Cancel hands an empty list).
 */
export function startVisual(o: { onDone(changes: VisualChange[]): void }): () => void {
  const done: Array<{ change: VisualChange; undo: () => void }> = [];
  const redo: VisualChange[] = [];
  let selected: HTMLElement | null = null;
  let hovered: Element | null = null;
  let interactive = false;
  let picking: VisualPosition | null = null;
  let collapsed = false;
  let error = '';

  const box = (color: string) => {
    const b = el('div');
    b.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;outline:2px ${color};outline-offset:1px;display:none`;
    return b;
  };
  const hoverBox = box('dashed #F2B37A');
  const selectBox = box('solid #0F6B57');
  const host = el('div', { id: ID });
  const root = host.attachShadow({ mode: 'open' });
  const section = el('section', { 'aria-label': 'Splitcraft visual editor' });
  root.append(el('style', {}, CSS), section);
  document.body.append(hoverBox, selectBox, host);
  // The preview panel would sit under the editor; it comes back when the editor closes.
  const preview = document.getElementById(PANEL_ID);
  if (preview) preview.style.display = 'none';

  // Keep both outlines on their elements while the page scrolls or changes.
  let frame = 0;
  const follow = () => {
    for (const [b, t] of [
      [hoverBox, hovered],
      [selectBox, selected],
    ] as const) {
      if (!t || !t.isConnected) {
        b.style.display = 'none';
        continue;
      }
      const r = t.getBoundingClientRect();
      Object.assign(b.style, {
        display: 'block',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    }
    frame = requestAnimationFrame(follow);
  };
  follow();

  const ours = (t: EventTarget | null) =>
    t === host || (t instanceof Element && Boolean(t.closest(`#${PANEL_ID}`)));

  const apply = (change: VisualChange) => {
    const undo = perform(change);
    if (!undo) {
      error = 'That element is no longer on the page.';
    } else {
      error = '';
      done.push({ change, undo });
      redo.length = 0;
    }
    if (change.kind === 'remove') selected = null;
    render();
  };
  const undoLast = () => {
    const last = done.pop();
    if (!last) return;
    last.undo();
    redo.push(last.change);
    render();
  };
  const redoLast = () => {
    const next = redo.pop();
    if (!next) return;
    const undo = perform(next);
    if (undo) done.push({ change: next, undo });
    render();
  };

  const select = (t: Element | null) => {
    if (t instanceof HTMLElement && t !== document.body && t !== document.documentElement) {
      selected = t;
      error = '';
    }
    render();
  };

  const onMove = (e: MouseEvent) => {
    hovered = interactive || ours(e.target) ? null : (e.target as Element);
  };
  const onClick = (e: MouseEvent) => {
    if (interactive || ours(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.target as HTMLElement;
    if (picking && selected) {
      const position = picking;
      picking = null;
      apply({ selector: selectorFor(selected), kind: 'move', target: selectorFor(t), position });
    } else select(t);
  };
  // Links and forms on the page don't navigate while selecting.
  const onSubmit = (e: Event) => !interactive && e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    if (ours(e.target)) return;
    if (e.key === 'Escape') {
      picking = null;
      selected = null;
      render();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoLast();
      else undoLast();
    }
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('keydown', onKey, true);

  const button = (label: string, run: () => void, attrs: Record<string, string> = {}) => {
    const b = el('button', { type: 'button', ...attrs }, label);
    b.onclick = run;
    return b;
  };
  const field = (label: string, input: HTMLElement) => el('label', {}, label, input);
  const select_ = (options: Array<[string, string]>, value: string) => {
    const s = el('select');
    for (const [v, text] of options) s.append(el('option', { value: v }, text));
    s.value = value;
    return s;
  };

  function render(): void {
    const parts: Node[] = [];
    const count = done.length;
    parts.push(
      el(
        'div',
        { class: 'row head' },
        el('b', {}, 'Visual editor'),
        el(
          'div',
          { class: 'row' },
          button(
            'Interactive',
            () => {
              interactive = !interactive;
              hovered = null;
              render();
            },
            {
              'aria-pressed': String(interactive),
              title: 'Use the page normally, then turn off to select',
            },
          ),
          button(
            collapsed ? 'Expand' : 'Minimise',
            () => {
              collapsed = !collapsed;
              render();
            },
            { 'aria-expanded': String(!collapsed) },
          ),
        ),
      ),
    );
    if (!collapsed) {
      if (picking) parts.push(el('p', {}, 'Click the element to move it next to. Esc cancels.'));
      else if (interactive)
        parts.push(el('p', {}, 'Interactive: the page works normally. Turn it off to select.'));
      if (error) parts.push(el('p', { class: 'err', role: 'alert' }, error));
      if (!selected) {
        parts.push(el('p', {}, 'Click any element on the page to change it.'));
      } else {
        parts.push(...selectionParts(selected));
      }
      if (count) {
        parts.push(
          el(
            'details',
            {},
            el('summary', {}, `Changes (${count})`),
            el(
              'ol',
              {},
              ...done.map(({ change }) =>
                el('li', {}, `${change.kind} · `, el('code', {}, change.selector)),
              ),
            ),
          ),
        );
      }
    }
    parts.push(
      el(
        'div',
        { class: 'row' },
        button('Undo', undoLast, count ? {} : { disabled: '' }),
        button('Redo', redoLast, redo.length ? {} : { disabled: '' }),
        button('Cancel', () => {
          while (done.length) done.pop()!.undo();
          stop();
          o.onDone([]);
        }),
        button(
          count ? `Done (${count})` : 'Done',
          () => {
            stop();
            o.onDone(done.map((d) => d.change));
          },
          { class: 'done' },
        ),
      ),
    );
    section.replaceChildren(...parts);
  }

  function selectionParts(s: HTMLElement): Node[] {
    const selector = selectorFor(s);
    const ancestors: HTMLElement[] = [];
    for (
      let p = s.parentElement;
      p && p !== document.body && ancestors.length < 3;
      p = p.parentElement
    )
      ancestors.unshift(p);
    const tag = (n: Element) =>
      n.tagName.toLowerCase() + (n.classList[0] ? `.${n.classList[0]}` : '');
    const parts: Node[] = [
      el(
        'div',
        { class: 'row crumbs', 'aria-label': 'Selected element and its parents' },
        ...ancestors.map((a) => button(tag(a), () => select(a))),
        el('code', {}, tag(s)),
      ),
      el(
        'div',
        { class: 'row' },
        button(
          'Parent',
          () => select(s.parentElement),
          s.parentElement === document.body ? { disabled: '' } : {},
        ),
        button(
          'Child',
          () => select(s.firstElementChild),
          s.firstElementChild ? {} : { disabled: '' },
        ),
        button(
          'Previous',
          () => select(s.previousElementSibling),
          s.previousElementSibling ? {} : { disabled: '' },
        ),
        button(
          'Next',
          () => select(s.nextElementSibling),
          s.nextElementSibling ? {} : { disabled: '' },
        ),
      ),
    ];
    const selInput = el('input', { 'aria-label': 'Selector', value: selector });
    selInput.onchange = () => {
      const found = find(selInput.value);
      if (found) select(found);
      else {
        error = 'No element matches that selector.';
        render();
      }
    };
    parts.push(field('Selector', selInput));

    // Content
    const content: Node[] = [];
    if (!s.children.length) {
      const text = el('textarea', { 'aria-label': 'Text' });
      text.value = s.textContent ?? '';
      content.push(
        field('Text', text),
        button('Apply text', () => apply({ selector, kind: 'text', value: text.value })),
      );
    }
    const html = el('textarea', { 'aria-label': 'HTML' });
    html.value = s.innerHTML;
    content.push(
      field('HTML', html),
      button('Apply HTML', () => apply({ selector, kind: 'html', value: html.value })),
    );

    // Style
    const cs = getComputedStyle(s);
    const style: Node[] = STYLES.map(([label, prop, kind]) => {
      const current = cs.getPropertyValue(prop);
      const input =
        kind === 'color'
          ? el('input', { type: 'color', value: hex(current) })
          : Array.isArray(kind)
            ? select_(
                kind.map((k) => [k, k]),
                current,
              )
            : el('input', { value: current });
      input.setAttribute('aria-label', label);
      input.onchange = () =>
        apply({ selector, kind: 'style', prop, value: (input as HTMLInputElement).value });
      return field(label, input);
    });

    // Attributes: images and links get their own fields.
    const attrs: Array<[string, string]> =
      s instanceof HTMLImageElement
        ? [
            ['Image URL', 'src'],
            ['Alt text', 'alt'],
          ]
        : s instanceof HTMLAnchorElement
          ? [
              ['Link URL', 'href'],
              ['Open in', 'target'],
            ]
          : [['Title', 'title']];
    const attributes: Node[] = attrs.map(([label, name]) => {
      const input =
        name === 'target'
          ? select_(
              [
                ['_self', 'Same tab'],
                ['_blank', 'New tab'],
              ],
              s.getAttribute('target') ?? '_self',
            )
          : el('input', { value: s.getAttribute(name) ?? '' });
      input.setAttribute('aria-label', label);
      input.onchange = () =>
        apply({ selector, kind: 'attr', name, value: (input as HTMLInputElement).value });
      return field(label, input);
    });

    // Layout
    const prev = s.previousElementSibling;
    const next = s.nextElementSibling;
    const where = select_(POSITIONS, 'after');
    where.setAttribute('aria-label', 'Move position');
    const layout: Node[] = [
      el(
        'div',
        { class: 'row' },
        button(
          'Move up',
          () =>
            prev &&
            apply({ selector, kind: 'move', target: selectorFor(prev), position: 'before' }),
          prev ? {} : { disabled: '' },
        ),
        button(
          'Move down',
          () =>
            next && apply({ selector, kind: 'move', target: selectorFor(next), position: 'after' }),
          next ? {} : { disabled: '' },
        ),
      ),
      field('Move to', where),
      button(
        'Pick where',
        () => {
          picking = where.value as VisualPosition;
          render();
        },
        { 'aria-pressed': String(Boolean(picking)) },
      ),
    ];

    // Insert
    const newHtml = el('textarea', {
      'aria-label': 'HTML to insert',
      placeholder: '<p>New text</p>',
    });
    const insertAt = select_(POSITIONS, 'after');
    insertAt.setAttribute('aria-label', 'Insert position');
    const insert: Node[] = [
      field('HTML', newHtml),
      field('Where', insertAt),
      button(
        'Insert',
        () =>
          newHtml.value.trim() &&
          apply({
            selector,
            kind: 'insert',
            value: newHtml.value,
            position: insertAt.value as VisualPosition,
          }),
      ),
    ];

    const group = (title: string, nodes: Node[], open = false) =>
      el('details', open ? { open: '' } : {}, el('summary', {}, title), ...nodes);
    return [
      ...parts,
      group('Content', content, true),
      group('Style', style),
      group(
        s instanceof HTMLImageElement
          ? 'Image'
          : s instanceof HTMLAnchorElement
            ? 'Link'
            : 'Attributes',
        attributes,
      ),
      group('Layout', layout),
      group('Insert', insert),
      group('Visibility', [
        el(
          'div',
          { class: 'row' },
          button('Hide', () => apply({ selector, kind: 'hide' })),
          button('Remove', () => apply({ selector, kind: 'remove' })),
        ),
      ]),
    ];
  }

  render();

  function stop(): void {
    cancelAnimationFrame(frame);
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('submit', onSubmit, true);
    document.removeEventListener('keydown', onKey, true);
    hoverBox.remove();
    selectBox.remove();
    host.remove();
    if (preview) preview.style.display = '';
  }
  return stop;
}
