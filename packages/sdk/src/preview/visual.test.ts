// @vitest-environment jsdom
import { createPreview } from './controller';
import { PANEL_ID } from './panel';
import { perform, selectorFor, startVisual } from './visual';
import type { VisualChange } from './types';

const ui = () => document.getElementById('splitcraft-visual')!.shadowRoot!;
const button = (name: string) =>
  [...ui().querySelectorAll('button')].find((b) => b.textContent === name)!;
const input = (label: string) =>
  ui().querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[aria-label="${label}"]`,
  )!;
const click = (node: Element) =>
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const change = (
  node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) => {
  node.value = value;
  node.dispatchEvent(new Event('change'));
};

// Editors a test leaves open (when it fails) must not leak into the next one.
let close: (() => void) | undefined;
const open = (onDone: (c: VisualChange[]) => void) => (close = startVisual({ onDone }));
afterEach(() => close?.());

beforeEach(() => {
  document.body.innerHTML = `
    <header><h1 class="title big">Trips</h1></header>
    <main>
      <p>One</p><p class="promo">Two <b>bold</b></p>
      <a id="cta" class="btn" href="/book">Book</a>
      <img class="hero" src="/a.jpg" alt="Lake">
      <ul class="list"><li>A</li><li>B</li><li>C</li></ul>
    </main>`;
});

describe('selectorFor', () => {
  it('uses a unique id, else a short path that finds the element', () => {
    expect(selectorFor(document.getElementById('cta')!)).toBe('#cta');
    const second = document.querySelectorAll('p')[1]!;
    expect(document.querySelector(selectorFor(second))).toBe(second);
    expect(selectorFor(document.querySelector('h1')!)).toBe('h1.title.big');
  });
});

describe('perform', () => {
  it('applies each kind of change and undoes it exactly', () => {
    const before = document.body.innerHTML;
    const changes: VisualChange[] = [
      { selector: 'h1', kind: 'text', value: 'New' },
      { selector: '.promo', kind: 'html', value: '<i>x</i>' },
      { selector: '#cta', kind: 'style', prop: 'color', value: 'rgb(1, 2, 3)' },
      { selector: 'img', kind: 'attr', name: 'alt', value: 'Fjord' },
      {
        selector: '.list li:nth-of-type(3)',
        kind: 'move',
        target: '.list li:nth-of-type(1)',
        position: 'before',
      },
      {
        selector: '#cta',
        kind: 'insert',
        value: '<em>Free</em><script>window.x=1</script>',
        position: 'after',
      },
      { selector: 'p', kind: 'hide' },
      { selector: 'header', kind: 'remove' },
    ];
    const undos = changes.map((c) => perform(c)!);
    expect(document.querySelector('header')).toBeNull();
    expect([...document.querySelectorAll('.list li')].map((l) => l.textContent)).toEqual([
      'C',
      'A',
      'B',
    ]);
    expect(document.querySelector('#cta + em')?.textContent).toBe('Free');
    expect((window as unknown as { x?: number }).x).toBeUndefined();
    expect((document.querySelector('#cta') as HTMLElement).style.getPropertyPriority('color')).toBe(
      'important',
    );
    for (const undo of undos.reverse()) undo();
    expect(document.body.innerHTML.replace(/ style=""/g, '')).toBe(before);
  });

  it('returns null when the element is missing or a move would nest it in itself', () => {
    expect(perform({ selector: '.nope', kind: 'hide' })).toBeNull();
    expect(
      perform({ selector: 'main', kind: 'move', target: '#cta', position: 'append' }),
    ).toBeNull();
  });
});

describe('visual editor', () => {
  it('selects, steps to parents and children, and edits content, style and links', () => {
    const onDone = vi.fn();
    open(onDone);
    expect(ui().textContent).toContain('Click any element on the page to change it.');

    click(document.querySelector('.promo b')!);
    expect(input('Selector').value).toBe('b');
    click(button('Parent'));
    expect(input('Selector').value).toBe('p.promo');
    click(button('Child'));
    expect(input('Selector').value).toBe('b');

    click(document.querySelector('h1')!);
    change(input('Text') as HTMLTextAreaElement, 'Trips you will love');
    click(button('Apply text'));
    expect(document.querySelector('h1')!.textContent).toBe('Trips you will love');
    change(input('Font size') as HTMLInputElement, '48px');
    expect(document.querySelector('h1')!.style.fontSize).toBe('48px');

    click(document.getElementById('cta')!);
    expect(ui().textContent).toContain('Link');
    change(input('Link URL') as HTMLInputElement, '/deals');
    expect(document.getElementById('cta')!.getAttribute('href')).toBe('/deals');

    click(button('Done (3)'));
    expect(onDone).toHaveBeenCalledWith([
      { selector: 'h1.title.big', kind: 'text', value: 'Trips you will love' },
      { selector: 'h1.title.big', kind: 'style', prop: 'font-size', value: '48px' },
      { selector: '#cta', kind: 'attr', name: 'href', value: '/deals' },
    ]);
    expect(document.getElementById('splitcraft-visual')).toBeNull();
  });

  it('moves by picking a destination, inserts HTML, and hides and removes', () => {
    const onDone = vi.fn();
    open(onDone);
    click(document.querySelector('img')!);
    change(input('Move position') as HTMLSelectElement, 'before');
    click(button('Pick where'));
    expect(ui().textContent).toContain('Click the element to move it next to');
    click(document.querySelector('h1')!);
    expect(document.querySelector('header')!.firstElementChild!.tagName).toBe('IMG');

    click(document.querySelector('.list li')!);
    click(button('Move down'));
    expect([...document.querySelectorAll('.list li')].map((l) => l.textContent)).toEqual([
      'B',
      'A',
      'C',
    ]);

    click(document.querySelector('.list')!);
    change(input('HTML to insert') as HTMLTextAreaElement, '<p class="note">Hi</p>');
    click(button('Insert'));
    expect(document.querySelector('.list + .note')).not.toBeNull();

    click(document.querySelector('.promo')!);
    click(button('Hide'));
    expect((document.querySelector('.promo') as HTMLElement).style.display).toBe('none');
    click(button('Remove'));
    expect(document.querySelector('.promo')).toBeNull();
    expect(ui().textContent).toContain('Click any element');

    click(button('Done (5)'));
    expect(onDone.mock.calls[0]![0].map((c: VisualChange) => c.kind)).toEqual([
      'move',
      'move',
      'insert',
      'hide',
      'remove',
    ]);
  });

  it('undoes, redoes and cancels everything', () => {
    const onDone = vi.fn();
    open(onDone);
    click(document.querySelector('h1')!);
    click(button('Hide'));
    click(button('Undo'));
    expect(document.querySelector('h1')!.style.display).toBe('');
    click(button('Redo'));
    expect(document.querySelector('h1')!.style.display).toBe('none');
    click(button('Cancel'));
    expect(document.querySelector('h1')!.style.display).toBe('');
    expect(onDone).toHaveBeenCalledWith([]);
  });

  it('leaves the page alone in Interactive mode and keeps links from navigating otherwise', () => {
    open(() => {});
    const link = document.getElementById('cta')!;
    const blocked = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    click(button('Interactive'));
    const free = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
    click(button('Cancel'));
  });

  it('starts from the preview panel, hides it while editing, and sends the changes', () => {
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
    const panelHost = document.getElementById(PANEL_ID)!;
    const edit = [...panelHost.shadowRoot!.querySelectorAll('button')].find(
      (b) => b.textContent === 'Edit visually',
    )!;
    edit.click();
    expect(panelHost.style.display).toBe('none');
    click(document.getElementById('cta')!);
    click(button('Hide'));
    click(button('Done (1)'));
    expect(panelHost.style.display).toBe('');
    expect(onAction).toHaveBeenCalledWith({
      type: 'visual',
      variantKey: 'b',
      changes: [{ selector: '#cta', kind: 'hide' }],
    });
    expect(panelHost.shadowRoot!.textContent).toContain('1 visual change sent to the dashboard');
    api.stop();
  });

  it('is not offered for saved previews or the original, and opens at once when asked', () => {
    const api = createPreview();
    const state = {
      experimentKey: 'hero',
      experimentName: 'Hero',
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B' },
      ],
      variantKey: 'control',
      source: 'live' as const,
    };
    api.start(state);
    expect(document.getElementById(PANEL_ID)!.shadowRoot!.textContent).not.toContain(
      'Edit visually',
    );
    api.stop();
    const again = createPreview();
    again.start({ ...state, variantKey: 'b', visual: true });
    expect(document.getElementById('splitcraft-visual')).not.toBeNull();
    again.stop();
    expect(document.getElementById('splitcraft-visual')).toBeNull();
  });
});
