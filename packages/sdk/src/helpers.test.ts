// @vitest-environment jsdom
import { injectStyles, onceInView, waitForElement } from './helpers';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('waitForElement', () => {
  it('calls back with an element that already exists', async () => {
    document.body.innerHTML = '<button id="cta">Book</button>';
    const fn = vi.fn();
    waitForElement('#cta', fn);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(document.getElementById('cta')));
  });

  it('calls back when the element is added later', async () => {
    const fn = vi.fn();
    waitForElement('.price', fn);
    const price = document.createElement('span');
    price.className = 'price';
    document.body.appendChild(price);
    await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(price));
  });

  it('never calls back when the element does not appear in time', async () => {
    const fn = vi.fn();
    waitForElement('#missing', fn, { timeout: 20 });
    await new Promise((r) => setTimeout(r, 40));
    document.body.innerHTML = '<div id="missing"></div>';
    await new Promise((r) => setTimeout(r, 10));
    expect(fn).not.toHaveBeenCalled();
  });

  it('catches errors thrown by the callback', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<div id="x"></div>';
    waitForElement('#x', () => {
      throw new Error('variant bug');
    });
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
  });
});

describe('onceInView', () => {
  function stubIntersectionObserver() {
    const instances: Array<{ fire: (visible: boolean) => void; disconnected: boolean }> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnected = false;
        constructor(private readonly cb: IntersectionObserverCallback) {
          instances.push(this);
        }
        observe() {}
        disconnect() {
          this.disconnected = true;
        }
        fire(visible: boolean) {
          this.cb(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        }
      },
    );
    return instances;
  }

  it('calls back once, the first time the element is visible', () => {
    const observers = stubIntersectionObserver();
    const fn = vi.fn();
    onceInView(document.body, fn);
    observers[0]!.fire(false);
    expect(fn).not.toHaveBeenCalled();
    observers[0]!.fire(true);
    expect(fn).toHaveBeenCalledOnce();
    expect(observers[0]!.disconnected).toBe(true);
  });

  it('calls back at once when IntersectionObserver is not available', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const fn = vi.fn();
    onceInView(document.body, fn);
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('injectStyles', () => {
  it('adds a style element to the head', () => {
    injectStyles('.cta{color:red}');
    const style = document.head.querySelector('style[data-splitly]');
    expect(style?.textContent).toBe('.cta{color:red}');
  });

  it('replaces the CSS when called again with the same id', () => {
    injectStyles('.a{}', 'exp-1');
    injectStyles('.b{}', 'exp-1');
    const styles = document.head.querySelectorAll('#exp-1');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toBe('.b{}');
  });

  it('returns a function that removes the style', () => {
    const remove = injectStyles('.a{}', 'exp-2');
    remove();
    expect(document.getElementById('exp-2')).toBeNull();
  });
});
