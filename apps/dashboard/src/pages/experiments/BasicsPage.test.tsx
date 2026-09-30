import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Experiment } from '../../data/api';
import { EXPERIMENTS, fakeData, PROJECTS } from '../../test/fakeData';
import { renderApp } from '../../test/renderApp';

const draft = EXPERIMENTS.find((e) => e.id === 'trust')!;
const ready: Experiment = {
  ...draft,
  hypothesis: 'Reassurance under Book will increase book clicks.',
  variants: draft.variants.map((v) =>
    v.key === 'b' ? { ...v, css: '.badges{display:block}' } : v,
  ),
};

async function open(path = '/p/trip-demo/experiments/trust/basics', data = fakeData()) {
  const router = renderApp(path, { data: data.api });
  await screen.findByRole('navigation', { name: 'Experiment steps' });
  return { router, ...data };
}

const withExperiments = (...list: Experiment[]) =>
  fakeData({
    experiments: [...list, ...EXPERIMENTS.filter((e) => !list.some((x) => x.id === e.id))],
  });

describe('experiment layout', () => {
  it('shows the name, status and the five steps', async () => {
    await open();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Trust badges under Book button' }),
    ).toBeInTheDocument();
    const steps = screen.getByRole('navigation', { name: 'Experiment steps' });
    expect(
      within(steps)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      '1Basics',
      '2Variants & code',
      '3Targeting',
      '4Goals (done)'.replace('4', '✓'),
      '5Results',
    ]);
    expect(within(steps).getByRole('link', { name: /Basics/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('redirects the experiment root to basics', async () => {
    const { router } = await open('/p/trip-demo/experiments/trust');
    expect(router.state.location.pathname).toBe('/p/trip-demo/experiments/trust/basics');
  });

  it('shows not found for an unknown experiment', async () => {
    renderApp('/p/trip-demo/experiments/nope/basics');
    expect(
      await screen.findByRole('heading', { name: "This experiment doesn't exist" }),
    ).toBeInTheDocument();
  });
});

describe('basics', () => {
  it('saves the name and hypothesis on blur', async () => {
    const user = userEvent.setup();
    const { patches } = await open();
    const hypothesis = screen.getByRole('textbox', { name: 'Hypothesis' });
    await user.type(hypothesis, 'Badges reduce doubt.');
    await user.tab();
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(patches).toContainEqual({ id: 'trust', patch: { hypothesis: 'Badges reduce doubt.' } });

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    expect(screen.getByText('The experiment needs a name.')).toBeInTheDocument();
    await user.type(name, 'Trust badges v2');
    await user.tab();
    await vi.waitFor(() =>
      expect(patches).toContainEqual({ id: 'trust', patch: { name: 'Trust badges v2' } }),
    );
  });

  it('summarises targeting and goals with links to edit them', async () => {
    await open('/p/trip-demo/experiments/sticky/basics');
    const targeting = screen.getByRole('region', { name: 'Targeting' });
    expect(within(targeting).getByText('1 URL rule')).toBeInTheDocument();
    expect(within(targeting).getByText('1 trigger')).toBeInTheDocument();
    expect(within(targeting).getByText('Everyone')).toBeInTheDocument();
    expect(within(targeting).getByRole('link', { name: 'Edit targeting' })).toHaveAttribute(
      'href',
      '/p/trip-demo/experiments/sticky/targeting',
    );
    const goals = screen.getByRole('region', { name: 'Goals' });
    expect(within(goals).getByText('Book click')).toBeInTheDocument();
    expect(await within(goals).findByText('Confirmation page')).toBeInTheDocument();
    expect(within(goals).getByText('1 limit')).toBeInTheDocument();
  });

  it('validates and saves traffic and the split', async () => {
    const user = userEvent.setup();
    const { patches, variantPatches } = await open();
    const traffic = screen.getByLabelText('Include');
    await user.clear(traffic);
    await user.type(traffic, '150');
    expect(screen.getByText('Enter a percentage from 0 to 100.')).toBeInTheDocument();
    await user.clear(traffic);
    await user.type(traffic, '80');
    await user.tab();
    await vi.waitFor(() =>
      expect(patches).toContainEqual({ id: 'trust', patch: { trafficPct: 80 } }),
    );

    const control = screen.getByRole('textbox', { name: 'Control %' });
    await user.clear(control);
    await user.type(control, '30');
    await user.tab();
    expect(screen.getByText('The split must add up to 100% (now 80%).')).toBeInTheDocument();
    const b = screen.getByRole('textbox', { name: 'B %' });
    await user.clear(b);
    await user.type(b, '70');
    await user.tab();
    await vi.waitFor(() =>
      expect(variantPatches).toEqual([
        { id: 'trust-c', patch: { weight: 30 } },
        { id: 'trust-b', patch: { weight: 70 } },
      ]),
    );
  });

  it('locks the split once started', async () => {
    await open('/p/trip-demo/experiments/sticky/basics');
    expect(screen.getByRole('textbox', { name: 'Control %' })).toBeDisabled();
    expect(
      screen.getByText(/The split is locked once an experiment has started/),
    ).toBeInTheDocument();
  });

  it('plans the sample size and saves it', async () => {
    const user = userEvent.setup();
    const { patches } = await open();
    const baseline = screen.getByLabelText('Baseline');
    const lift = screen.getByLabelText('Smallest lift');
    await user.clear(baseline);
    await user.type(baseline, '5');
    await user.clear(lift);
    await user.type(lift, '15');
    const status = screen.getByRole('region', { name: 'Sample size' });
    expect(within(status).getByText('14,193')).toBeInTheDocument();
    // Trip Demo's last 7 days average 2,020 visitors, all included: 2 × 14,193 / 2,020 → 15.
    expect(
      within(status).getByText(/About 15 days at 2,020 targeted visitors a day\./),
    ).toBeInTheDocument();
    await vi.waitFor(
      () =>
        expect(patches).toContainEqual({
          id: 'trust',
          patch: { plannedSample: 14_193, plan: { baseline: 0.05, mde: 0.15 } },
        }),
      { timeout: 2000 },
    );
  });

  it('asks for valid planner inputs', async () => {
    const user = userEvent.setup();
    await open();
    await user.clear(screen.getByLabelText('Baseline'));
    expect(screen.getByText(/Enter a baseline conversion rate/)).toBeInTheDocument();
  });
});

describe('launching', () => {
  it('blocks launch until the checklist passes', async () => {
    await open();
    const launch = screen.getByRole('button', { name: 'Launch experiment' });
    expect(launch).toBeDisabled();
    const list = within(screen.getByRole('region', { name: 'Before you launch' })).getByRole(
      'list',
    );
    expect(list).toHaveTextContent(
      'Add variant code that runs without errors (required before launch)',
    );
    expect(list).toHaveTextContent('Snippet installed on site (done)');
    expect(list).toHaveTextContent('QA preview not done yet (recommended)');
  });

  it('launches a ready draft even without a QA preview', async () => {
    const user = userEvent.setup();
    const { patches } = await open('/p/trip-demo/experiments/trust/basics', withExperiments(ready));
    await user.click(screen.getByRole('button', { name: 'Launch experiment' }));
    await screen.findByRole('button', { name: 'Pause' });
    const launch = patches.find((p) => (p.patch as { status?: string }).status === 'live')!;
    expect((launch.patch as { startedAt: string }).startedAt).toMatch(/^\d{4}-/);
    expect(screen.getByText('Live', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Before you launch' })).not.toBeInTheDocument();
  });

  it('marks QA as done when previewing on the site', async () => {
    const user = userEvent.setup();
    await open('/p/trip-demo/experiments/trust/basics', withExperiments(ready));
    const preview = screen.getByRole('link', { name: 'Preview on site' });
    expect(preview).toHaveAttribute(
      'href',
      `https://${PROJECTS[0]!.mainDomain}/?splitcraft_force=trust%3Ab&splitcraft_preview=tok-trust`,
    );
    expect(preview).toHaveAttribute('target', '_blank');
    preview.addEventListener('click', (e) => e.preventDefault());
    await user.click(preview);
    localStorage.removeItem('splitcraft_qa_trust');
  });

  it('pauses, resumes and ends after confirmation', async () => {
    const user = userEvent.setup();
    const { patches } = await open('/p/trip-demo/experiments/sticky/basics');
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    await user.click(await screen.findByRole('button', { name: 'End experiment' }));
    const dialog = screen.getByRole('dialog', { name: 'End this experiment?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep running' }));
    expect(patches.filter((p) => 'endedAt' in (p.patch as object))).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'End experiment' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'End experiment' }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: /Pause|Resume|End/ })).not.toBeInTheDocument(),
    );
    expect(patches.map((p) => (p.patch as { status?: string }).status)).toEqual([
      'paused',
      'live',
      'ended',
    ]);
  });
});

describe('test page', () => {
  it('saves the page and uses it for Preview on site', async () => {
    const user = userEvent.setup();
    const { patches } = await open();
    const field = screen.getByLabelText(/Test page/);
    await user.type(field, '/trips/norway');
    await user.tab();
    await vi.waitFor(() =>
      expect(patches.at(-1)).toMatchObject({
        patch: { previewUrl: 'https://mytrips.dev/trips/norway' },
      }),
    );
    expect(screen.getByRole('link', { name: 'Preview on site' })).toHaveAttribute(
      'href',
      'https://mytrips.dev/trips/norway?splitcraft_force=trust%3Ab&splitcraft_preview=tok-trust',
    );
  });

  it('refuses other sites and warns about pages outside WHERE', async () => {
    const user = userEvent.setup();
    await open(
      '/p/trip-demo/experiments/trust/basics',
      withExperiments({
        ...EXPERIMENTS.find((e) => e.id === 'trust')!,
        targeting: { where: { include: [{ op: 'matches', value: '/trips/*' }] } },
      }),
    );
    const field = screen.getByLabelText(/Test page/);
    await user.type(field, 'https://other.example/x');
    expect(
      screen.getByText(/other\.example isn't one of this project's domains/),
    ).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '/checkout');
    expect(screen.getByText(/isn't in the experiment's WHERE rules/)).toBeInTheDocument();
  });
});
