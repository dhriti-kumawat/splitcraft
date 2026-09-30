// @vitest-environment jsdom
import { nav } from '../split';
import { createPreview, OWNED } from './controller';
import type { PreviewState } from './types';

const state = (over: Partial<PreviewState> = {}): PreviewState => ({
  experimentKey: 'hero',
  experimentName: 'Hero test',
  variants: [
    { key: 'control', name: 'Control' },
    { key: 'b', name: 'Big hero', css: '.hero{color:red}', js: 'document.body.dataset.b = "1"' },
  ],
  variantKey: 'b',
  source: 'live',
  ...over,
});
const panel = () => document.getElementById('splitcraft-preview')!.shadowRoot!;
const sheets = () => [...document.querySelectorAll('style[data-splitcraft-preview]')];
const owned = () => (window as unknown as Record<string, Record<string, boolean>>)[OWNED];

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete document.body.dataset.b;
  vi.restoreAllMocks();
});

describe('preview controller', () => {
  it('applies the variant, marks the experiment as owned and shows the panel', () => {
    const p = createPreview();
    p.start(state());
    expect(document.body.dataset.b).toBe('1');
    expect(sheets().map((s) => s.textContent)).toContain('.hero{color:red}');
    expect(owned()?.hero).toBe(true);
    expect(panel().textContent).toContain('Hero test');
    expect(panel().textContent).toContain('live from dashboard');
    const pressed = panel().querySelector('button[aria-pressed="true"]');
    expect(pressed?.textContent).toBe('Big hero');
    p.stop();
    expect(owned()?.hero).toBeUndefined();
    expect(document.getElementById('splitcraft-preview')).toBeNull();
    expect(sheets().some((s) => s.textContent === '.hero{color:red}')).toBe(false);
  });

  it('applies CSS edits in place and asks for a rerun when JS changes', () => {
    const p = createPreview();
    p.start(state());
    const edited = state();
    edited.variants[1] = { ...edited.variants[1]!, css: '.hero{color:blue}' };
    expect(p.update(edited)).toBe('live');
    expect(sheets().map((s) => s.textContent)).toContain('.hero{color:blue}');
    expect(sheets().map((s) => s.textContent)).not.toContain('.hero{color:red}');

    const js = state();
    js.variants[1] = { ...js.variants[1]!, js: 'document.body.dataset.b = "2"' };
    expect(p.update(js)).toBe('rerun');
    p.rerun();
    expect(document.body.dataset.b).toBe('2');
    expect(p.update(state({ variantKey: 'control' }))).toBe('rerun');
    p.stop();
  });

  it('sends panel actions to the caller', () => {
    const onAction = vi.fn();
    const p = createPreview();
    p.start(state(), { onAction });
    panel().querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!.click();
    expect(onAction).toHaveBeenCalledWith({ type: 'switch', variantKey: 'control' });
    [...panel().querySelectorAll('button')].find((b) => b.textContent === 'Stop preview')!.click();
    expect(onAction).toHaveBeenCalledWith({ type: 'stop' });
    p.stop();
  });

  it('shows JS errors and leaves JS to the extension when it runs it', () => {
    const p = createPreview();
    p.start(state({ variants: [{ key: 'b', name: 'B', js: 'throw new Error("boom")' }] }));
    expect(panel().querySelector('[role=alert]')?.textContent).toBe('JS error: boom');
    p.stop();
    const q = createPreview();
    q.start(state(), { externalJs: true });
    expect(document.body.dataset.b).toBeUndefined();
    q.stop();
  });

  it('opens a split URL variant page instead of applying code', () => {
    const go = vi.spyOn(nav, 'go').mockImplementation(() => {});
    const p = createPreview();
    p.start(state({ variants: [{ key: 'b', name: 'B', url: 'https://shop.test/b' }] }));
    expect(go).toHaveBeenCalledWith('https://shop.test/b');
    p.stop();
  });
});
