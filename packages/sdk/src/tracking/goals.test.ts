// @vitest-environment jsdom
import { trackClicks, trackPageviews, trackViews } from './goals';

afterEach(() => {
  document.body.innerHTML = '';
  history.replaceState({}, '', '/');
});

describe('trackClicks', () => {
  it('tracks clicks on matching elements and their children', () => {
    document.body.innerHTML = '<button class="book"><span id="label">Book</span></button>';
    const track = vi.fn();
    const stop = trackClicks([{ key: 'book_click', selector: '.book' }], track);
    document.getElementById('label')!.click();
    expect(track).toHaveBeenCalledWith('book_click');
    stop();
  });

  it('supports a comma-separated selector list', () => {
    document.body.innerHTML = '<a id="a" href="#"></a><button id="b"></button>';
    const track = vi.fn();
    const stop = trackClicks([{ key: 'cta', selector: '#a, #b' }], track);
    document.getElementById('a')!.click();
    document.getElementById('b')!.click();
    expect(track).toHaveBeenCalledTimes(2);
    stop();
  });

  it('tracks elements added after it started (SPA re-render)', () => {
    const track = vi.fn();
    const stop = trackClicks([{ key: 'cta', selector: '.late' }], track);
    document.body.innerHTML = '<button class="late"></button>';
    document.querySelector<HTMLButtonElement>('.late')!.click();
    expect(track).toHaveBeenCalledOnce();
    stop();
  });

  it('still tracks when the site stops propagation', () => {
    document.body.innerHTML = '<button class="cta"></button>';
    const button = document.querySelector<HTMLButtonElement>('.cta')!;
    button.addEventListener('click', (e) => e.stopPropagation());
    const track = vi.fn();
    const stop = trackClicks([{ key: 'cta', selector: '.cta' }], track);
    button.click();
    expect(track).toHaveBeenCalledOnce();
    stop();
  });

  it('ignores clicks elsewhere', () => {
    document.body.innerHTML = '<button class="cta"></button><p id="other"></p>';
    const track = vi.fn();
    const stop = trackClicks([{ key: 'cta', selector: '.cta' }], track);
    document.getElementById('other')!.click();
    expect(track).not.toHaveBeenCalled();
    stop();
  });

  it('counts only the first click per page when asked, and resets on navigation', () => {
    document.body.innerHTML = '<button class="cta"></button>';
    const button = document.querySelector<HTMLButtonElement>('.cta')!;
    const track = vi.fn();
    const stop = trackClicks([{ key: 'cta', selector: '.cta', firstPerPage: true }], track);
    button.click();
    button.click();
    expect(track).toHaveBeenCalledOnce();
    history.pushState({}, '', '/next');
    button.click();
    expect(track).toHaveBeenCalledTimes(2);
    stop();
  });

  it('skips an invalid selector without breaking other goals', () => {
    document.body.innerHTML = '<button class="cta"></button>';
    const track = vi.fn();
    const stop = trackClicks(
      [
        { key: 'bad', selector: '::nope(' },
        { key: 'cta', selector: '.cta' },
      ],
      track,
    );
    document.querySelector<HTMLButtonElement>('.cta')!.click();
    expect(track.mock.calls).toEqual([['cta']]);
    stop();
  });

  it('stops tracking after stop()', () => {
    document.body.innerHTML = '<button class="cta"></button>';
    const track = vi.fn();
    trackClicks([{ key: 'cta', selector: '.cta' }], track)();
    document.querySelector<HTMLButtonElement>('.cta')!.click();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('trackPageviews', () => {
  it('fires for the current page when it matches', () => {
    history.replaceState({}, '', '/checkout/done');
    const track = vi.fn();
    const stop = trackPageviews(
      [{ key: 'purchase', url: { op: 'is', value: '/checkout/done' } }],
      track,
    );
    expect(track).toHaveBeenCalledWith('purchase');
    stop();
  });

  it('fires on SPA navigation to a matching page only', () => {
    const track = vi.fn();
    const stop = trackPageviews(
      [{ key: 'trip_view', url: { op: 'matches', value: '/trips/*' } }],
      track,
    );
    expect(track).not.toHaveBeenCalled();
    history.pushState({}, '', '/about');
    history.pushState({}, '', '/trips/lisbon');
    expect(track.mock.calls).toEqual([['trip_view']]);
    stop();
  });
});

describe('runCustomTrackers', () => {
  it('runs tracker code with the helpers on matching pages only, once per page', async () => {
    const { runCustomTrackers } = await import('./goals');
    const trackEvent = vi.fn();
    history.replaceState({}, '', '/trips/norway');
    const stop = runCustomTrackers(
      [
        {
          key: 'add_on',
          code: 'splitcraft.trackEvent("add_on", { value: 12 })',
          pages: [{ op: 'matches', value: '/trips/*' }],
        },
        { key: 'everywhere', code: 'splitcraft.trackEvent("everywhere")' },
      ],
      { trackEvent },
    );
    expect(trackEvent.mock.calls).toEqual([['add_on', { value: 12 }], ['everywhere']]);

    history.pushState({}, '', '/about');
    expect(trackEvent.mock.calls[trackEvent.mock.calls.length - 1]).toEqual(['everywhere']);
    expect(trackEvent).toHaveBeenCalledTimes(3);
    stop();
  });

  it('catches errors in tracker code', async () => {
    const { runCustomTrackers } = await import('./goals');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stop = runCustomTrackers([{ key: 'bad', code: 'undefinedThing()' }], {});
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    stop();
  });
});

describe('click timing', () => {
  it("sends seconds since page load with each page's first click only", () => {
    document.body.innerHTML = '<button class="book"></button>';
    vi.spyOn(performance, 'now').mockReturnValue(2345);
    const track = vi.fn();
    const stop = trackClicks([{ key: 'book', selector: '.book', timing: true }], track);
    document.querySelector<HTMLButtonElement>('.book')!.click();
    document.querySelector<HTMLButtonElement>('.book')!.click();
    expect(track.mock.calls).toEqual([['book', 2.3], ['book']]);
    stop();
    vi.restoreAllMocks();
  });
});

describe('trackViews', () => {
  let observed: Element[];
  let fire: (el: Element) => void;

  beforeEach(() => {
    observed = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly cb: IntersectionObserverCallback) {
          fire = (el) =>
            this.cb(
              [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {
          observed = [];
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends <key>:view once per page when a matching element is seen', () => {
    document.body.innerHTML = '<div class="banner"></div><div class="banner"></div>';
    const track = vi.fn();
    const stop = trackViews([{ key: 'banner', selector: '.banner', views: true }], track);
    expect(observed).toHaveLength(2);
    fire(observed[0]!);
    fire(observed[1]!);
    expect(track.mock.calls).toEqual([['banner:view']]);
    stop();
  });

  it('ignores goals without views', () => {
    document.body.innerHTML = '<div class="banner"></div>';
    const track = vi.fn();
    const stop = trackViews([{ key: 'banner', selector: '.banner' }], track);
    expect(observed).toHaveLength(0);
    stop();
  });

  it('watches elements added later', async () => {
    vi.useFakeTimers();
    const track = vi.fn();
    const stop = trackViews([{ key: 'late', selector: '.late', views: true }], track);
    document.body.innerHTML = '<div class="late"></div>';
    await vi.advanceTimersByTimeAsync(250);
    expect(observed).toHaveLength(1);
    fire(observed[0]!);
    expect(track).toHaveBeenCalledWith('late:view');
    stop();
  });

  it('counts a view again after an SPA navigation', () => {
    document.body.innerHTML = '<div class="banner"></div>';
    const track = vi.fn();
    const stop = trackViews([{ key: 'banner', selector: '.banner', views: true }], track);
    fire(observed[0]!);
    history.pushState({}, '', '/next');
    fire(observed[0]!);
    expect(track).toHaveBeenCalledTimes(2);
    stop();
  });

  it("doesn't break on an invalid selector", () => {
    const stop = trackViews([{ key: 'bad', selector: '[[', views: true }], vi.fn());
    expect(observed).toHaveLength(0);
    stop();
  });
});
