// @vitest-environment jsdom
import { createQueue, send, type TrackedEvent } from './transport';

const event = (n: number): TrackedEvent => ({
  type: 'goal',
  key: `k${n}`,
  url: 'https://mytrips.dev/',
  visitorId: 'v_1',
  at: n,
});

async function bodyOf(blob: Blob): Promise<{ projectKey: string; events: TrackedEvent[] }> {
  return JSON.parse(await blob.text());
}

let beacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  beacon = vi.fn(() => true);
  fetchMock = vi.fn(() => Promise.resolve(new Response()));
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('send', () => {
  it('uses sendBeacon with a text/plain body', async () => {
    send('https://api.splitcraft.app/e', '{"a":1}');
    expect(beacon).toHaveBeenCalledOnce();
    const [url, blob] = beacon.mock.calls[0]!;
    expect(url).toBe('https://api.splitcraft.app/e');
    expect((blob as Blob).type).toBe('text/plain;charset=utf-8');
    expect(await (blob as Blob).text()).toBe('{"a":1}');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to fetch with keepalive when sendBeacon refuses', () => {
    beacon.mockReturnValue(false);
    send('https://api.splitcraft.app/e', '{}');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.splitcraft.app/e',
      expect.objectContaining({ method: 'POST', body: '{}', keepalive: true, credentials: 'omit' }),
    );
  });

  it('falls back to fetch when sendBeacon throws or is missing', () => {
    beacon.mockImplementation(() => {
      throw new TypeError('blocked');
    });
    send('/e', '{}');
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    send('/e', '{}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws when the network fails', async () => {
    beacon.mockReturnValue(false);
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(() => send('/e', '{}')).not.toThrow();
    await vi.runAllTimersAsync();
  });
});

describe('createQueue', () => {
  it('batches events and sends them after flushMs', async () => {
    const q = createQueue({ endpoint: '/e', projectKey: 'prj_1', flushMs: 1000 });
    q.push(event(1));
    q.push(event(2));
    expect(beacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(beacon).toHaveBeenCalledOnce();
    const body = await bodyOf(beacon.mock.calls[0]![1] as Blob);
    expect(body.projectKey).toBe('prj_1');
    expect(body.events.map((e) => e.key)).toEqual(['k1', 'k2']);
    q.stop();
  });

  it('sends at once when the batch is full', () => {
    const q = createQueue({ endpoint: '/e', projectKey: 'prj_1', maxBatch: 3 });
    for (let i = 0; i < 3; i++) q.push(event(i));
    expect(beacon).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(5000);
    expect(beacon).toHaveBeenCalledOnce();
    q.stop();
  });

  it('sends waiting events when the page is hidden', () => {
    const q = createQueue({ endpoint: '/e', projectKey: 'prj_1' });
    q.push(event(1));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    q.stop();
  });

  it('sends waiting events on pagehide', () => {
    const q = createQueue({ endpoint: '/e', projectKey: 'prj_1' });
    q.push(event(1));
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledOnce();
    q.stop();
  });

  it('sends nothing when empty', () => {
    const q = createQueue({ endpoint: '/e', projectKey: 'prj_1' });
    q.flush();
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).not.toHaveBeenCalled();
    q.stop();
  });

  it('stop sends what is waiting and removes page listeners', () => {
    const q = createQueue({ endpoint: '/e', projectKey: 'prj_1' });
    q.push(event(1));
    q.stop();
    expect(beacon).toHaveBeenCalledOnce();
    q.push(event(2));
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledOnce();
  });
});
