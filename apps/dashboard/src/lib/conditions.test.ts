import {
  conditionProblems,
  describeCondition,
  describeGroups,
  FIELDS,
  groupsProblemCount,
} from './conditions';
import type { ConditionGroup } from './targeting';

describe('catalogue', () => {
  it('offers exactly the condition types the SDK evaluates, each with a valid default', () => {
    expect(FIELDS.map((f) => f.type)).toEqual([
      'visitor_type',
      'session_number',
      'pages_viewed_session',
      'page_views_matching',
      'device_type',
      'screen_width',
      'country',
      'utm',
      'source_type',
      'cookie',
      'data_layer',
      'js_variable',
      'custom_js',
    ]);
    for (const f of FIELDS) expect(f.create().type).toBe(f.type);
  });
});

describe('describe', () => {
  it('reads like the design', () => {
    const groups: ConditionGroup[] = [
      {
        mode: 'all',
        items: [
          { type: 'device_type', value: ['mobile', 'tablet'] },
          { type: 'country', op: 'is', value: 'IN' },
          { type: 'session_number', op: 'gte', value: 2 },
        ],
      },
      {
        mode: 'any',
        items: [
          {
            type: 'page_views_matching',
            url: { op: 'matches', value: '/trips/*' },
            count: 3,
            days: 7,
          },
          { type: 'utm', param: 'campaign', touch: 'first', op: 'contains', value: 'summer-sale' },
          { type: 'cookie', name: 'loyalty_tier', op: 'is', value: 'gold' },
        ],
      },
      { mode: 'none', items: [{ type: 'custom_js', code: 'return window.__user?.isStaff' }] },
    ];
    expect(describeGroups(groups)).toBe(
      'On mobile or tablet, country is “IN” and session number is at least 2 and (viewed pages matches pattern /trips/* at least 3 times in 7 days, first-touch utm_campaign contains “summer-sale” or cookie loyalty_tier is “gold”) but not custom JavaScript returns true.',
    );
  });

  it('handles nesting, empty groups and value-less operators', () => {
    expect(describeGroups([])).toBe('Everyone.');
    expect(describeGroups([{ mode: 'all', items: [] }])).toBe('Everyone.');
    expect(
      describeGroups([
        {
          mode: 'all',
          items: [
            { type: 'visitor_type', value: 'new' },
            {
              mode: 'any',
              items: [
                { type: 'source_type', value: ['paid'] },
                { type: 'data_layer', key: 'plan', op: 'exists' },
              ],
            },
          ],
        },
      ]),
    ).toBe('New visitors and (arriving from paid or dataLayer plan exists).');
    expect(describeCondition({ type: 'screen_width', op: 'lt', value: 768 })).toBe(
      'screen width is less than 768 px',
    );
  });
});

describe('problems', () => {
  it('flags incomplete conditions and bad regex', () => {
    expect(conditionProblems({ type: 'cookie', name: '', op: 'is', value: '' })).toEqual([
      'Enter the cookie name.',
      'Enter a value.',
    ]);
    expect(conditionProblems({ type: 'cookie', name: 'x', op: 'exists' })).toEqual([]);
    expect(conditionProblems({ type: 'country', op: 'regex', value: '(' })).toContain(
      'This regex is not valid.',
    );
    expect(conditionProblems({ type: 'device_type', value: [] })).toEqual(['Pick at least one.']);
    expect(conditionProblems({ type: 'session_number', op: 'gte', value: NaN })).toEqual([
      'Enter a number.',
    ]);
  });

  it('counts incomplete conditions through nested groups', () => {
    expect(
      groupsProblemCount([
        {
          mode: 'all',
          items: [
            { type: 'country', op: 'is', value: '' },
            {
              mode: 'any',
              items: [
                { type: 'cookie', name: '', op: 'is', value: '' },
                { type: 'visitor_type', value: 'new' },
              ],
            },
          ],
        },
      ]),
    ).toBe(2);
  });
});
