import { clickCode, eventKeyFor, measuresFor, selectorHealth, trackerChecks } from './metrics';

describe('eventKeyFor', () => {
  it('turns names into keys', () => {
    expect(eventKeyFor('Book click')).toBe('book_click');
    expect(eventKeyFor('  Add-on selected!  ')).toBe('add_on_selected');
    expect(eventKeyFor('Café visit')).toBe('cafe_visit');
  });
});

describe('selectorHealth', () => {
  it('passes a stable selector list', () => {
    expect(selectorHealth('.book-now-btn, [data-cta="book"]').every((c) => c.ok)).toBe(true);
  });

  it('warns about position and generated classes', () => {
    const checks = selectorHealth('ul li:nth-child(3), .css-1x9k2a');
    expect(checks.filter((c) => !c.ok).map((c) => c.text)).toEqual([
      'Avoid position selectors like :nth-child (ul li:nth-child(3)). They break when the layout changes.',
      'Avoid generated class names (.css-1x9k2a). They change on every deploy.',
      'Prefer a class, id or data attribute over a bare tag name.',
    ]);
  });

  it('rejects invalid and empty selectors', () => {
    expect(selectorHealth('.btn[')).toEqual([
      { ok: false, text: 'This is not a valid CSS selector.' },
    ]);
    expect(selectorHealth(' , ')).toEqual([
      { ok: false, text: 'Enter at least one CSS selector.' },
    ]);
  });

  it('prefers classes over bare tags', () => {
    expect(selectorHealth('button').some((c) => c.text.startsWith('Prefer a class'))).toBe(true);
  });
});

describe('trackerChecks', () => {
  it('checks syntax, the key and the trackEvent call', () => {
    const good = "splitly.trackEvent('add_on_selected', { value: 1 })";
    expect(trackerChecks(good, 'add_on_selected', null).every((c) => c.ok)).toBe(true);
    const bad = trackerChecks('console.log(1)', 'add_on_selected', 'Unexpected token');
    expect(bad.map((c) => c.ok)).toEqual([false, false, false]);
  });
});

describe('measuresFor and clickCode', () => {
  it('offers value measures only where events carry values', () => {
    expect(measuresFor('click')).toEqual(['unique', 'total']);
    expect(measuresFor('custom_js')).toContain('sum');
  });

  it('shows the listener Splitly runs', () => {
    expect(clickCode('.a, .b', true, 'book_click')).toContain('e.target.closest(".a, .b")');
    expect(clickCode('.a', true, 'book_click')).toContain('counted once per page');
  });
});
