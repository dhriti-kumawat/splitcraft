// @vitest-environment jsdom
import { loadQaPanel } from './loader';

afterEach(() => {
  delete window.splitcraftQa;
  document.head.innerHTML = '';
});

describe('loadQaPanel', () => {
  it('adds a script tag and resolves once the bundle registers', async () => {
    const promise = loadQaPanel('https://splitcraft.vercel.app/sdk/v1-qa.js');
    const script = document.head.querySelector('script')!;
    expect(script.src).toBe('https://splitcraft.vercel.app/sdk/v1-qa.js');
    const panel = { mount: vi.fn() };
    window.splitcraftQa = panel;
    script.dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBe(panel);
  });

  it('reuses an already loaded bundle', async () => {
    const panel = { mount: vi.fn() };
    window.splitcraftQa = panel;
    await expect(loadQaPanel('/qa.js')).resolves.toBe(panel);
    expect(document.head.querySelector('script')).toBeNull();
  });

  it('rejects when the file fails to load', async () => {
    const promise = loadQaPanel('/missing.js');
    document.head.querySelector('script')!.dispatchEvent(new Event('error'));
    await expect(promise).rejects.toThrow('Could not load /missing.js');
  });

  it('rejects when the file loads but does not register', async () => {
    const promise = loadQaPanel('/wrong.js');
    document.head.querySelector('script')!.dispatchEvent(new Event('load'));
    await expect(promise).rejects.toThrow('did not register');
  });
});
