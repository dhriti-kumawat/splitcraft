import { fireEvent, screen } from '@testing-library/react';
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

describe('MVT variants', () => {
  it('builds every combination from sections and versions', async () => {
    const user = userEvent.setup();
    const { experimentsNow } = await open();
    expect(screen.getByRole('heading', { name: '1 combination' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Section 1 Version B JS' }), {
      target: { value: 'document.title = "B"' },
    });
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    await user.click(screen.getAllByRole('button', { name: '+ Add version' })[1]!);
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
    expect(trust.factors.map((f) => f.levels.length)).toEqual([2, 3]);
    expect(trust.variants.find((v) => v.key === 'v10')).toMatchObject({
      name: 'Section 1: Version B',
      js: '// Section 1: Version B\n{\ndocument.title = "B"\n}',
    });
  });

  it('blocks saving while a version has a JS error', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: '+ Add section' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Section 1 Version B JS' }), {
      target: { value: 'if (' },
    });
    expect(screen.getByText(/JS error in Section 1: Version B/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and build combinations' })).toBeDisabled();
  });
});
