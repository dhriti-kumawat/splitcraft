// @vitest-environment jsdom
import { createTracker } from './tracker';
import type { EventQueue, TrackedEvent } from './transport';

function fakeQueue() {
  const events: TrackedEvent[] = [];
  const queue: EventQueue = { push: (e) => events.push(e), flush() {}, stop() {} };
  return { queue, events };
}

const dataLayer = () => (window as unknown as { dataLayer: unknown[] }).dataLayer;

beforeEach(() => {
  delete (window as unknown as { dataLayer?: unknown[] }).dataLayer;
  history.replaceState({}, '', '/');
});

describe('exposure', () => {
  it('sends one exposure per page per experiment', () => {
    const { queue, events } = fakeQueue();
    const t = createTracker(queue, 'v_1');
    expect(t.exposure('checkout-cta', 'b')).toBe(true);
    expect(t.exposure('checkout-cta', 'b')).toBe(false);
    expect(t.exposure('hero-copy', 'control')).toBe(true);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'exposure',
      experimentKey: 'checkout-cta',
      variantKey: 'b',
      visitorId: 'v_1',
      url: location.href,
    });
  });

  it('sends again on a new page', () => {
    const { queue, events } = fakeQueue();
    const t = createTracker(queue, 'v_1');
    t.exposure('checkout-cta', 'b');
    history.pushState({}, '', '/trips');
    t.exposure('checkout-cta', 'b');
    expect(events).toHaveLength(2);
    expect(events[1]!.url).toBe(`${location.origin}/trips`);
  });

  it('pushes to dataLayer, creating it if needed', () => {
    const t = createTracker(fakeQueue().queue, 'v_1');
    t.exposure('checkout-cta', 'b');
    expect(dataLayer()).toEqual([
      { event: 'splitly_exposure', splitly: { experimentKey: 'checkout-cta', variantKey: 'b' } },
    ]);
  });

  it('keeps the existing dataLayer entries', () => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [{ event: 'gtm.js' }];
    createTracker(fakeQueue().queue, 'v_1').exposure('x', 'b');
    expect(dataLayer()).toHaveLength(2);
  });
});

describe('trackEvent', () => {
  it('sends a goal event with value and other props', () => {
    const { queue, events } = fakeQueue();
    createTracker(queue, 'v_1').trackEvent('purchase', { value: 49.5, currency: 'GBP' });
    expect(events[0]).toMatchObject({
      type: 'goal',
      key: 'purchase',
      value: 49.5,
      props: { currency: 'GBP' },
    });
    expect(dataLayer()).toEqual([
      { event: 'splitly_event', splitly: { key: 'purchase', value: 49.5 } },
    ]);
  });

  it('drops values that are not finite numbers', () => {
    const { queue, events } = fakeQueue();
    const t = createTracker(queue, 'v_1');
    t.trackEvent('a', { value: NaN });
    t.trackEvent('b', { value: Infinity });
    t.trackEvent('c', { value: '12' as unknown as number });
    for (const e of events) expect(e).not.toHaveProperty('value');
  });

  it('omits props when only value is given', () => {
    const { queue, events } = fakeQueue();
    createTracker(queue, 'v_1').trackEvent('signup');
    expect(events[0]).not.toHaveProperty('props');
  });

  it('ignores an empty or non-string key', () => {
    const { queue, events } = fakeQueue();
    const t = createTracker(queue, 'v_1');
    t.trackEvent('');
    t.trackEvent(undefined as unknown as string);
    expect(events).toHaveLength(0);
  });
});
