import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

async function open(id = 'trust', data = fakeData()) {
  renderApp(`/p/trip-demo/experiments/${id}/variants`, { data: data.api });
  await screen.findByRole('region', { name: /Code for|Control/ });
  return data;
}

const editor = (label: string) => screen.getByRole('textbox', { name: label });
const type = (label: string, value: string) =>
  fireEvent.change(editor(label), { target: { value } });

describe('variants list', () => {
  it('lists Control and the variants, starting on the first variant', async () => {
    await open();
    const list = screen.getByRole('region', { name: 'Variants' });
    const buttons = within(list)
      .getAllByRole('button')
      .filter((b) => b.closest('li'));
    expect(buttons.map((b) => b.textContent)).toEqual([
      'ControlOriginal page, no code',
      'B0 lines JS · 0 lines CSS',
    ]);
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
  });

  it('explains Control has no code', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: /^Control/ }));
    expect(screen.getByText('Control is the original page')).toBeInTheDocument();
  });

  it('adds a variant and rebalances the split in a draft', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    await user.click(screen.getByRole('button', { name: '+ Add variant' }));
    expect(await screen.findByRole('button', { name: /^C0 lines/ })).toBeInTheDocument();
    expect(variantPatches.map((p) => p.patch)).toEqual([{ weight: 33.33 }, { weight: 33.33 }]);
  });

  it('does not add variants once started', async () => {
    await open('sticky');
    expect(screen.getByRole('button', { name: '+ Add variant' })).toBeDisabled();
  });
});

describe('editor', () => {
  it('edits JS and CSS, checks syntax and saves', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    type('B JS', 'if (');
    expect(await screen.findByText(/JS error:/)).toBeInTheDocument();
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    expect(screen.getByText('· unsaved').closest('button')).toHaveAttribute('aria-current', 'true');

    type('B JS', 'splitcraft.injectStyles(".x{}")');
    expect(await screen.findByText('No errors')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'b.css' }));
    expect(screen.getByRole('tab', { name: 'b.css' })).toHaveAttribute('aria-selected', 'true');
    type('B CSS', '.x { color: red; }');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Saved \d\d:\d\d/)).toBeInTheDocument();
    expect(variantPatches).toEqual([
      {
        id: 'trust-b',
        patch: { js: 'splitcraft.injectStyles(".x{}")', css: '.x { color: red; }' },
      },
    ]);
    expect(screen.getByRole('button', { name: /^B1 lines JS · 1 lines CSS/ })).toBeInTheDocument();
  });

  it('keeps unsaved edits when switching variants', async () => {
    const user = userEvent.setup();
    await open();
    type('B JS', 'console.log(1)');
    await user.click(screen.getByRole('button', { name: /^Control/ }));
    await user.click(screen.getByRole('button', { name: /^B/ }));
    expect(editor('B JS')).toHaveValue('console.log(1)');
  });

  it('fills an empty variant from the template gallery', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: 'Template' }));
    const gallery = screen.getByRole('dialog', { name: 'Start from a template' });
    await user.click(within(gallery).getByRole('button', { name: /Trust row/ }));
    expect((editor('B JS') as HTMLTextAreaElement).value).toContain(
      "splitcraft.trackEvent('trust_badges_seen')",
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before replacing code, and can add the template below', async () => {
    const user = userEvent.setup();
    await open();
    type('B JS', 'mine()');
    await user.click(screen.getByRole('button', { name: 'Template' }));
    await user.click(screen.getByRole('button', { name: /Promo banner/ }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Use “Promo banner”?' })).getByRole('button', {
        name: 'Add below',
      }),
    );
    const value = (editor('B JS') as HTMLTextAreaElement).value;
    expect(value.startsWith('mine()')).toBe(true);
    expect(value).toContain("bar.className = 'spl-promo'");

    await user.click(screen.getByRole('button', { name: 'Template' }));
    await user.click(screen.getByRole('button', { name: /Headline swap/ }));
    await user.click(screen.getByRole('button', { name: 'Replace code' }));
    expect((editor('B JS') as HTMLTextAreaElement).value).not.toContain('mine()');
  });

  it('keeps earlier versions and loads one back', async () => {
    const user = userEvent.setup();
    await open();
    type('B JS', 'first()');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Saved \d\d:\d\d/);
    type('B JS', 'second()');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('v3 · current');

    await user.click(await screen.findByRole('button', { name: 'Load v2 into the editor' }));
    expect(editor('B JS')).toHaveValue('first()');
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
  });

  it('is read-only once ended', async () => {
    const ended = EXPERIMENTS.find((e) => e.id === 'urgency')!;
    await open('urgency', fakeData({ experiments: [ended] }));
    expect(editor('B JS')).toHaveAttribute('readonly');
    expect(screen.getByText(/Read only: experiment ended/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Template' })).not.toBeInTheDocument();
  });

  it('warns that saving a live experiment changes it for visitors', async () => {
    await open('sticky');
    expect(screen.getByText(/This experiment is live/)).toBeInTheDocument();
  });
});

describe('variant settings', () => {
  it('renames a variant', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Trust badges');
    await user.tab();
    await vi.waitFor(() =>
      expect(variantPatches).toContainEqual({ id: 'trust-b', patch: { name: 'Trust badges' } }),
    );
  });
});
