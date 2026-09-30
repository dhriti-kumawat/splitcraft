import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { MoreIcon } from '../../components/icons';
import { Menu, type MenuItem } from '../../components/Menu';
import { Pill } from '../../components/Pill';
import {
  useDeleteExperiment,
  useDuplicateExperiment,
  useExperimentQuery,
  useMetricsQuery,
  useUpdateExperiment,
} from '../../data/queries';
import { useCurrentProject, useWorkspace } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import {
  canLaunch,
  launchChecks,
  markQaDone,
  testPage,
  qaDone,
  variantsReady,
} from '../../lib/launch';
import { percent } from '../../lib/experiments';
import {
  openWithExtension,
  previewState,
  projectHosts,
  stopPreview,
  updatePreview,
  useExtension,
  usePreviewSession,
} from '../../lib/previewBridge';
import { NotFoundPage } from '../NotFoundPage';
import type { ExperimentContext } from './experimentContext';
import styles from './ExperimentLayout.module.css';
import { PreviewDialog } from './PreviewDialog';
import { TypeTag } from './TypeTag';

const VARIANTS_STEP = {
  ab: 'Variations & code',
  split_url: 'Variation pages',
  mvt: 'Variations',
} as const;

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
    { path: 'variants', label: VARIANTS_STEP[experiment.type], done: variantsReady(experiment) },
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
          <TypeTag type={experiment.type} />
          {experiment.archivedAt && <Pill tone="draft">Archived</Pill>}
        </div>
        {experiment.status === 'paused' && experiment.autoPaused && (
          <AutoPauseNote experiment={experiment} projectId={project.id} />
        )}
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
  const duplicate = useDuplicateExperiment(experiment);
  const navigate = useNavigate();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qa, setQa] = useState(() => qaDone(experiment.id));
  const ready = canLaunch(launchChecks(experiment, project, qa));
  const now = () => new Date().toISOString();
  const archived = Boolean(experiment.archivedAt);
  const error = update.error ?? duplicate.error;

  return (
    <TopBarActions>
      {error && (
        <span className={styles.error} role="alert">
          {error.message}
        </span>
      )}
      {experiment.status !== 'ended' && !archived && (
        <PreviewButton experiment={experiment} project={project} onPreviewed={() => setQa(true)} />
      )}
      {experiment.status === 'draft' && !archived && (
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
      {experiment.status === 'paused' && !archived && (
        <>
          <Button disabled={update.isPending} onClick={() => update.mutate({ status: 'live' })}>
            Resume
          </Button>
          <button type="button" className={styles.danger} onClick={() => setConfirmEnd(true)}>
            End experiment
          </button>
        </>
      )}
      <MoreActions
        experiment={experiment}
        onDuplicate={() =>
          duplicate.mutate(undefined, {
            onSuccess: (copy) => navigate(`/p/${project.id}/experiments/${copy.id}/basics`),
          })
        }
        onArchive={(on) => update.mutate({ archivedAt: on ? now() : null })}
        onDelete={() => setConfirmDelete(true)}
      />
      {confirmDelete && (
        <DeleteDialog
          experiment={experiment}
          onDeleted={() => navigate(`/p/${project.id}/experiments`, { replace: true })}
          onClose={() => setConfirmDelete(false)}
        />
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

function MoreActions({
  experiment,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  experiment: ExperimentContext['experiment'];
  onDuplicate(): void;
  onArchive(on: boolean): void;
  onDelete(): void;
}) {
  const { user } = useWorkspace();
  const live = experiment.status === 'live';
  const stopFirst = live ? 'End or pause it first.' : undefined;
  const items: MenuItem[] = [
    { label: 'Duplicate', onSelect: onDuplicate },
    experiment.archivedAt
      ? { label: 'Unarchive', onSelect: () => onArchive(false) }
      : { label: 'Archive', onSelect: () => onArchive(true), disabledReason: stopFirst },
    {
      label: 'Delete',
      onSelect: onDelete,
      danger: true,
      disabledReason:
        user.role === 'member' ? 'Only workspace owners and admins can delete.' : stopFirst,
    },
  ];
  return (
    <Menu label="More actions" items={items}>
      <MoreIcon />
    </Menu>
  );
}

function DeleteDialog({
  experiment,
  onDeleted,
  onClose,
}: {
  experiment: ExperimentContext['experiment'];
  onDeleted(): void;
  onClose(): void;
}) {
  const remove = useDeleteExperiment(experiment);
  return (
    <Dialog
      title={`Delete “${experiment.name}”?`}
      description="This permanently deletes the experiment, its variant code and history, and every event it collected. It can't be undone. Archive it instead to keep the results."
      onClose={onClose}
    >
      {remove.isError && (
        <div className={dialogStyles.body}>
          <div role="alert" className={dialogStyles.alert}>
            Couldn't delete: {remove.error.message}
          </div>
        </div>
      )}
      <div className={dialogStyles.foot}>
        <Button variant="secondary" onClick={onClose}>
          Keep experiment
        </Button>
        <button
          type="button"
          className={styles.dangerButton}
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })}
        >
          {remove.isPending ? 'Deleting…' : 'Delete experiment'}
        </button>
      </div>
    </Dialog>
  );
}

function AutoPauseNote({
  experiment,
  projectId,
}: {
  experiment: ExperimentContext['experiment'];
  projectId: string;
}) {
  const metrics = useMetricsQuery(projectId);
  const p = experiment.autoPaused!;
  const metric = metrics.data?.find((m) => m.id === p.metricId)?.name ?? 'A guardrail';
  const variant = experiment.variants.find((v) => v.key === p.variantKey)?.name ?? p.variantKey;
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(p.at),
  );
  return (
    <p className={styles.autoPause} role="status">
      <strong>Paused automatically on {date}.</strong> {metric} in {variant} changed{' '}
      {percent(p.uplift)} (95% range {percent(p.upliftLow)} to {percent(p.upliftHigh)}), past its{' '}
      {p.maxPct}% limit. Check the results before resuming; once resumed, guardrails won't pause it
      again.
    </p>
  );
}

/**
 * "Preview on site": with the extension installed it opens the preview at once (the
 * arrow shows the other ways); without it, the dialog explains the options.
 */
function PreviewButton({
  experiment,
  project,
  onPreviewed,
}: ExperimentContext & { onPreviewed(): void }) {
  const ext = useExtension();
  const active = usePreviewSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const live = active?.experimentKey === experiment.key;

  // Keep the preview in step with saved changes (the editors also send unsaved ones).
  useEffect(() => {
    if (live) updatePreview(previewState(experiment));
  }, [live, experiment]);

  const quick = () => {
    setError('');
    openWithExtension(
      testPage(experiment, project),
      projectHosts(project),
      previewState(experiment),
    ).then(
      () => {
        markQaDone(experiment.id);
        onPreviewed();
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  };

  return (
    <>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
      {live && (
        <span className={styles.livePreview} role="status">
          Previewing live
          <button type="button" className={styles.stopPreview} onClick={stopPreview}>
            Stop
          </button>
        </span>
      )}
      <span className={styles.previewGroup}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => (ext ? quick() : setOpen(true))}
        >
          Preview on site
        </button>
        {ext && (
          <button
            type="button"
            className={styles.previewMore}
            aria-label="Other ways to preview"
            onClick={() => setOpen(true)}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        )}
      </span>
      {open && (
        <PreviewDialog
          experiment={experiment}
          project={project}
          onClose={() => {
            setOpen(false);
            if (qaDone(experiment.id)) onPreviewed();
          }}
        />
      )}
    </>
  );
}
