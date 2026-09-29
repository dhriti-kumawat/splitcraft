import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useWorkspaceMutations } from '../data/queries';
import { Button } from './Button';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

/** Create a workspace and switch to it. */
export function NewWorkspaceDialog({
  userId,
  onCreated,
  onClose,
}: {
  userId: string;
  onCreated(id: string): void;
  onClose(): void;
}) {
  const { create } = useWorkspaceMutations(userId);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const error = name.trim() ? '' : 'Name the workspace, e.g. your company or a client.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    create.mutate(name.trim(), {
      onSuccess: (workspaceId) => {
        onCreated(workspaceId);
        onClose();
        navigate('/projects');
      },
    });
  };

  return (
    <Dialog
      title="New workspace"
      description="A separate space with its own projects, team and event allowance."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className={styles.body}>
          {create.isError && (
            <div role="alert" className={styles.alert}>
              Couldn't create the workspace: {create.error.message}
            </div>
          )}
          <div className={styles.field}>
            <label htmlFor={id} className={styles.label}>
              Name
            </label>
            <input
              id={id}
              className={styles.input}
              value={name}
              maxLength={100}
              placeholder="e.g. Acme Inc."
              autoComplete="organization"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={submitted && Boolean(error)}
              aria-describedby={submitted && error ? `${id}-e` : undefined}
            />
            {submitted && error && (
              <span id={`${id}-e`} className={styles.error}>
                {error}
              </span>
            )}
          </div>
        </div>
        <div className={styles.foot}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Create workspace
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
