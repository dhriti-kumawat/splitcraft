import type { MvtFactor } from '../data/api';
import { combinationCount, combinations, levelsOf, mainEffects } from './mvt';

const level = (key: string, name: string, js = '', css = '') => ({ key, name, js, css });
const factors: MvtFactor[] = [
  {
    key: 'headline',
    name: 'Headline',
    levels: [level('a', 'Original'), level('b', 'Short', 'setHeadline("Go")')],
  },
  {
    key: 'button',
    name: 'Button',
    levels: [
      level('a', 'Original'),
      level('b', 'Green', '', '.btn{color:green}'),
      level('c', 'Big', 'const el = 1;'),
    ],
  },
];

describe('combinations', () => {
  it('makes the full factorial with Control first and equal weights', () => {
    const vs = combinations(factors);
    expect(combinationCount(factors)).toBe(6);
    expect(vs.map((v) => v.key)).toEqual(['control', 'v01', 'v02', 'v10', 'v11', 'v12']);
    expect(vs.every((v) => v.weight === 16.67)).toBe(true);
    expect(vs[0]).toEqual({ key: 'control', name: 'Control', weight: 16.67, js: '', css: '' });
    expect(vs[5]!.name).toBe('Headline: Short · Button: Big');
  });

  it('joins each version’s code in its own block', () => {
    const v = combinations(factors).find((x) => x.key === 'v12')!;
    expect(v.js).toBe(
      '// Headline: Short\n{\nsetHeadline("Go")\n}\n\n// Button: Big\n{\nconst el = 1;\n}',
    );
    expect(combinations(factors).find((x) => x.key === 'v11')!.css).toBe(
      '/* Button: Green */\n.btn{color:green}',
    );
  });

  it('is just Control without sections', () => {
    expect(combinations([])).toEqual([
      { key: 'control', name: 'Control', weight: 100, js: '', css: '' },
    ]);
  });
});

describe('levelsOf', () => {
  it('reads levels from the key', () => {
    expect(levelsOf('control', 2)).toEqual([0, 0]);
    expect(levelsOf('v12', 2)).toEqual([1, 2]);
    expect(levelsOf('v1', 2)).toBeNull();
    expect(levelsOf('b', 2)).toBeNull();
  });
});

describe('mainEffects', () => {
  it('pools each version over the other sections and compares with the original', () => {
    const arms = [
      { variantKey: 'control', visitors: 100, conversions: 10 },
      { variantKey: 'v01', visitors: 100, conversions: 10 },
      { variantKey: 'v02', visitors: 100, conversions: 10 },
      { variantKey: 'v10', visitors: 100, conversions: 20 },
      { variantKey: 'v11', visitors: 100, conversions: 20 },
      { variantKey: 'v12', visitors: 100, conversions: 20 },
    ];
    const [headline, button] = mainEffects(factors, arms);
    expect(headline!.map((e) => e.arm)).toEqual([
      { visitors: 300, conversions: 30 },
      { visitors: 300, conversions: 60 },
    ]);
    expect(headline![0]!.comparison).toBeNull();
    expect(headline![1]!.comparison!.uplift).toBeCloseTo(1);
    expect(button!.map((e) => e.arm.conversions)).toEqual([30, 30, 30]);
    expect(button![1]!.comparison!.uplift).toBeCloseTo(0);
  });
});
