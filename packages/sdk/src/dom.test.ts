import { waitForSelector } from './dom';

/** Fake DOM: a set of "present" selectors plus a MutationObserver the test can trigger. */
function setupDom() {
  const present = new Set<string>();
  const observers = new Set<FakeObserver>();

  class FakeObserver {
    constructor(private readonly cb: () => void) {}
    observe() {
      observers.add(this);
    }
    disconnect() {
      observers.delete(this);
    }
    trigger() {
      this.cb();
    }
  }

  vi.stubGlobal('MutationObserver', FakeObserver);
  vi.stubGlobal('document', {
    documentElement: {},
    querySelector(selector: string) {
      if (selector.startsWith('!')) throw new SyntaxError('invalid selector');
      return present.has(selector) ? ({ selector } as unknown as Element) : null;
    },
  });

  return {
    observers,
    add(selector: string) {
      present.add(selector);
      for (const o of [...observers]) o.trigger();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('waitForSelector', () => {
  it('resolves at once when the element already exists', async () => {
    const dom = setupDom();
    dom.add('#cta');
    await expect(waitForSelector('#cta', 3000)).resolves.toEqual({ selector: '#cta' });
    expect(dom.observers.size).toBe(0);
  });

  it('resolves when the element is added before the timeout', async () => {
    const dom = setupDom();
    const result = waitForSelector('#cta', 3000);
    vi.advanceTimersByTime(1000);
    dom.add('#cta');
    await expect(result).resolves.toEqual({ selector: '#cta' });
    expect(dom.observers.size).toBe(0);
  });

  it('resolves null after the timeout and stops observing', async () => {
    const dom = setupDom();
    const result = waitForSelector('#cta', 3000);
    vi.advanceTimersByTime(3000);
    await expect(result).resolves.toBeNull();
    expect(dom.observers.size).toBe(0);
    dom.add('#cta');
  });

  it('ignores unrelated DOM changes', async () => {
    const dom = setupDom();
    const result = waitForSelector('#cta', 3000);
    dom.add('.other');
    expect(dom.observers.size).toBe(1);
    vi.advanceTimersByTime(3000);
    await expect(result).resolves.toBeNull();
  });

  it('resolves null for an invalid selector', async () => {
    setupDom();
    const result = waitForSelector('!bad', 3000);
    vi.advanceTimersByTime(3000);
    await expect(result).resolves.toBeNull();
  });

  it('does not wait when the timeout is 0', async () => {
    const dom = setupDom();
    await expect(waitForSelector('#cta', 0)).resolves.toBeNull();
    expect(dom.observers.size).toBe(0);
  });
});
