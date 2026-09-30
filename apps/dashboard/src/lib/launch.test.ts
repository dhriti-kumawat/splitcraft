import { EXPERIMENTS, PROJECTS } from '../test/fakeData';
import {
  canLaunch,
  launchChecks,
  previewUrl,
  syntaxError,
  testPageUrl,
  variantsReady,
} from './launch';

const draft = EXPERIMENTS.find((e) => e.id === 'trust')!;
const project = PROJECTS[0]!;
const withCode = (js: string, css = '') => ({
  ...draft,
  variants: draft.variants.map((v) => (v.key === 'b' ? { ...v, js, css } : v)),
});

describe('syntaxError', () => {
  it('accepts valid code and reports errors without running anything', () => {
    expect(syntaxError('document.title = "x"; throw new Error("never runs")')).toBeNull();
    expect(syntaxError('if (')).toMatch(/Unexpected|expected/i);
    expect(syntaxError('')).toBeNull();
  });
});

describe('variantsReady', () => {
  it('needs code in every variant and no syntax errors', () => {
    expect(variantsReady(draft)).toBe(false);
    expect(variantsReady(withCode('', '.x{}'))).toBe(true);
    expect(variantsReady(withCode('splitcraft.injectStyles(".x{}")'))).toBe(true);
    expect(variantsReady(withCode('if ('))).toBe(false);
  });
});

describe('launchChecks', () => {
  it('blocks on snippet, goal and code but only warns about QA', () => {
    const checks = launchChecks(withCode('1'), project, false);
    expect(checks.map((c) => [c.id, c.ok])).toEqual([
      ['snippet', true],
      ['goal', true],
      ['code', true],
      ['qa', false],
    ]);
    expect(canLaunch(checks)).toBe(true);
    expect(canLaunch(launchChecks(draft, project, true))).toBe(false);
    expect(canLaunch(launchChecks(withCode('1'), { ...project, installedAt: null }, true))).toBe(
      false,
    );
  });
});

describe('previewUrl', () => {
  it('forces the first variant on the main domain', () => {
    expect(previewUrl(draft, project)).toBe(
      'https://mytrips.dev/?splitcraft_force=trust%3Ab&splitcraft_preview=tok-trust',
    );
    expect(previewUrl(draft, { ...project, mainDomain: 'localhost:5173' }, 'control')).toBe(
      'http://localhost:5173/?splitcraft_force=trust%3Acontrol&splitcraft_preview=tok-trust',
    );
  });
});

describe('test page', () => {
  const project = {
    mainDomain: 'mytrips.dev',
    allowedDomains: ['staging.mytrips.dev', '*.vercel.app', 'localhost:5173'],
  };

  it('turns a path or a URL on the project into a full URL', () => {
    expect(testPageUrl('/trips/norway?ref=a', project)).toEqual({
      url: 'https://mytrips.dev/trips/norway?ref=a',
    });
    expect(testPageUrl('www.mytrips.dev/deals', project).url).toBe('https://www.mytrips.dev/deals');
    expect(testPageUrl('https://pr-12.vercel.app/x', project).url).toBe(
      'https://pr-12.vercel.app/x',
    );
    expect(testPageUrl('localhost:5173/trips', project).url).toBe('http://localhost:5173/trips');
    expect(testPageUrl('  ', project)).toEqual({ url: null });
  });

  it('refuses other domains and drops a force parameter', () => {
    expect(testPageUrl('https://evil.example/trips', project).error).toMatch(
      "evil.example isn't one of this project's domains",
    );
    expect(testPageUrl('/trips?splitcraft_force=a:b', project).url).toBe(
      'https://mytrips.dev/trips',
    );
  });

  it('opens the test page with the force parameter, keeping its query', () => {
    const withPage = { ...draft, previewUrl: 'https://mytrips.dev/trips/norway?ref=a' };
    expect(previewUrl(withPage, project as never)).toBe(
      'https://mytrips.dev/trips/norway?ref=a&splitcraft_force=trust%3Ab&splitcraft_preview=tok-trust',
    );
  });
});
