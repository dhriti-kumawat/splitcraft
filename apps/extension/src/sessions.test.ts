import { currentJs, hostAllowed, userScriptCode } from './sessions';

describe('hostAllowed', () => {
  it('follows the project domains and www.', () => {
    const hosts = ['shop.test', '*.cdn.test', 'localhost:5173'];
    expect(hostAllowed('https://shop.test/a', hosts)).toBe(true);
    expect(hostAllowed('https://www.shop.test/a', hosts)).toBe(true);
    expect(hostAllowed('https://img.cdn.test/', hosts)).toBe(true);
    expect(hostAllowed('http://localhost:5173/x', hosts)).toBe(true);
    expect(hostAllowed('http://localhost:3000/x', hosts)).toBe(false);
    expect(hostAllowed('https://evil.test/', hosts)).toBe(false);
    expect(hostAllowed('chrome://settings', hosts)).toBe(false);
    expect(hostAllowed('https://any.test/', [])).toBe(true);
  });
});

describe('userScriptCode', () => {
  it('runs the code with the helpers and reports errors to the panel', () => {
    const helpers = { waitForElement: vi.fn() };
    const error = vi.fn();
    const win = globalThis as unknown as { window: unknown; splitcraftPreview: unknown };
    win.window = globalThis;
    win.splitcraftPreview = { helpers, error };
    new Function(userScriptCode('splitcraft.waitForElement(".x", () => {})'))();
    expect(helpers.waitForElement).toHaveBeenCalledWith('.x', expect.any(Function));
    new Function(userScriptCode('throw new Error("boom")'))();
    expect(error).toHaveBeenCalledWith('JS error: boom');
  });
});

describe('currentJs', () => {
  it('is the chosen variant’s JS', () => {
    const state = {
      experimentKey: 'e',
      experimentName: 'E',
      variantKey: 'b',
      source: 'live' as const,
      variants: [
        { key: 'control', name: 'Control' },
        { key: 'b', name: 'B', js: 'go()' },
      ],
    };
    expect(currentJs(state)).toBe('go()');
    expect(currentJs({ ...state, variantKey: 'control' })).toBe('');
  });
});
