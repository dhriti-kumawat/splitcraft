// @vitest-environment jsdom
import { trackBrowsing } from './browsing';

let visibility: DocumentVisibilityState = 'visible';
beforeEach(() => {
  sessionStorage.clear();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const hide = () => {
  visibility = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('trackBrowsing', () => {
  it('counts pages and time on the page, capped and only while visible', () => {
    const track = vi.fn();
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const stop = trackBrowsing(['pages', 'time'], track, () => ({ n: 1, p: 1 }));
    now.mockReturnValue(42_400);
    hide();
    expect(track.mock.calls).toEqual([['browse.page'], ['browse.time', { value: 42 }]]);
    stop();
  });

  it('marks a session engaged after 10 s or on the 2nd page, once', () => {
    const track = vi.fn();
    let p = 1;
    const stop = trackBrowsing(['engaged'], track, () => ({ n: 1, p }));
    vi.advanceTimersByTime(9_000);
    expect(track).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(track).toHaveBeenCalledWith('browse.engaged');
    p = 2;
    history.pushState({}, '', '/next');
    vi.advanceTimersByTime(20_000);
    expect(track).toHaveBeenCalledTimes(1);
    stop();
  });

  it('counts a returning visit once per session', () => {
    const track = vi.fn();
    trackBrowsing(['return'], track, () => ({ n: 3, p: 1 }))();
    trackBrowsing(['return'], track, () => ({ n: 3, p: 1 }))();
    trackBrowsing(['return'], track, () => ({ n: 1, p: 1 }))();
    expect(track.mock.calls).toEqual([['browse.return']]);
  });
});
