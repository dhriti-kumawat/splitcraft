// @vitest-environment jsdom
import { createPreview } from './controller';
import { PANEL_ID } from './panel';
import { selectorFor, startVisual } from './visual';

const bar = () => document.getElementById('splitcraft-visual')!.shadowRoot!;
const button = (root: ShadowRoot, name: RegExp) =>
  [...root.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''))!;

beforeEach(() => {
  document.body.innerHTML = `
    <header><h1 class="title big">Trips</h1></header>
    <main><p>One</p><p class="promo">Two <b>bold</b></p><a id="cta" class="btn">Book</a></main>`;
});

describe('selectorFor', () => {
  it('uses a unique id, else a short path that finds the element', () => {
    expect(selectorFor(document.getElementById('cta')!)).toBe('#cta');
    const second = document.querySelectorAll('p')[1]!;
    const sel = selectorFor(second);
    expect(document.querySelector(sel)).toBe(second);
    expect(selectorFor(document.querySelector('h1')!)).toBe('h1.title.big');
  });
});

describe('visual editor', () => {
  it('selects by click, applies changes on the page and returns them on Done', () => {
    const onDone = vi.fn();
    startVisual({ onDone });
    const h1 = document.querySelector('h1')!;
    h1.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(bar().querySelector('code')!.textContent).toBe('h1.title.big');

    const colour = bar().querySelector<HTMLInputElement>('input[aria-label="Text"]')!;
    colour.value = '#0f6b57';
    colour.dispatchEvent(new Event('input'));
    expect(h1.style.color).toBe('rgb(15, 107, 87)');

    button(bar(), /Edit text/).click();
    expect(h1.isContentEditable || h1.contentEditable === 'true').toBe(true);
    h1.textContent = 'Trips you will love';
    h1.dispatchEvent(new FocusEvent('blur'));

    document.querySelector('.promo')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(button(bar(), /Edit text/).disabled).toBe(true);
    button(bar(), /Hide/).click();
    expect((document.querySelector('.promo') as HTMLElement).style.display).toBe('none');

    button(bar(), /Done \(3\)/).click();
    expect(onDone).toHaveBeenCalledWith([
      { selector: 'h1.title.big', kind: 'color', value: '#0f6b57' },
      { selector: 'h1.title.big', kind: 'text', value: 'Trips you will love' },
      { selector: expect.stringContaining('p.promo'), kind: 'hide' },
    ]);
    expect(document.getElementById('splitcraft-visual')).toBeNull();
  });

  it('starts from the preview panel and sends the changes as a visual action', () => {
    const onAction = vi.fn();
    const api = createPreview();
    api.start(
      {
        experimentKey: 'hero',
        experimentName: 'Hero',
        variants: [
          { key: 'control', name: 'Control' },
          { key: 'b', name: 'B' },
        ],
        variantKey: 'b',
        source: 'live',
      },
      { onAction },
    );
    const panel = document.getElementById(PANEL_ID)!.shadowRoot!;
    button(panel, /Edit visually/).click();
    document.getElementById('cta')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button(bar(), /Hide/).click();
    button(bar(), /Done/).click();
    expect(onAction).toHaveBeenCalledWith({
      type: 'visual',
      variantKey: 'b',
      changes: [{ selector: '#cta', kind: 'hide' }],
    });
    expect(panel.textContent).toContain('1 visual change sent to the dashboard');
    api.stop();
  });

  it('is not offered for saved previews or the original', () => {
    const api = createPreview();
    api.start({
      experimentKey: 'hero',
      experimentName: 'Hero',
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B' },
      ],
      variantKey: 'control',
      source: 'live',
    });
    expect(document.getElementById(PANEL_ID)!.shadowRoot!.textContent).not.toContain(
      'Edit visually',
    );
    api.stop();
  });
});

describe('opened with "Edit visually"', () => {
  it('starts the visual editor straight away on the variation', () => {
    const api = createPreview();
    api.start({
      experimentKey: 'hero',
      experimentName: 'Hero',
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B' },
      ],
      variantKey: 'b',
      source: 'live',
      visual: true,
    });
    expect(document.getElementById('splitcraft-visual')).not.toBeNull();
    api.stop();
    expect(document.getElementById('splitcraft-visual')).toBeNull();
  });
});
