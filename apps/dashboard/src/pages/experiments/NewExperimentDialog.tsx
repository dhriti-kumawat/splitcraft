import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import styles from '../../components/Dialog.module.css';
import type { ExperimentType } from '../../data/api';
import { useCreateExperiment } from '../../data/queries';
import { EXPERIMENT_TYPES } from './experimentTypes';
import own from './NewExperimentDialog.module.css';

const TYPES = Object.keys(EXPERIMENT_TYPES) as ExperimentType[];

export function NewExperimentDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose(): void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExperimentType>('ab');
  const [submitted, setSubmitted] = useState(false);
  const create = useCreateExperiment(projectId);
  const navigate = useNavigate();
  const id = useId();
  const error = name.trim() ? '' : 'Name the experiment, e.g. "Sticky Book Now bar".';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    create.mutate(
      { name: name.trim(), type },
      { onSuccess: (exp) => navigate(`/p/${projectId}/experiments/${exp.id}/basics`) },
    );
  };

  return (
    <Dialog
      title="New experiment"
      description="Pick the kind of test. It starts as a draft; you set the rest up in the next steps."
      onClose={onClose}
      wide
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
          <fieldset className={own.types}>
            <legend className={styles.label}>Test type</legend>
            <div className={own.grid}>
              {TYPES.map((t) => {
                const info = EXPERIMENT_TYPES[t];
                return (
                  <label key={t} className={own.card}>
                    <input
                      type="radio"
                      name={`${id}-type`}
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className={own.radio}
                    />
                    <span className={own.cardTitle}>{info.label}</span>
                    <span className={own.cardText}>{info.description}</span>
                    <span className={own.cardExample}>{info.example}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
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
