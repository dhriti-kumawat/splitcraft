import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ConditionGroup } from '../lib/targeting';
import { ConditionBuilder } from './ConditionBuilder';

function Harness({
  initial,
  onChange,
}: {
  initial: ConditionGroup[];
  onChange(g: ConditionGroup[]): void;
}) {
  const [groups, setGroups] = useState(initial);
  return (
    <ConditionBuilder
      groups={groups}
      noun="Segment"
      onChange={(g) => {
        setGroups(g);
        onChange(g);
      }}
    />
  );
}

function setup(
  initial: ConditionGroup[] = [
    { mode: 'all', items: [{ type: 'visitor_type', value: 'returning' }] },
  ],
) {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  const last = () => onChange.mock.calls.at(-1)![0] as ConditionGroup[];
  return { user: userEvent.setup(), last };
}

const row = (n: number, g = 1) => `Segment group ${g}, condition ${n}`;

describe('ConditionBuilder', () => {
  it('switches a group between ALL, ANY and NONE', async () => {
    const { user, last } = setup();
    const modes = screen.getByRole('group', { name: 'Segment group 1 match' });
    await user.click(within(modes).getByRole('button', { name: 'NONE' }));
    expect(within(modes).getByRole('button', { name: 'NONE' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(last()[0]!.mode).toBe('none');
    expect(screen.getByText('Excludes anyone who matches')).toBeInTheDocument();
  });

  it('changes the field and resets to that field’s default', async () => {
    const { user, last } = setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: `${row(1)} field` }),
      'Device type',
    );
    expect(last()[0]!.items[0]).toEqual({ type: 'device_type', value: ['mobile'] });
    await user.click(screen.getByRole('checkbox', { name: 'Tablet' }));
    expect(last()[0]!.items[0]).toEqual({ type: 'device_type', value: ['mobile', 'tablet'] });
  });

  it('edits string conditions, splitting comma lists for "is"', async () => {
    const { user, last } = setup([
      { mode: 'all', items: [{ type: 'country', op: 'is', value: '' }] },
    ]);
    expect(screen.getByText('Enter a value.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: `${row(1)} value` }), 'IN, GB');
    expect(last()[0]!.items[0]).toEqual({ type: 'country', op: 'is', value: ['IN', 'GB'] });
    await user.selectOptions(
      screen.getByRole('combobox', { name: `${row(1)} operator` }),
      'exists',
    );
    expect(screen.queryByRole('textbox', { name: `${row(1)} value` })).not.toBeInTheDocument();
  });

  it('edits number, UTM and page-view conditions', async () => {
    const { user, last } = setup([
      {
        mode: 'all',
        items: [
          { type: 'session_number', op: 'gte', value: 2 },
          { type: 'utm', param: 'campaign', touch: 'last', op: 'contains', value: '' },
          {
            type: 'page_views_matching',
            url: { op: 'matches', value: '/trips/*' },
            count: 3,
            days: 7,
          },
        ],
      },
    ]);
    const n = screen.getByRole('spinbutton', { name: `${row(1)} value` });
    await user.clear(n);
    await user.type(n, '4');
    await user.selectOptions(
      screen.getByRole('combobox', { name: `${row(2)} touch` }),
      'first-touch',
    );
    await user.type(screen.getByRole('textbox', { name: `${row(2)} value` }), 'summer');
    const days = screen.getByRole('spinbutton', { name: `${row(3)} days` });
    await user.clear(days);
    await user.type(days, '14');
    expect(last()[0]!.items).toEqual([
      { type: 'session_number', op: 'gte', value: 4 },
      { type: 'utm', param: 'campaign', touch: 'first', op: 'contains', value: 'summer' },
      {
        type: 'page_views_matching',
        url: { op: 'matches', value: '/trips/*' },
        count: 3,
        days: 14,
      },
    ]);
  });

  it('adds and removes conditions, nested groups and groups', async () => {
    const { user, last } = setup();
    await user.click(screen.getByRole('button', { name: '+ Condition' }));
    expect(last()[0]!.items).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '+ Nested group' }));
    expect(
      screen.getByRole('group', { name: 'Segment group 1, nested group 3' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Remove ${row(2)}` }));
    expect(last()[0]!.items).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '+ Add group' }));
    expect(last()).toHaveLength(2);
    expect(screen.getByText('AND')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Segment group 2' }));
    expect(last()).toHaveLength(1);
  });

  it('says everyone matches when there are no groups', () => {
    setup([]);
    expect(screen.getByText('No conditions: everyone matches.')).toBeInTheDocument();
  });
});
