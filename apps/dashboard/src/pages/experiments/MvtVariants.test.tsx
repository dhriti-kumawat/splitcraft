import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXPERIMENTS, fakeData } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

const mvtData = () =>
  fakeData({
    experiments: EXPERIMENTS.map((e) =>
      e.id === 'trust'
        ? { ...e, type: 'mvt', variants: [{ ...e.variants[0]!, name: 'Original' }] }
        : e,
    ),
  });

async function open(data = mvtData()) {
  renderApp('/p/marketing-site/experiments/trust/variants', { data: data.api });
  await screen.findByRole('region', { name: 'Variations' });
  return data;
}

const list = () => screen.getByRole('region', { name: /^(Variations|Sections)$/ });
const entries = () =>
  within(list())
    .getAllByRole('button')
    .filter((b) => /Unchanged|code/.test(b.textContent ?? ''))
    .map((b) => b.textContent);

async function addVariation(user: ReturnType<typeof userEvent.setup>, index: number, name: string) {
  await user.click(within(list()).getAllByRole('button', { name: '+ Add variation' })[index]!);
  await user.type(
    within(list()).getByRole('textbox', { name: 'New variation name' }),
    `${name}{Enter}`,
  );
}

describe('MVT variants', () => {
  it('opens ready: the Original and + Add variation, no section to create first', async () => {
    await open();
    expect(entries()).toEqual(['OriginalUnchanged']);
    expect(within(list()).queryByRole('textbox', { name: 'Section name' })).toBeNull();
    expect(within(list()).getByRole('button', { name: '+ Add variation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 combination' })).toBeInTheDocument();
  });

  it('renames the Original and variations, and a single section saves plain names', async () => {
    const user = userEvent.setup();
    const { experimentsNow } = await open();
    await user.click(within(list()).getByRole('button', { name: 'Rename Original' }));
    const original = within(list()).getByRole('textbox', { name: 'Original name' });
    await user.clear(original);
    await user.type(original, 'Current page{Enter}');

    await addVariation(user, 0, 'Short headline');
    expect(entries()).toEqual(['Current pageUnchanged', 'Short headlineNo code yet']);
    await user.click(within(list()).getByRole('button', { name: 'Rename Short headline' }));
    const rename = within(list()).getByRole('textbox', { name: 'Variation name' });
    await user.clear(rename);
    await user.type(rename, 'Shorter{Enter}');

    await user.click(screen.getByRole('button', { name: 'Save and build combinations' }));
    await vi.waitFor(() =>
      expect(
        experimentsNow()
          .find((e) => e.id === 'trust')!
          .variants.map((v) => [v.key, v.name]),
      ).toEqual([
        ['control', 'Current page'],
        ['v1', 'Shorter'],
      ]),
    );
  });

  it('adds another section and builds every combination', async () => {
    const user = userEvent.setup();
    const { experimentsNow } = await open();
    await addVariation(user, 0, 'Short');
    fireEvent.change(screen.getByRole('textbox', { name: 'Section 1 Short JS' }), {
      target: { value: 'document.title = "B"' },
    });

    await user.click(screen.getByRole('button', { name: '+ Add another section' }));
    const names = within(list()).getAllByRole('textbox', { name: 'Section name' });
    expect(names).toHaveLength(2);
    expect(names[1]).toHaveFocus();
    await user.keyboard('Button');
    await addVariation(user, 1, 'Green');
    await addVariation(user, 1, 'Big');
    expect(screen.getByRole('heading', { name: '6 combinations' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save and build combinations' }));
    await vi.waitFor(() =>
      expect(
        experimentsNow()
          .find((e) => e.id === 'trust')!
          .variants.map((v) => v.key),
      ).toEqual(['control', 'v01', 'v02', 'v10', 'v11', 'v12']),
    );
    const trust = experimentsNow().find((e) => e.id === 'trust')!;
    expect(trust.factors.map((f) => f.name)).toEqual(['Section 1', 'Button']);
    expect(trust.variants.find((v) => v.key === 'v10')).toMatchObject({
      name: 'Section 1: Short',
      js: '// Section 1: Short\n{\ndocument.title = "B"\n}',
    });
  });

  it('blocks saving while a variation has a JS error', async () => {
    const user = userEvent.setup();
    await open();
    await addVariation(user, 0, 'Broken');
    fireEvent.change(screen.getByRole('textbox', { name: 'Section 1 Broken JS' }), {
      target: { value: 'if (' },
    });
    expect(screen.getByText(/JS error in Section 1: Broken/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and build combinations' })).toBeDisabled();
  });
});
