import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

const mvtData = () =>
  fakeData({
    experiments: EXPERIMENTS.map((e) =>
      e.id === 'trust' ? { ...e, type: 'mvt', variants: [e.variants[0]!] } : e,
    ),
  });

async function open(data = mvtData()) {
  renderApp('/p/trip-demo/experiments/trust/variants', { data: data.api });
  await screen.findByRole('region', { name: 'Sections' });
  return data;
}

const sections = () => screen.getByRole('region', { name: 'Sections' });

async function addVariation(user: ReturnType<typeof userEvent.setup>, index: number, name: string) {
  await user.click(within(sections()).getAllByRole('button', { name: '+ Add variation' })[index]!);
  await user.type(
    within(sections()).getByRole('textbox', { name: 'New variation name' }),
    `${name}{Enter}`,
  );
}

describe('MVT variants', () => {
  it('starts a section with only its original, and names it at once', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    const name = within(sections()).getByRole('textbox', { name: 'Section name' });
    expect(name).toHaveFocus();
    await user.keyboard('Headline');
    expect(name).toHaveValue('Headline');
    const entries = within(sections())
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('Unchanged') || b.textContent?.includes('code'));
    expect(entries.map((b) => b.textContent)).toEqual(['OriginalUnchanged']);
    expect(screen.getByText(/Add a variation to this section/)).toBeInTheDocument();
  });

  it('adds named variations, renames them and builds every combination', async () => {
    const user = userEvent.setup();
    const { experimentsNow } = await open();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    await user.keyboard('Headline');
    const addButton = within(sections()).getByRole('button', { name: '+ Add variation' });
    await user.click(addButton);
    expect(within(sections()).getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.type(
      within(sections()).getByRole('textbox', { name: 'New variation name' }),
      'Short{Enter}',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Headline Short JS' }), {
      target: { value: 'document.title = "B"' },
    });

    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    await user.keyboard('Button');
    await addVariation(user, 1, 'Green');
    await addVariation(user, 1, 'Big');
    expect(screen.getByRole('heading', { name: '6 combinations' })).toBeInTheDocument();

    // Rename in the list.
    await user.click(within(sections()).getByRole('button', { name: 'Rename Big' }));
    const rename = within(sections()).getByRole('textbox', { name: 'Variation name' });
    await user.clear(rename);
    await user.type(rename, 'Large{Enter}');
    expect(
      within(sections()).getByRole('button', { name: /^LargeNo code yet/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save and build combinations' }));
    await vi.waitFor(() =>
      expect(
        experimentsNow()
          .find((e) => e.id === 'trust')!
          .variants.map((v) => v.key),
      ).toEqual(['control', 'v01', 'v02', 'v10', 'v11', 'v12']),
    );
    const trust = experimentsNow().find((e) => e.id === 'trust')!;
    expect(trust.factors.map((f) => f.name)).toEqual(['Headline', 'Button']);
    expect(trust.factors[1]!.levels.map((l) => l.name)).toEqual(['Original', 'Green', 'Large']);
    expect(trust.variants.find((v) => v.key === 'v10')).toMatchObject({
      name: 'Headline: Short',
      js: '// Headline: Short\n{\ndocument.title = "B"\n}',
    });
  });

  it('blocks saving while a variation has a JS error', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    await addVariation(user, 0, 'Broken');
    fireEvent.change(screen.getByRole('textbox', { name: 'Section 1 Broken JS' }), {
      target: { value: 'if (' },
    });
    expect(screen.getByText(/JS error in Section 1: Broken/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and build combinations' })).toBeDisabled();
  });
});
