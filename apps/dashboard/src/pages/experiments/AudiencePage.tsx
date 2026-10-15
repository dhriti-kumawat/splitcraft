import { useState } from 'react';
import { Link } from 'react-router';
import { ConditionBuilder } from '../../components/ConditionBuilder';
import { Menu } from '../../components/Menu';
import { SaveAsDialog } from '../../components/SavedPicker';
import {
  useSegmentMutations,
  useSegmentsQuery,
  useSessionSampleQuery,
  useUpdateExperiment,
} from '../../data/queries';
import { describeGroups, groupsProblemCount } from '../../lib/conditions';
import { evaluateGroup, share } from '../../lib/reach';
import { fromGroups, toGroups } from '../../lib/segments';
import type { ConditionGroup, StoredTargeting } from '../../lib/targeting';
import { useExperiment } from './experimentContext';
import { ReachEstimate, SaveBar, whoSentence } from './targetingShared';
import styles from './TargetingPage.module.css';

/**
 * Experiment step: who can see the test. Everyone, or specific visitors: saved audiences
 * (shared with other tests, edited in Audiences) and/or conditions for this test only,
 * which can be saved as an audience to reuse. Like Optimizely's and VWO's audience step.
 */
export function AudiencePage() {
  const { experiment, project } = useExperiment();
  const update = useUpdateExperiment(experiment);
  const segments = useSegmentsQuery(project.id);
  const sample = useSessionSampleQuery(project.id);
  const segmentMutations = useSegmentMutations(project.id);
  const t = experiment.targeting;

  const [specific, setSpecific] = useState(Boolean(t.who));
  const [mode, setMode] = useState<'any' | 'all'>(t.who?.mode ?? 'any');
  const [segmentIds, setSegmentIds] = useState<string[]>(t.who?.segmentIds ?? []);
  const [groups, setGroups] = useState<ConditionGroup[]>(() =>
    t.who?.rules ? toGroups(t.who.rules) : [],
  );
  const [submitted, setSubmitted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const own = groups.filter((g) => g.items.length);
  const who: StoredTargeting['who'] =
    specific && (segmentIds.length || own.length)
      ? { mode, segmentIds, ...(own.length ? { rules: fromGroups(own) } : {}) }
      : undefined;
  // Only WHO changes here; pages, triggers and timing stay as the Targeting step saved them.
  const { who: _old, ...rest } = t;
  void _old;
  const next: StoredTargeting = { ...rest, ...(who ? { who } : {}) };
  // "Specific visitors" with nothing chosen yet is a change too (Save then explains why not).
  const snapshot = JSON.stringify(who ?? (specific ? 'incomplete' : null));
  const dirty = snapshot !== JSON.stringify(t.who ?? null);
  const problems =
    groupsProblemCount(groups) + (specific && !segmentIds.length && !own.length ? 1 : 0);
  const ended = experiment.status === 'ended';

  const save = () => {
    setSubmitted(true);
    if (problems) return;
    update.mutate({ targeting: next }, { onSuccess: () => setSavedSnapshot(snapshot) });
  };

  const byId = new Map((segments.data ?? []).map((s) => [s.id, s]));
  const name = (id: string) => byId.get(id)?.name ?? 'Deleted audience';
  const available = (segments.data ?? []).filter((s) => !segmentIds.includes(s.id));
  const parts = segmentIds.length + (own.length ? 1 : 0);

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.section} aria-labelledby="aud-h">
          <div className={styles.titleBlock}>
            <h2 className={styles.title} id="aud-h">
              Who can see this test
            </h2>
            <span className={styles.sub}>
              Traits that stay true across visits, like device, country, new or returning, or where
              they first came from. Pages and timing are set in Targeting.
            </span>
          </div>

          <div className={styles.choices} role="radiogroup" aria-label="Audience">
            <label className={styles.choice}>
              <input
                type="radio"
                name="audience"
                checked={!specific}
                onChange={() => setSpecific(false)}
              />
              <span>
                <b>Everyone</b>
                <span className={styles.sub}>All visitors on the test&apos;s pages.</span>
              </span>
            </label>
            <label className={styles.choice}>
              <input
                type="radio"
                name="audience"
                checked={specific}
                onChange={() => setSpecific(true)}
              />
              <span>
                <b>Specific visitors</b>
                <span className={styles.sub}>
                  Use saved audiences, or set conditions for this test only.
                </span>
              </span>
            </label>
          </div>
        </section>

        {specific && (
          <>
            <section className={styles.section} aria-labelledby="saved-h">
              <div className={styles.head}>
                <div className={styles.titleBlock}>
                  <h2 className={styles.title} id="saved-h">
                    Saved audiences
                  </h2>
                  <span className={styles.sub}>
                    Shared across tests. Editing one in{' '}
                    <Link to={`/p/${project.id}/audiences`}>Audiences</Link> changes every test that
                    uses it.
                  </span>
                </div>
                <Menu
                  text
                  label="Add saved audience"
                  items={[
                    ...available.map((seg) => ({
                      label: seg.name,
                      onSelect: () => setSegmentIds((ids) => [...ids, seg.id]),
                    })),
                    {
                      label: 'Create or edit audiences…',
                      onSelect: () =>
                        window.open(`/p/${project.id}/audiences`, '_blank', 'noopener'),
                    },
                  ]}
                >
                  + Add saved audience
                </Menu>
              </div>
              {segmentIds.length === 0 ? (
                <span className={styles.sub}>
                  {segments.isError
                    ? "Couldn't load saved audiences."
                    : segments.isSuccess && segments.data.length === 0
                      ? 'No saved audiences yet. Build conditions below and save them as one.'
                      : 'None added.'}
                </span>
              ) : (
                <ul className={styles.audienceList}>
                  {segmentIds.map((id) => (
                    <li key={id} className={styles.audienceItem}>
                      <span className={styles.audienceText}>
                        <b>{name(id)}</b>
                        <span className={styles.sub}>
                          {byId.get(id)
                            ? describeGroups(toGroups(byId.get(id)!.rules))
                            : 'Deleted: matches nobody until you remove it.'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`Remove ${name(id)}`}
                        onClick={() => setSegmentIds((ids) => ids.filter((x) => x !== id))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.section} aria-labelledby="own-h">
              <div className={styles.titleBlock}>
                <h2 className={styles.title} id="own-h">
                  Only for this test
                </h2>
                <span className={styles.sub}>
                  Conditions that belong to this test. Save them as an audience to reuse them.
                </span>
              </div>
              <ConditionBuilder
                groups={groups}
                onChange={setGroups}
                noun="Audience"
                emptyText="None yet. Add a group to set conditions for this test only."
                estimate={
                  sample.data
                    ? (g) => share(sample.data.sample, (s) => evaluateGroup(g, s))
                    : undefined
                }
              />
              {own.length > 0 && groupsProblemCount(groups) === 0 && (
                <button type="button" className={styles.saveAs} onClick={() => setSaving(true)}>
                  Save as an audience to reuse in other tests
                </button>
              )}
            </section>

            {parts > 1 && (
              <section className={styles.section} aria-labelledby="match-h">
                <div className={styles.row}>
                  <h2 className={styles.title} id="match-h">
                    Visitors must match
                  </h2>
                  <div className={styles.seg} role="group" aria-labelledby="match-h">
                    {(
                      [
                        ['any', 'Any of them'],
                        ['all', 'All of them'],
                      ] as const
                    ).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        className={styles.segButton}
                        aria-pressed={mode === m}
                        onClick={() => setMode(m)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        <SaveBar
          label="Save audience"
          onSave={save}
          disabled={!dirty || update.isPending || ended}
          error={update.isError || (submitted && problems > 0)}
          status={
            update.isError
              ? `Couldn't save: ${update.error.message}`
              : submitted && problems
                ? specific && !segmentIds.length && !own.length
                  ? 'Add a saved audience or a condition, or choose Everyone.'
                  : `${problems} ${problems === 1 ? 'condition needs' : 'conditions need'} a value.`
                : savedSnapshot === snapshot
                  ? 'Saved.'
                  : dirty
                    ? 'Unsaved changes'
                    : ''
          }
          note={
            experiment.status === 'live' && dirty
              ? "Live: the new audience applies from each visitor's next page."
              : undefined
          }
        />
        {message && (
          <p role="status" className={styles.status}>
            {message}
          </p>
        )}
        {saving && (
          <SaveAsDialog
            title="Save as audience"
            description="Other tests can add it from Add saved audience. Edits in Audiences then apply to every test that uses it."
            placeholder="High-intent returners"
            pending={segmentMutations.create.isPending}
            error={segmentMutations.create.error?.message}
            onClose={() => setSaving(false)}
            onSave={(audienceName) =>
              segmentMutations.create.mutate(
                { name: audienceName, rules: fromGroups(own) },
                {
                  onSuccess: (segment) => {
                    // The test now uses the saved audience instead of its own copy.
                    setSegmentIds((ids) => [...ids, segment.id]);
                    setGroups([]);
                    setSaving(false);
                    setMessage(
                      `Saved “${audienceName}” to Audiences. Save audience to use it in this test.`,
                    );
                  },
                },
              )
            }
          />
        )}
      </div>

      <aside className={styles.aside} aria-label="Audience check">
        <section className={styles.section} aria-labelledby="who-see">
          <span className={styles.lbl} id="who-see">
            Who will see this
          </span>
          <span className={styles.who}>{whoSentence(next, name)}</span>
          <ReachEstimate
            projectId={project.id}
            targeting={next}
            segments={segments.data ?? []}
            trafficPct={experiment.trafficPct}
            plannedSample={experiment.plannedSample}
            arms={experiment.variants.length}
          />
        </section>
      </aside>
    </div>
  );
}
