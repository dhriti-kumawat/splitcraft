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
    const list = screen.getByRole('region', { name: 'Variations' });
    const buttons = within(list)
      .getAllByRole('button')
      .filter((b) => b.closest('li') && !b.getAttribute('aria-label')?.startsWith('Rename'));
    expect(buttons.map((b) => b.textContent)).toEqual([
      'ControlOriginal page, no code',
      'B0 lines JS · 0 lines CSS',
    ]);
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
  });

  it('renames the original and variations with the pencil in the list', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    const list = screen.getByRole('region', { name: 'Variations' });
    await user.click(within(list).getByRole('button', { name: 'Rename Control' }));
    const original = within(list).getByRole('textbox', { name: 'Original name' });
    await user.clear(original);
    await user.type(original, 'Original{Enter}');
    await user.click(within(list).getByRole('button', { name: 'Rename B' }));
    const b = within(list).getByRole('textbox', { name: 'Variation name' });
    await user.clear(b);
    await user.type(b, 'Trust row{Escape}');
    await user.click(within(list).getByRole('button', { name: 'Rename B' }));
    await user.clear(within(list).getByRole('textbox', { name: 'Variation name' }));
    await user.type(
      within(list).getByRole('textbox', { name: 'Variation name' }),
      'Trust row{Enter}',
    );
    await vi.waitFor(() =>
      expect(variantPatches).toEqual([
        { id: 'trust-c', patch: { name: 'Original' } },
        { id: 'trust-b', patch: { name: 'Trust row' } },
      ]),
    );
    expect(
      await within(list).findByRole('button', { name: /^Trust row0 lines/ }),
    ).toBeInTheDocument();
  });

  it('explains the original has no code and lets it be renamed', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    await user.click(screen.getByRole('button', { name: /^Control/ }));
    expect(screen.getByText('Control is the page as it is')).toBeInTheDocument();
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Original');
    await user.tab();
    await vi.waitFor(() =>
      expect(variantPatches).toContainEqual({ id: 'trust-c', patch: { name: 'Original' } }),
    );
    expect(screen.queryByRole('button', { name: 'Delete variant' })).toBeNull();
  });

  it('adds a variant and rebalances the split in a draft', async () => {
    const user = userEvent.setup();
    const { variantPatches } = await open();
    await user.click(screen.getByRole('button', { name: '+ Add variation' }));
    const name = screen.getByRole('textbox', { name: 'New variation name' });
    expect(name).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.type(name, 'Price first{Enter}');
    const added = await screen.findByRole('button', { name: /^Price first0 lines/ });
    // The new variant opens in the editor, and the split is even again.
    expect(added).toHaveAttribute('aria-current', 'true');
    expect(variantPatches.map((p) => p.patch)).toEqual([{ weight: 33.34 }, { weight: 33.33 }]);
    expect(screen.getByRole('textbox', { name: 'Price first %' })).toHaveValue('33.33');
  });

  it('adds more than three variants and lets the split be changed', async () => {
    const user = userEvent.setup();
    const { experimentsNow } = await open();
    for (const n of ['C one', 'D one', 'E one', 'F one']) {
      await user.click(screen.getByRole('button', { name: '+ Add variation' }));
      await user.type(screen.getByRole('textbox', { name: 'New variation name' }), `${n}{Enter}`);
      // The form closes once the variant is added and the split saved.
      await vi.waitFor(() =>
        expect(screen.queryByRole('textbox', { name: 'New variation name' })).toBeNull(),
      );
      await screen.findByRole('button', { name: new RegExp(`^${n}0 lines`) });
    }
    const weights = () =>
      experimentsNow()
        .find((e) => e.id === 'trust')!
        .variants.map((v) => v.weight);
    expect(weights()).toEqual([16.7, 16.66, 16.66, 16.66, 16.66, 16.66]);

    const control = screen.getByRole('textbox', { name: 'Control %' });
    await user.clear(control);
    await user.type(control, '50');
    await user.tab();
    expect(screen.getByText(/must add up to 100% \(now 133.3%\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Split evenly' }));
    await vi.waitFor(() => expect(weights()).toEqual([16.7, 16.66, 16.66, 16.66, 16.66, 16.66]));
  });

  it('does not add variants once started', async () => {
    await open('sticky');
    expect(screen.getByRole('button', { name: '+ Add variation' })).toBeDisabled();
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

describe('visual editor', () => {
  it('adds changes made on the site to the variant as code to review and save', async () => {
    const user = userEvent.setup();
    const { openForBookmark, previewState, stopPreview } = await import('../../lib/previewBridge');
    vi.spyOn(window, 'open').mockReturnValue(window);
    const { variantPatches } = await open();
    expect(screen.getByText(/No code needed for simple changes/)).toBeInTheDocument();

    const trust = EXPERIMENTS.find((e) => e.id === 'trust')!;
    openForBookmark('https://mytrips.dev/', previewState(trust, trust.variants, 'b'));
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: 'splitcraft-preview',
          type: 'visual',
          variantKey: 'b',
          changes: [
            { selector: 'h1', kind: 'text', value: 'Trips you will love' },
            { selector: '.promo', kind: 'hide' },
          ],
        },
      }),
    );
    expect(
      await screen.findByText('Added 2 visual changes to B. Check the code, then save.'),
    ).toHaveAttribute('role', 'status');
    expect((editor('B JS') as HTMLTextAreaElement).value).toContain(
      'el.textContent = "Trips you will love";',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(variantPatches).toHaveLength(1));
    expect(variantPatches[0]!.patch).toMatchObject({
      css: expect.stringContaining('.promo {\n  display: none !important;\n}'),
    });
    stopPreview();
  });
});
