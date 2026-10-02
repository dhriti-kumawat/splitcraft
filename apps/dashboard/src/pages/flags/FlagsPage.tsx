import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { PlusIcon } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import type { FeatureFlag, Segment } from '../../data/api';
import { useFlagMutations, useFlagsQuery, useSegmentsQuery } from '../../data/queries';
import { experimentKey } from '../../data/supabaseData';
import { useCurrentProject } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import styles from './FlagsPage.module.css';

/** Project › Feature flags: turn code paths on for a share of visitors or a segment. */
export function FlagsPage() {
  const project = useCurrentProject()!;
  const flags = useFlagsQuery(project.id);
  const segments = useSegmentsQuery(project.id);
  const { update, remove } = useFlagMutations(project.id);
  const [creating, setCreating] = useState(false);
  const failed = update.error ?? remove.error;

  return (
    <>
      <TopBarActions>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon />
          New flag
        </Button>
      </TopBarActions>
      <PageHeader
        title="Feature flags"
        description="Ship code turned off, then roll it out to a share of visitors or a segment. No deploy needed to change it."
      />
      {failed && (
        <p role="alert" className={styles.error}>
          Couldn't save: {failed.message}
        </p>
      )}
      <div className={styles.tableWrap}>
        {flags.isPending ? (
          <p className={styles.empty} aria-busy="true">
            Loading flags…
          </p>
        ) : flags.isError ? (
          <p className={styles.empty} role="alert">
            Couldn't load flags: {flags.error.message}
          </p>
        ) : flags.data.length === 0 ? (
          <div className={styles.empty}>
            <p>No flags yet. Create one, then check it in your code:</p>
            <code className={styles.code}>
              {"if (splitcraft.isEnabled('new-checkout')) { /* new code */ }"}
            </code>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Flag</th>
                <th scope="col">On</th>
                <th scope="col">Rollout</th>
                <th scope="col">Who</th>
                <th scope="col">
                  <span className="visually-hidden">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {flags.data.map((f) => (
                <FlagRow
                  key={`${f.id}:${f.rolloutPct}`}
                  flag={f}
                  segments={segments.data ?? []}
                  onChange={(patch) => update.mutate({ id: f.id, patch })}
                  onDelete={() => remove.mutate(f.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className={styles.note}>
        In your code: <code>{"splitcraft.isEnabled('flag-key')"}</code> returns true for visitors
        the flag is on for. Raising the rollout only adds visitors; nobody who has it loses it.
      </p>
      {creating && <NewFlagDialog projectId={project.id} onClose={() => setCreating(false)} />}
    </>
  );
}

function FlagRow({
  flag,
  segments,
  onChange,
  onDelete,
}: {
  flag: FeatureFlag;
  segments: Segment[];
  onChange(patch: Partial<FeatureFlag>): void;
  onDelete(): void;
}) {
  const [pct, setPct] = useState(String(flag.rolloutPct));
  const ids = { name: useId(), pct: useId(), who: useId() };
  const n = Number(pct);
  const bad = pct.trim() === '' || !(n >= 0 && n <= 100);
  return (
    <tr>
      <td>
        <span className={styles.name} id={ids.name}>
          {flag.name}
        </span>
        <span className={styles.key}>{flag.key}</span>
      </td>
      <td>
        <button
          type="button"
          role="switch"
          aria-checked={flag.enabled}
          aria-label={`${flag.name} on`}
          className={styles.switch}
          onClick={() => onChange({ enabled: !flag.enabled })}
        >
          <span className={styles.knob} aria-hidden="true" />
        </button>
      </td>
      <td>
        <span className={styles.pctRow}>
          <input
            id={ids.pct}
            className={styles.pct}
            inputMode="decimal"
            value={pct}
            aria-label={`${flag.name} rollout percentage`}
            aria-invalid={bad}
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => !bad && n !== flag.rolloutPct && onChange({ rolloutPct: n })}
          />
          %
        </span>
      </td>
      <td>
        <select
          id={ids.who}
          className={styles.select}
          aria-label={`${flag.name} audience`}
          value={flag.segmentIds[0] ?? ''}
          onChange={(e) => onChange({ segmentIds: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">Everyone</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className={styles.remove}
          onClick={onDelete}
          aria-label={`Delete ${flag.name}`}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function NewFlagDialog({ projectId, onClose }: { projectId: string; onClose(): void }) {
  const { create } = useFlagMutations(projectId);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const ids = { name: useId(), key: useId() };
  const finalKey = keyEdited ? key.trim() : experimentKey(name);
  const errors = {
    name: name.trim() ? '' : 'Name the flag, e.g. "New checkout".',
    key: /^[A-Za-z0-9_.-]{1,80}$/.test(finalKey)
      ? ''
      : 'Use letters, numbers, dots, dashes and underscores.',
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.name || errors.key) return;
    create.mutate({ name: name.trim(), key: finalKey }, { onSuccess: onClose });
  };

  return (
    <Dialog
      title="New feature flag"
      description="It starts off. Turn it on when the code is live."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className={dialogStyles.body}>
          {create.isError && (
            <div role="alert" className={dialogStyles.alert}>
              {create.error.message}
            </div>
          )}
          <div className={dialogStyles.field}>
            <label htmlFor={ids.name} className={dialogStyles.label}>
              Name
            </label>
            <input
              id={ids.name}
              className={dialogStyles.input}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={submitted && Boolean(errors.name)}
            />
            {submitted && errors.name && <span className={dialogStyles.error}>{errors.name}</span>}
          </div>
          <div className={dialogStyles.field}>
            <label htmlFor={ids.key} className={dialogStyles.label}>
              Key, used in your code
            </label>
            <input
              id={ids.key}
              className={`${dialogStyles.input} mono`}
              value={finalKey}
              maxLength={80}
              onChange={(e) => {
                setKeyEdited(true);
                setKey(e.target.value);
              }}
              aria-invalid={submitted && Boolean(errors.key)}
            />
            {submitted && errors.key && <span className={dialogStyles.error}>{errors.key}</span>}
          </div>
        </div>
        <div className={dialogStyles.foot}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create flag'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
