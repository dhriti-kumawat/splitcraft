// @vitest-environment jsdom
import { trackClicks, trackPageviews } from './goals';

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
