// Visual editor changes (from the preview on the site) turned into variant code. The
// changes come from a web page, so each is checked and every value goes in as data:
// strings through JSON.stringify, style properties and attributes from an allow-list,
// no javascript: URLs, and selectors in CSS without characters that could end a rule.

export type VisualPosition = 'before' | 'after' | 'prepend' | 'append';

export type VisualChange =
  | { selector: string; kind: 'text' | 'html'; value: string }
  | { selector: string; kind: 'hide' | 'remove' }
  | { selector: string; kind: 'style'; prop: string; value: string }
  | { selector: string; kind: 'attr'; name: string; value: string }
  | { selector: string; kind: 'move'; target: string; position: VisualPosition }
  | { selector: string; kind: 'insert'; value: string; position: VisualPosition }
  | { selector: string; kind: 'color' | 'background'; value: string };

export const STYLE_PROPS = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'padding',
  'margin',
  'border',
  'border-radius',
  'width',
  'height',
  'opacity',
  'display',
];
export const ATTRIBUTES = ['src', 'alt', 'href', 'target', 'title'];

const SAFE_SELECTOR = /^[^{}<>;\\]{1,300}$/;
const CSS_SAFE_SELECTOR = (s: string) => SAFE_SELECTOR.test(s) && !s.includes('*/');
const STYLE_VALUE = /^[^;{}<>\\]{0,200}$/;
const COLOUR = /^#[0-9a-f]{6}$/i;
const ADJACENT: Record<VisualPosition, string> = {
  before: 'beforebegin',
  after: 'afterend',
  prepend: 'afterbegin',
  append: 'beforeend',
};
const MAX_HTML = 20000;

/** The change as it will be applied, or null when it isn't safe or well formed. */
function check(c: VisualChange): VisualChange | null {
  if (typeof c?.selector !== 'string' || !SAFE_SELECTOR.test(c.selector)) return null;
  switch (c.kind) {
    case 'text':
    case 'html':
    case 'insert':
      if (typeof c.value !== 'string' || c.value.length > MAX_HTML) return null;
      if (c.kind === 'insert' && !(c.position in ADJACENT)) return null;
      return c;
    case 'hide':
      return CSS_SAFE_SELECTOR(c.selector) ? c : null;
    case 'remove':
      return c;
    case 'color':
    case 'background':
      return COLOUR.test(c.value)
        ? {
            selector: c.selector,
            kind: 'style',
            prop: c.kind === 'color' ? 'color' : 'background-color',
            value: c.value,
          }
        : null;
    case 'style':
      return STYLE_PROPS.includes(c.prop) &&
        typeof c.value === 'string' &&
        STYLE_VALUE.test(c.value)
        ? c
        : null;
    case 'attr':
      if (!ATTRIBUTES.includes(c.name) || typeof c.value !== 'string' || c.value.length > 2000)
        return null;
      // Links and images must not run code.
      if (
        (c.name === 'href' || c.name === 'src') &&
        /^\s*(javascript|vbscript|data:text)/i.test(c.value)
      )
        return null;
      return c;
    case 'move':
      return typeof c.target === 'string' && SAFE_SELECTOR.test(c.target) && c.position in ADJACENT
        ? c
        : null;
    default:
      return null;
  }
}

/** The key that makes a later change replace an earlier one on the same element. */
function slot(c: VisualChange): string | null {
  if (c.kind === 'style') return `style:${c.prop}:${c.selector}`;
  if (c.kind === 'attr') return `attr:${c.name}:${c.selector}`;
  if (c.kind === 'text' || c.kind === 'html' || c.kind === 'hide') return `${c.kind}:${c.selector}`;
  return null; // moves, inserts and removals all happen, in order
}

const q = JSON.stringify;

/** JS and CSS for a list of changes, in the order they were made. */
export function visualCode(changes: VisualChange[]): { js: string; css: string } {
  const valid = changes.map(check).filter((c): c is VisualChange => c !== null);
  // Keep only the last change per slot, in its original place.
  const lastIndex = new Map<string, number>();
  valid.forEach((c, i) => {
    const key = slot(c);
    if (key) lastIndex.set(key, i);
  });
  const kept = valid.filter((c, i) => {
    const key = slot(c);
    return !key || lastIndex.get(key) === i;
  });

  const js: string[] = [];
  const css: string[] = [];
  for (const c of kept) {
    const on = (body: string) =>
      `splitcraft.waitForElement(${q(c.selector)}, (el) => {\n  ${body}\n});`;
    switch (c.kind) {
      case 'text':
        js.push(on(`el.textContent = ${q(c.value)};`));
        break;
      case 'html':
        js.push(on(`el.innerHTML = ${q(c.value)};`));
        break;
      case 'remove':
        js.push(on('el.remove();'));
        break;
      case 'style':
        js.push(on(`el.style.setProperty(${q(c.prop)}, ${q(c.value)}, 'important');`));
        break;
      case 'attr':
        js.push(on(`el.setAttribute(${q(c.name)}, ${q(c.value)});`));
        break;
      case 'insert':
        js.push(on(`el.insertAdjacentHTML(${q(ADJACENT[c.position])}, ${q(c.value)});`));
        break;
      case 'move':
        js.push(
          on(
            `splitcraft.waitForElement(${q(c.target)}, (target) => target.insertAdjacentElement(${q(ADJACENT[c.position])}, el));`,
          ),
        );
        break;
      case 'hide':
        css.push(`${c.selector} {\n  display: none !important;\n}`);
        break;
    }
  }
  return {
    js: js.length ? `// Visual editor changes\n${js.join('\n')}\n` : '',
    css: css.length ? `/* Visual editor changes */\n${css.join('\n')}\n` : '',
  };
}

/** Appends generated code to what the editor already has. */
export function appendCode(current: string, added: string): string {
  if (!added) return current;
  return current.trim() ? `${current.replace(/\s*$/, '')}\n\n${added}` : added;
}
