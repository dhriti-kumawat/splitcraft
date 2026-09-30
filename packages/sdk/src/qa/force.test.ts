// @vitest-environment jsdom
import {
  clearForcedVariants,
  getForcedVariants,
  getPreviewToken,
  parseForce,
  withForce,
} from './force';

afterEach(() => {
  sessionStorage.clear();
});

describe('parseForce', () => {
  it('parses one or more exp:variant pairs', () => {
    expect(parseForce('trust:B')).toEqual({ trust: 'B' });
    expect(parseForce('trust:B, sticky-bar:control')).toEqual({
      trust: 'B',
      'sticky-bar': 'control',
    });
  });

  it('skips invalid pairs', () => {
    expect(parseForce(null)).toEqual({});
    expect(parseForce('')).toEqual({});
    expect(parseForce('trust,:B,trust:,ok:A')).toEqual({ ok: 'A' });
  });
});

describe('getForcedVariants', () => {
  it('reads the URL param', () => {
    expect(getForcedVariants('?splitcraft_force=trust:B')).toEqual({ trust: 'B' });
  });

  it('decodes an encoded param', () => {
    expect(getForcedVariants('?splitcraft_force=trust%3AB%2Csticky%3Acontrol')).toEqual({
      trust: 'B',
      sticky: 'control',
    });
  });

  it('remembers forced variants for the session when the param is gone', () => {
    getForcedVariants('?splitcraft_force=trust:B');
    expect(getForcedVariants('')).toEqual({ trust: 'B' });
  });

  it('lets a new URL param replace the remembered one', () => {
    getForcedVariants('?splitcraft_force=trust:B');
    expect(getForcedVariants('?splitcraft_force=trust:control')).toEqual({ trust: 'control' });
    expect(getForcedVariants('')).toEqual({ trust: 'control' });
  });

  it('returns nothing after clearForcedVariants', () => {
    getForcedVariants('?splitcraft_force=trust:B');
    clearForcedVariants();
    expect(getForcedVariants('')).toEqual({});
  });

  it('ignores a corrupted stored value', () => {
    sessionStorage.setItem('splitcraft_force', '{not json');
    expect(getForcedVariants('')).toEqual({});
    sessionStorage.setItem('splitcraft_force', '{"trust":"B","bad":7}');
    expect(getForcedVariants('')).toEqual({ trust: 'B' });
  });
});

describe('withForce', () => {
  it('sets the param and keeps other params and the hash', () => {
    const url = withForce('https://mytrips.dev/trips?ref=ad#top', { trust: 'B' });
    expect(new URL(url).searchParams.get('splitcraft_force')).toBe('trust:B');
    expect(new URL(url).searchParams.get('ref')).toBe('ad');
    expect(new URL(url).hash).toBe('#top');
  });

  it('removes the param when nothing is forced', () => {
    expect(withForce('https://mytrips.dev/?splitcraft_force=trust:B&x=1', {})).toBe(
      'https://mytrips.dev/?x=1',
    );
  });
});

describe('preview token', () => {
  beforeEach(() => sessionStorage.clear());

  it('reads the token from the URL and remembers it for the tab', () => {
    expect(getPreviewToken('?splitcraft_preview=abc-123')).toBe('abc-123');
    expect(getPreviewToken('')).toBe('abc-123');
    clearForcedVariants();
    expect(getPreviewToken('')).toBeNull();
  });
});
