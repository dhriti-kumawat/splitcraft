// @vitest-environment jsdom
import { trackVitals } from './vitals';

type Cb = (list: { getEntries(): PerformanceEntry[] }) => void;
let observers: Record<string, Cb>;
let visibility: DocumentVisibilityState;

beforeEach(() => {
  observers = {};
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      constructor(private cb: Cb) {}
      observe(o: { type: string }) {
        observers[o.type] = this.cb;
      }
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const emit = (type: string, ...entries: Array<Record<string, unknown>>) =>
  observers[type]!({ getEntries: () => entries as unknown as PerformanceEntry[] });
const hide = () => {
  visibility = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('trackVitals', () => {
  it('reports LCP, INP and CLS once when the page is hidden', () => {
    const track = vi.fn();
    trackVitals(['lcp', 'inp', 'cls'], track);
    emit('largest-contentful-paint', { startTime: 900 }, { startTime: 1840.6 });
    emit('event', { duration: 80, interactionId: 1 }, { duration: 300, interactionId: 0 });
    emit(
      'layout-shift',
      { startTime: 100, value: 0.05, hadRecentInput: false },
      { startTime: 400, value: 0.04, hadRecentInput: false },
      { startTime: 500, value: 0.5, hadRecentInput: true },
      { startTime: 3000, value: 0.02, hadRecentInput: false },
    );
    hide();
    hide();
    expect(track.mock.calls).toEqual([
      ['vitals.lcp', { value: 1841 }],
      ['vitals.inp', { value: 80 }],
      ['vitals.cls', { value: 0.09 }],
    ]);
  });

  it('does nothing without vitals or PerformanceObserver', () => {
    const track = vi.fn();
    trackVitals([], track)();
    vi.stubGlobal('PerformanceObserver', undefined);
    trackVitals(['lcp'], track)();
    expect(track).not.toHaveBeenCalled();
  });
});
