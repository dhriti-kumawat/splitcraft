import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import styles from '../../components/Dialog.module.css';
import { useCreateExperiment } from '../../data/queries';

export function NewExperimentDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose(): void;
}) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const create = useCreateExperiment(projectId);
  const navigate = useNavigate();
  const id = useId();
  const error = name.trim() ? '' : 'Name the experiment, e.g. "Sticky Book Now bar".';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    create.mutate(name.trim(), {
      onSuccess: (exp) => navigate(`/p/${projectId}/experiments/${exp.id}/basics`),
    });
  };

  return (
    <Dialog
      title="New experiment"
      description="Starts as a draft with Control and B at 50/50. You set the rest up in the next steps."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className={styles.body}>
          {create.isError && (
            <div role="alert" className={styles.alert}>
              Couldn't create the experiment: {create.error.message}
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
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={submitted && Boolean(error)}
              aria-describedby={submitted && error ? `${id}-err` : undefined}
            />
            {submitted && error && (
              <span id={`${id}-err`} className={styles.error}>
                {error}
              </span>
            )}
          </div>
        </div>
        <div className={styles.foot}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending} aria-busy={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create draft'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
