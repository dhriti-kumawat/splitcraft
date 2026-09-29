// @vitest-environment jsdom
import { onRouteChange } from './router';

describe('onRouteChange', () => {
  it('fires on pushState and replaceState with the new URL', () => {
    const fn = vi.fn();
    const off = onRouteChange(fn);
    history.pushState({}, '', '/trips');
    history.replaceState({}, '', '/trips?page=2');
    expect(fn.mock.calls).toEqual([
      [`${location.origin}/trips`],
      [`${location.origin}/trips?page=2`],
    ]);
    off();
  });

  it('fires on back/forward (popstate)', async () => {
    history.pushState({}, '', '/one');
    history.pushState({}, '', '/two');
    const fn = vi.fn();
    const off = onRouteChange(fn);
    const popped = new Promise((resolve) => addEventListener('popstate', resolve, { once: true }));
    history.back();
    await popped;
    expect(fn).toHaveBeenCalledWith(`${location.origin}/one`);
    off();
  });

  it('ignores updates that keep the same URL', () => {
    history.pushState({}, '', '/same');
    const fn = vi.fn();
    const off = onRouteChange(fn);
    history.pushState({ x: 1 }, '', '/same');
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it('stops calling a listener after unsubscribe', () => {
    const fn = vi.fn();
    const off = onRouteChange(fn);
    off();
    history.pushState({}, '', '/after-off');
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps notifying other listeners when one throws', () => {
    const bad = onRouteChange(() => {
      throw new Error('broken');
    });
    const fn = vi.fn();
    const off = onRouteChange(fn);
    history.pushState({}, '', '/next');
    expect(fn).toHaveBeenCalledOnce();
    bad();
    off();
  });

  it('keeps pushState working for the site', () => {
    history.pushState({ id: 7 }, '', '/state');
    expect(history.state).toEqual({ id: 7 });
    expect(location.pathname).toBe('/state');
  });
});
