// @vitest-environment jsdom
import { ANTIFLICKER_ID, hidePage } from './antiflicker';

const hidden = () => document.getElementById(ANTIFLICKER_ID) !== null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.head.innerHTML = '';
});

describe('hidePage', () => {
  it('hides the body until reveal is called', () => {
    const reveal = hidePage();
    expect(hidden()).toBe(true);
    expect(getComputedStyle(document.body).opacity).toBe('0');
    reveal();
    expect(hidden()).toBe(false);
  });

  it('reveals the page by itself after 400 ms', () => {
    hidePage();
    vi.advanceTimersByTime(399);
    expect(hidden()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hidden()).toBe(false);
  });

  it('never hides for longer than 400 ms, even if asked to', () => {
    hidePage(5000);
    vi.advanceTimersByTime(400);
    expect(hidden()).toBe(false);
  });

  it('allows a shorter cap', () => {
    hidePage(100);
    vi.advanceTimersByTime(100);
    expect(hidden()).toBe(false);
  });

  it('is safe to reveal twice', () => {
    const reveal = hidePage();
    reveal();
    expect(() => reveal()).not.toThrow();
    vi.advanceTimersByTime(400);
    expect(hidden()).toBe(false);
  });
});
