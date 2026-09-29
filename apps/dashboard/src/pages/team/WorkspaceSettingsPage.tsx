import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { PageHeader } from '../../components/PageHeader';
import { useWorkspaceMutations } from '../../data/queries';
import { useWorkspace } from '../../data/workspace';
import styles from './TeamPage.module.css';

/** Workspace › Settings: rename, and delete for owners. */
export function WorkspaceSettingsPage() {
  const { workspace, user, workspaces, selectWorkspace } = useWorkspace();
  const { rename, remove } = useWorkspaceMutations(user.id);
  const navigate = useNavigate();
  const [name, setName] = useState(workspace.name);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const ids = { name: useId(), confirm: useId() };
  const isOwner = user.role === 'owner';
  const error = name.trim() ? '' : 'Name the workspace.';

  return (
    <>
      <PageHeader title="Workspace settings" description={`Settings for ${workspace.name}.`} />
      <div className={styles.page}>
        <section className={styles.section} aria-labelledby="ws-general">
          <h2 className={styles.title} id="ws-general">
            General
          </h2>
          <div className={styles.form}>
            <div className={styles.field}>
              <label htmlFor={ids.name} className={styles.label}>
                Workspace name
              </label>
              <input
                id={ids.name}
                className={styles.input}
                value={name}
                maxLength={100}
                disabled={!isOwner}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${ids.name}-e` : undefined}
              />
              {error && (
                <span id={`${ids.name}-e`} className={styles.error}>
                  {error}
                </span>
              )}
            </div>
            <div className={styles.field} style={{ flex: '0 0 auto' }}>
              <span className={styles.label} aria-hidden="true">
                &nbsp;
              </span>
              <Button
                disabled={
                  !isOwner || Boolean(error) || name.trim() === workspace.name || rename.isPending
                }
                onClick={() => rename.mutate({ id: workspace.id, name: name.trim() })}
              >
                Save
              </Button>
            </div>
          </div>
          <p role="status" className={rename.isError ? styles.error : styles.sub}>
            {rename.isError
              ? `Couldn't save: ${rename.error.message}`
              : rename.isSuccess && name.trim() === workspace.name
                ? 'Saved.'
                : isOwner
                  ? `Plan: ${workspace.plan === 'free' ? 'Free, 100,000 events a month' : 'Pro'}.`
                  : 'Only owners can rename the workspace.'}
          </p>
        </section>

        <section className={`${styles.section} ${styles.danger}`} aria-labelledby="ws-danger">
          <div className={styles.dangerRow}>
            <div>
              <h2 className={styles.title} id="ws-danger">
                Delete this workspace
              </h2>
              <p className={styles.sub}>
                {isOwner
                  ? 'Deletes every project, experiment and event in it, and removes all members.'
                  : 'Only owners can delete the workspace.'}
              </p>
            </div>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={!isOwner}
              onClick={() => setConfirming(true)}
            >
              Delete workspace
            </button>
          </div>
        </section>
      </div>

      {confirming && (
        <Dialog
          title={`Delete “${workspace.name}”?`}
          description="This permanently deletes every project, experiment, audience, metric and event in the workspace. It can't be undone."
          onClose={() => {
            setConfirming(false);
            setTyped('');
          }}
        >
          <div className={dialogStyles.body}>
            {remove.isError && (
              <div role="alert" className={dialogStyles.alert}>
                Couldn't delete: {remove.error.message}
              </div>
            )}
            <div className={dialogStyles.field}>
              <label htmlFor={ids.confirm} className={dialogStyles.label}>
                Type <strong>{workspace.name}</strong> to confirm
              </label>
              <input
                id={ids.confirm}
                className={dialogStyles.input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className={dialogStyles.foot}>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep workspace
            </Button>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={typed !== workspace.name || remove.isPending}
              onClick={() =>
                remove.mutate(workspace.id, {
                  onSuccess: () => {
                    const next = workspaces.find((w) => w.id !== workspace.id);
                    if (next) selectWorkspace(next.id);
                    navigate('/projects', { replace: true });
                  },
                })
              }
            >
              Delete workspace
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
