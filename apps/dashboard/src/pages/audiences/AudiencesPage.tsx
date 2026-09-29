import { useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import buttonStyles from '../../components/Button.module.css';
import { ConditionBuilder } from '../../components/ConditionBuilder';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { PageHeader } from '../../components/PageHeader';
import type { Segment } from '../../data/api';
import { useExperimentsQuery, useSegmentMutations, useSegmentsQuery } from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import { describeGroups, groupsProblemCount } from '../../lib/conditions';
import { fromGroups, toGroups } from '../../lib/segments';
import type { ConditionGroup } from '../../lib/targeting';
import styles from './AudiencesPage.module.css';

/** Project › Audiences: saved segments (20-segment-builder.html). */
export function AudiencesPage() {
  const project = useCurrentProject()!;
  const { segmentId } = useParams();
  const segments = useSegmentsQuery(project.id);
  const experiments = useExperimentsQuery(project.id);
  const base = `/p/${project.id}/audiences`;
  const usedBy = (id: string) =>
    (experiments.data ?? []).filter(
      (e) => e.targeting.who?.segmentIds.includes(id) && e.status !== 'ended',
    );

  const selected = segments.data?.find((s) => s.id === segmentId);
  const creating = segmentId === 'new';

  return (
    <>
      <TopBarActions>
        <Link to={`${base}/new`} className={`${buttonStyles.button} ${buttonStyles.primary}`}>
          + New segment
        </Link>
      </TopBarActions>
      <PageHeader
        title="Audiences"
        description="Segments describe who a visitor is across visits. Save them once and use them in any experiment."
      />
      <div className={styles.layout}>
        <nav className={styles.list} aria-labelledby="saved-segments">
          <div className={styles.listHead}>
            <span className={styles.lbl} id="saved-segments">
              Saved segments
            </span>
          </div>
          {segments.isPending ? (
            <span className={styles.status}>Loading…</span>
          ) : (
            <ul className={styles.items}>
              {segments.data?.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`${base}/${s.id}`}
                    className={styles.item}
                    aria-current={s.id === segmentId ? 'page' : undefined}
                  >
                    {s.name}
                    {usedBy(s.id).length > 0 && (
                      <span className={styles.used}>
                        {usedBy(s.id).length} {usedBy(s.id).length === 1 ? 'test' : 'tests'}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {segments.data?.length === 0 && <span className={styles.status}>No segments yet.</span>}
          <div className={styles.tip}>
            <strong>Reusable everywhere</strong>
            Save once, pick it in any experiment's targeting. Edits apply on the next page load.
          </div>
        </nav>

        {creating ? (
          <SegmentEditor key="new" projectId={project.id} usedBy={[]} />
        ) : selected ? (
          <SegmentEditor
            key={selected.id}
            projectId={project.id}
            segment={selected}
            usedBy={usedBy(selected.id).map((e) => e.name)}
          />
        ) : (
          <div className={`${styles.editor} ${styles.empty}`}>
            {segmentId && segments.isSuccess
              ? "This segment doesn't exist."
              : 'Pick a segment, or create a new one.'}
          </div>
        )}
      </div>
    </>
  );
}

function SegmentEditor({
  projectId,
  segment,
  usedBy,
}: {
  projectId: string;
  segment?: Segment;
  usedBy: string[];
}) {
  const { create, update, remove } = useSegmentMutations(projectId);
  const navigate = useNavigate();
  const [name, setName] = useState(segment?.name ?? '');
  const [groups, setGroups] = useState<ConditionGroup[]>(() =>
    segment ? toGroups(segment.rules) : [{ mode: 'all', items: [] }],
  );
  const [submitted, setSubmitted] = useState(false);
  // Snapshot of what was last saved, so "Saved" disappears as soon as anything changes.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = useId();
  const problems = groupsProblemCount(groups);
  const nameError = name.trim() ? '' : 'Name the segment.';
  const dirty =
    !segment ||
    name !== segment.name ||
    JSON.stringify(fromGroups(groups)) !== JSON.stringify(fromGroups(toGroups(segment.rules)));

  const snapshot = JSON.stringify({ name, groups });
  const saved = savedSnapshot === snapshot;

  const save = () => {
    setSubmitted(true);
    if (nameError || problems) return;
    const rules = fromGroups(groups.filter((g) => g.items.length > 0));
    if (segment) {
      update.mutate(
        { id: segment.id, name: name.trim(), rules },
        { onSuccess: () => setSavedSnapshot(snapshot) },
      );
    } else {
      create.mutate(
        { name: name.trim(), rules },
        { onSuccess: (s) => navigate(`/p/${projectId}/audiences/${s.id}`, { replace: true }) },
      );
    }
  };
  const failed = create.error ?? update.error ?? remove.error;

  return (
    <section
      className={styles.editor}
      aria-label={segment ? `Segment ${segment.name}` : 'New segment'}
    >
      <div className={styles.summary}>
        <span className={styles.lbl}>In plain words</span>
        <span className={styles.summaryText} aria-live="polite">
          {describeGroups(groups)}
        </span>
      </div>
      <div className={styles.nameRow}>
        <div className={styles.field}>
          <label htmlFor={id} className={styles.label}>
            Segment name
          </label>
          <input
            id={id}
            className={styles.input}
            value={name}
            maxLength={80}
            placeholder="High-intent returners"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && Boolean(nameError)}
            aria-describedby={submitted && nameError ? `${id}-err` : undefined}
          />
          {submitted && nameError && (
            <span id={`${id}-err`} className={styles.error}>
              {nameError}
            </span>
          )}
        </div>
      </div>
      <ConditionBuilder groups={groups} onChange={setGroups} noun="Segment" />
      <div className={styles.actions}>
        <Button
          onClick={save}
          disabled={create.isPending || update.isPending || (!dirty && Boolean(segment))}
        >
          {segment ? 'Save segment' : 'Create segment'}
        </Button>
        <span
          role="status"
          className={failed || (submitted && problems) ? styles.error : styles.status}
        >
          {failed
            ? `Couldn't save: ${failed.message}`
            : submitted && problems
              ? `${problems} ${problems === 1 ? 'condition needs' : 'conditions need'} a value.`
              : saved
                ? 'Saved. Live experiments use it from the next page load.'
                : dirty && segment
                  ? 'Unsaved changes'
                  : ''}
        </span>
        {segment && (
          <button
            type="button"
            className={styles.danger}
            style={{ marginLeft: 'auto' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete segment
          </button>
        )}
      </div>
      {confirmDelete && segment && (
        <Dialog
          title={`Delete “${segment.name}”?`}
          description={
            usedBy.length
              ? `It is used by ${usedBy.join(', ')}. Those experiments will match nobody from this segment until you change their targeting.`
              : 'This can’t be undone.'
          }
          onClose={() => setConfirmDelete(false)}
        >
          <div className={dialogStyles.foot}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep segment
            </Button>
            <Button
              onClick={() =>
                remove.mutate(segment.id, {
                  onSuccess: () => navigate(`/p/${projectId}/audiences`, { replace: true }),
                })
              }
            >
              Delete segment
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
