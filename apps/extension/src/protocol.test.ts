import { visualChanges } from './protocol';

describe('visualChanges', () => {
  it('keeps well-formed changes only', () => {
    expect(
      visualChanges([
        { selector: 'h1', kind: 'text', value: 'Hi', extra: 'dropped' },
        { selector: '#cta', kind: 'hide' },
        { selector: '', kind: 'hide' },
        { selector: 'p', kind: 'run-js', value: 'alert(1)' },
        { selector: 'p', kind: 'color', value: 42 },
        'junk',
      ]),
    ).toEqual([
      { selector: 'h1', kind: 'text', value: 'Hi' },
      { selector: '#cta', kind: 'hide' },
    ]);
  });

  it('returns null when nothing is usable, and caps the list at 50', () => {
    expect(visualChanges('nope')).toBeNull();
    expect(visualChanges([{ selector: 'x'.repeat(301), kind: 'hide' }])).toBeNull();
    expect(
      visualChanges(Array.from({ length: 80 }, () => ({ selector: 'p', kind: 'hide' }))),
    ).toHaveLength(50);
  });
});
