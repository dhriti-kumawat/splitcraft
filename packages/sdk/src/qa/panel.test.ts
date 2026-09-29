// @vitest-environment jsdom
import { mountQaPanel, QA_HOST_ID } from './panel';
import type { QaSource, QaState } from './types';

function fakeSource(initial: QaState) {
  let state = initial;
  const listeners = new Set<() => void>();
  const source: QaSource & { set(next: QaState): void; listeners: Set<() => void> } = {
    listeners,
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    switchVariant: vi.fn(),
    reset: vi.fn(),
    set(next) {
      state = next;
      for (const fn of listeners) fn();
    },
  };
  return source;
}

const designState: QaState = {
  experiments: [
    {
      key: 'trust',
      name: 'Trust badges',
      variantKey: 'b',
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B' },
      ],
      assignedBy: 'forced',
    },
    {
      key: 'sticky',
      name: 'Sticky Book Now bar',
      variantKey: 'control',
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B' },
      ],
      assignedBy: 'bucketed',
    },
  ],
  events: [
    { label: 'exposure · trust · B', sent: true },
    { label: 'trust_badges_seen', sent: true },
    { label: 'book click', sent: false },
  ],
};

const shadow = () => document.getElementById(QA_HOST_ID)!.shadowRoot!;
const text = () => shadow().querySelector('section')!.textContent!;
const button = (name: string) =>
  [...shadow().querySelectorAll('button')].find(
    (b) => b.textContent === name || b.getAttribute('aria-label') === name,
  )!;

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('mountQaPanel', () => {
  it('renders the design content inside a shadow root', () => {
    mountQaPanel(fakeSource(designState));
    expect(shadow().querySelector('section')!.getAttribute('aria-label')).toBe('Splitly QA panel');
    expect(text()).toContain('Splitly QA');
    expect(text()).toContain('forced by URL');
    expect(text()).toContain('Trust badges');
    expect(text()).toContain('B · forced');
    expect(text()).toContain('Control · bucketed');
    expect(text()).toContain('✓ exposure · trust · B');
    expect(text()).toContain('· waiting: book click');
  });

  // jsdom does not scope stylesheets to shadow roots, so CSS isolation itself can only
  // be checked in a real browser. What jsdom can check: the panel's nodes and styles
  // live inside the shadow root, out of reach of site selectors and scripts.
  it('keeps its markup and styles inside the shadow root', () => {
    mountQaPanel(fakeSource(designState));
    expect(document.querySelector('section, button, style')).toBeNull();
    expect(shadow().querySelector('style')!.textContent).toContain(':host{all:initial');
  });

  it('shows "bucketed" in the header when nothing is forced', () => {
    mountQaPanel(fakeSource({ ...designState, experiments: [designState.experiments[1]!] }));
    expect(shadow().querySelector('.mode')!.textContent).toBe('bucketed');
  });

  it('shows empty states', () => {
    mountQaPanel(fakeSource({ experiments: [], events: [] }));
    expect(text()).toContain('No active experiments on this page');
    expect(text()).toContain('No events yet');
    expect(button('Switch variant').disabled).toBe(true);
  });

  it('updates when the state changes', () => {
    const source = fakeSource(designState);
    mountQaPanel(source);
    source.set({
      ...designState,
      events: [...designState.events.slice(0, 2), { label: 'book click', sent: true }],
    });
    expect(text()).toContain('✓ book click');
    expect(text()).not.toContain('waiting');
  });

  it('opens a variant picker per experiment and switches variant', () => {
    const source = fakeSource(designState);
    mountQaPanel(source);
    const toggle = button('Switch variant');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(button('Switch variant').getAttribute('aria-expanded')).toBe('true');

    const select = shadow().querySelector<HTMLSelectElement>(
      'select[aria-label="Variant for Trust badges"]',
    )!;
    expect(select.value).toBe('b');
    select.value = 'control';
    select.dispatchEvent(new Event('change'));
    expect(source.switchVariant).toHaveBeenCalledWith('trust', 'control');
  });

  it('calls reset', () => {
    const source = fakeSource(designState);
    mountQaPanel(source);
    button('Reset').click();
    expect(source.reset).toHaveBeenCalledOnce();
  });

  it('hides and stops listening', () => {
    const source = fakeSource(designState);
    mountQaPanel(source);
    button('Hide QA panel').click();
    expect(document.getElementById(QA_HOST_ID)).toBeNull();
    expect(source.listeners.size).toBe(0);
  });

  it('shows config names as text, never as HTML', () => {
    mountQaPanel(
      fakeSource({
        experiments: [{ ...designState.experiments[0]!, name: '<img src=x onerror=alert(1)>' }],
        events: [],
      }),
    );
    expect(shadow().querySelector('img')).toBeNull();
    expect(text()).toContain('<img src=x onerror=alert(1)>');
  });

  it('replaces an existing panel instead of adding a second one', () => {
    mountQaPanel(fakeSource(designState));
    mountQaPanel(fakeSource(designState));
    expect(document.querySelectorAll(`#${QA_HOST_ID}`)).toHaveLength(1);
  });

  it('uses real buttons with accessible names', () => {
    mountQaPanel(fakeSource(designState));
    for (const b of shadow().querySelectorAll('button')) {
      expect(b.getAttribute('type')).toBe('button');
      expect(b.textContent || b.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
