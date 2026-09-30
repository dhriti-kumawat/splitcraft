// @vitest-environment jsdom
import { trackDataLayer, watchDataLayer } from './dataLayerGoals';

const dl = () => (window as unknown as { dataLayer: unknown[] }).dataLayer;

beforeEach(() => {
  delete (window as unknown as { dataLayer?: unknown[] }).dataLayer;
  localStorage.clear();
});

describe('watchDataLayer', () => {
  it('sees entries already there and later pushes, and skips its own', () => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [{ event: 'gtm.js' }];
    const seen: unknown[] = [];
    const stop = watchDataLayer((e) => seen.push(e.event));
    dl().push({ event: 'add_to_cart' }, { event: 'splitcraft_exposure' }, 'not an object');
    expect(seen).toEqual(['gtm.js', 'add_to_cart']);
    expect(dl()).toHaveLength(4);
    stop();
    dl().push({ event: 'after' });
    expect(seen).not.toContain('after');
  });
});

describe('trackDataLayer', () => {
  it('fires a dataLayer goal when the event and filters match, with its value', () => {
    const track = vi.fn();
    const stop = trackDataLayer(
      [
        {
          key: 'cart_inr',
          event: 'add_to_cart',
          filters: [{ path: 'ecommerce.currency', op: 'is', value: 'INR' }],
          valuePath: 'ecommerce.value',
        },
      ],
      [],
      track,
    );
    dl().push({ event: 'add_to_cart', ecommerce: { currency: 'USD', value: 5 } });
    dl().push({ event: 'add_to_cart', ecommerce: { currency: 'INR', value: '499' } });
    dl().push({ event: 'view_item', ecommerce: { currency: 'INR' } });
    expect(track.mock.calls).toEqual([['cart_inr', { value: 499 }]]);
    stop();
  });

  it('counts each transaction once, with value, id and currency', () => {
    const track = vi.fn();
    const goal = {
      key: 'purchase',
      event: 'purchase',
      valuePath: 'ecommerce.value',
      idPath: 'ecommerce.transaction_id',
      currencyPath: 'ecommerce.currency',
    };
    const order = {
      event: 'purchase',
      ecommerce: { transaction_id: 'T-100', value: 120.5, currency: 'INR' },
    };
    let stop = trackDataLayer([], [goal], track);
    dl().push(order);
    dl().push(order);
    stop();
    // A reload of the thank-you page: the same order again.
    stop = trackDataLayer([], [goal], track);
    expect(track.mock.calls).toEqual([
      ['purchase', { value: 120.5, transaction_id: 'T-100', currency: 'INR' }],
    ]);
    dl().push({ event: 'purchase', ecommerce: { transaction_id: 'T-101', value: 'n/a' } });
    expect(track).toHaveBeenLastCalledWith('purchase', { transaction_id: 'T-101' });
    stop();
  });

  it('does nothing without goals', () => {
    trackDataLayer([], [], vi.fn())();
    expect((window as unknown as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
  });
});
