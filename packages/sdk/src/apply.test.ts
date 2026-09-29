// @vitest-environment jsdom
import { applyVariant, removeVariant, styleId } from './apply';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('applyVariant', () => {
  it('injects the variant CSS under an id per experiment', () => {
    const result = applyVariant({
      experimentKey: 'css-only',
      variantKey: 'b',
      css: '.cta{color:red}',
    });
    expect(result).toEqual({ applied: true });
    expect(document.getElementById(styleId('css-only'))?.textContent).toBe('.cta{color:red}');
  });

  it('runs the variant JS with the splitly helpers', () => {
    document.body.innerHTML = '<h1>Old</h1>';
    applyVariant({
      experimentKey: 'js-run',
      variantKey: 'b',
      js: `document.querySelector('h1').textContent = 'New';
           splitly.injectStyles('h1{font-weight:700}', 'from-variant');`,
    });
    expect(document.querySelector('h1')?.textContent).toBe('New');
    expect(document.getElementById('from-variant')).not.toBeNull();
  });

  it('runs only once per page', () => {
    (window as unknown as { __runs: number }).__runs = 0;
    const v = { experimentKey: 'once', variantKey: 'b', js: 'window.__runs++' };
    expect(applyVariant(v).applied).toBe(true);
    expect(applyVariant(v).applied).toBe(false);
    expect((window as unknown as { __runs: number }).__runs).toBe(1);
  });

  it('runs again after an SPA navigation to another URL', () => {
    (window as unknown as { __runs: number }).__runs = 0;
    const v = { experimentKey: 'spa', variantKey: 'b', js: 'window.__runs++' };
    applyVariant(v);
    history.pushState({}, '', '/trips');
    applyVariant(v);
    expect((window as unknown as { __runs: number }).__runs).toBe(2);
  });

  it('catches errors in variant code and still applies the CSS', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = applyVariant({
      experimentKey: 'broken',
      variantKey: 'b',
      js: 'undefinedFunction()',
      css: '.x{}',
    });
    expect(result.applied).toBe(true);
    expect(result.error).toBeInstanceOf(ReferenceError);
    expect(document.getElementById(styleId('broken'))).not.toBeNull();
  });

  it('catches syntax errors in variant code', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = applyVariant({ experimentKey: 'syntax', variantKey: 'b', js: 'if (' });
    expect(result.error).toBeInstanceOf(SyntaxError);
  });
});

describe('removeVariant', () => {
  it('removes the CSS and lets the variant apply again', () => {
    (window as unknown as { __runs: number }).__runs = 0;
    const v = { experimentKey: 'removable', variantKey: 'b', css: '.x{}', js: 'window.__runs++' };
    applyVariant(v);
    removeVariant('removable');
    expect(document.getElementById(styleId('removable'))).toBeNull();
    applyVariant(v);
    expect((window as unknown as { __runs: number }).__runs).toBe(2);
  });
});
