// Visual editor changes (from the preview on the site) turned into variant code. The
// changes come from a web page, so each is checked and every value goes in as data:
// strings through JSON.stringify, colours only as #rrggbb, selectors without characters
// that could end a CSS rule or a comment.

export interface VisualChange {
  selector: string;
  kind: 'text' | 'hide' | 'color' | 'background';
  value?: string;
}

const SAFE_SELECTOR = /^[^{}<>;\\]{1,300}$/;
const COLOUR = /^#[0-9a-f]{6}$/i;

/** JS and CSS for a list of changes; the last change wins per element and kind. */
export function visualCode(changes: VisualChange[]): { js: string; css: string } {
  const last = new Map<string, VisualChange>();
  for (const c of changes) {
    if (!SAFE_SELECTOR.test(c.selector) || c.selector.includes('*/')) continue;
    if ((c.kind === 'color' || c.kind === 'background') && !COLOUR.test(c.value ?? '')) continue;
    if (c.kind === 'text' && (typeof c.value !== 'string' || c.value.length > 2000)) continue;
    last.set(`${c.kind}:${c.selector}`, c);
  }
  const js: string[] = [];
  const css: string[] = [];
  for (const c of last.values()) {
    if (c.kind === 'text')
      js.push(
        `splitcraft.waitForElement(${JSON.stringify(c.selector)}, (el) => {\n  el.textContent = ${JSON.stringify(c.value)};\n});`,
      );
    else if (c.kind === 'hide') css.push(`${c.selector} {\n  display: none !important;\n}`);
    else
      css.push(
        `${c.selector} {\n  ${c.kind === 'color' ? 'color' : 'background-color'}: ${c.value} !important;\n}`,
      );
  }
  const head = (s: string) => `${s} Visual editor changes\n`;
  return {
    js: js.length ? `${head('//')}${js.join('\n')}\n` : '',
    css: css.length ? `${head('/*').replace('\n', ' */\n')}${css.join('\n')}\n` : '',
  };
}

/** Appends generated code to what the editor already has. */
export function appendCode(current: string, added: string): string {
  if (!added) return current;
  return current.trim() ? `${current.replace(/\s*$/, '')}\n\n${added}` : added;
}
