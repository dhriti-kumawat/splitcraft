import { useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { Pill } from '../../components/Pill';
import { useExperimentQuery, useUpdateExperiment } from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import {
  canLaunch,
  launchChecks,
  markQaDone,
  previewUrl,
  qaDone,
  variantsReady,
} from '../../lib/launch';
import { NotFoundPage } from '../NotFoundPage';
import type { ExperimentContext } from './experimentContext';
import styles from './ExperimentLayout.module.css';

const STATUS = { draft: 'Draft', live: 'Live', paused: 'Paused', ended: 'Ended' } as const;

/** Header, actions and the 5-step stepper shared by every experiment screen. */
export function ExperimentLayout() {
  const { expId } = useParams();
  const project = useCurrentProject()!;
  const query = useExperimentQuery(expId!);

  if (query.isPending) return <p aria-busy="true">Loading experiment…</p>;
  if (query.isError) return <p role="alert">Couldn't load the experiment: {query.error.message}</p>;
  const experiment = query.data;
  if (!experiment || experiment.projectId !== project.id) return <NotFoundPage what="experiment" />;

  const base = `/p/${project.id}/experiments/${experiment.id}`;
  const steps = [
    { path: 'basics', label: 'Basics', done: experiment.hypothesis.trim().length > 0 },
    { path: 'variants', label: 'Variants & code', done: variantsReady(experiment) },
    {
      path: 'targeting',
      label: 'Targeting',
      done: Boolean(
        experiment.targeting.where?.include?.length ||
        experiment.targeting.who?.segmentIds.length ||
        experiment.targeting.how?.length,
      ),
    },
    { path: 'goals', label: 'Goals', done: Boolean(experiment.primaryMetricId) },
    { path: 'results', label: 'Results', done: experiment.status === 'ended' },
  ];

  return (
    <>
      <Actions experiment={experiment} project={project} />
      <div className={styles.band}>
        <div className={styles.title}>
          <h1>{experiment.name}</h1>
          <Pill tone={experiment.status}>{STATUS[experiment.status]}</Pill>
        </div>
        <nav aria-label="Experiment steps">
          <ol className={styles.steps}>
            {steps.map((step, i) => (
              <li key={step.path}>
                <NavLink to={`${base}/${step.path}`} className={styles.step}>
                  <span
                    className={`${styles.number} ${step.done ? styles.done : ''}`}
                    aria-hidden="true"
                  >
                    {step.done ? '✓' : i + 1}
                  </span>
                  {step.label}
                  {step.done && <span className="visually-hidden"> (done)</span>}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <Outlet context={{ experiment, project } satisfies ExperimentContext} />
    </>
  );
}

function Actions({ experiment, project }: ExperimentContext) {
  const update = useUpdateExperiment(experiment);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [qa, setQa] = useState(() => qaDone(experiment.id));
  const ready = canLaunch(launchChecks(experiment, project, qa));
  const now = () => new Date().toISOString();

  return (
    <TopBarActions>
      {update.isError && (
        <span className={styles.error} role="alert">
          {update.error.message}
        </span>
      )}
      {experiment.status !== 'ended' && (
        <a
          className={styles.linkButton}
          href={previewUrl(experiment, project)}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            markQaDone(experiment.id);
            setQa(true);
          }}
        >
          Preview on site
        </a>
      )}
      {experiment.status === 'draft' && (
        <Button
          disabled={!ready || update.isPending}
          aria-describedby={ready ? undefined : 'launch-blockers'}
          onClick={() => update.mutate({ status: 'live', startedAt: now() })}
        >
          Launch experiment
        </Button>
      )}
      {experiment.status === 'live' && (
        <>
          <Button
            variant="secondary"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: 'paused' })}
          >
            Pause
          </Button>
          <button type="button" className={styles.danger} onClick={() => setConfirmEnd(true)}>
            End experiment
          </button>
        </>
      )}
      {experiment.status === 'paused' && (
        <>
          <Button disabled={update.isPending} onClick={() => update.mutate({ status: 'live' })}>
            Resume
          </Button>
          <button type="button" className={styles.danger} onClick={() => setConfirmEnd(true)}>
            End experiment
          </button>
        </>
      )}
      {confirmEnd && (
        <Dialog
          title="End this experiment?"
          description="Visitors stop seeing variants and results freeze. An ended experiment can't be restarted; create a new one to test again."
          onClose={() => setConfirmEnd(false)}
        >
          <div className={dialogStyles.foot}>
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              Keep running
            </Button>
            <Button
              onClick={() => {
                update.mutate({ status: 'ended', endedAt: now() });
                setConfirmEnd(false);
              }}
            >
              End experiment
            </Button>
          </div>
        </Dialog>
      )}
    </TopBarActions>
  );
}
