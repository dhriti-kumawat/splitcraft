import { useId, useState } from 'react';
import type { Experiment, Project, Variant } from '../../data/api';
import { useEditVariants, useUpdateVariants } from '../../data/queries';
import { controlKey } from '../../lib/experiments';
import { previewUrl, testPageUrl } from '../../lib/launch';
import { AddVariant } from './AddVariant';
import { useExperiment } from './experimentContext';
import { TrafficSplit } from './TrafficSplit';
import styles from './SplitUrlVariants.module.css';

const COLORS = ['var(--variant-a)', 'var(--variant-b)', 'var(--highlight)', 'var(--accent)'];

/** Experiment step 2 for split URL tests: one page URL per variant. */
export function SplitUrlVariants() {
  const { experiment, project } = useExperiment();
  const edits = useEditVariants(experiment);
  const control = controlKey(experiment);
  const isDraft = experiment.status === 'draft';
  const others = experiment.variants.filter((v) => v.key !== control).length;

  return (
    <div className={styles.page}>
      <p className={styles.intro}>
        Each variant is its own page. Visitors who land on the original page (the pages your WHERE
        rules match) are bucketed, and those in a variant are redirected to its URL, keeping the
        query string. Install the snippet on the variant pages too, so goals count there.
      </p>
      <ul className={styles.list}>
        {experiment.variants.map((v, i) => (
          <li key={v.id} className={styles.row}>
            <VariantRow
              experiment={experiment}
              project={project}
              variant={v}
              color={COLORS[i % COLORS.length]!}
              isControl={v.key === control}
              canDelete={isDraft && others > 1}
              remove={edits.remove}
            />
          </li>
        ))}
      </ul>
      <AddVariant
        experiment={experiment}
        buttonClassName={styles.add}
        label="+ Add variation page"
        placeholder="e.g. Redesigned landing page"
      />
      <section className={styles.row} aria-label="Traffic split">
        <TrafficSplit experiment={experiment} />
      </section>
    </div>
  );
}

function VariantRow({
  experiment,
  project,
  variant,
  color,
  isControl,
  canDelete,
  remove,
}: {
  experiment: Experiment;
  project: Project;
  variant: Variant;
  color: string;
  isControl: boolean;
  canDelete: boolean;
  remove: ReturnType<typeof useEditVariants>['remove'];
}) {
  const update = useUpdateVariants(experiment);
  const [name, setName] = useState(variant.name);
  const [url, setUrl] = useState(variant.url ?? '');
  const [error, setError] = useState<string | undefined>();
  const id = useId();
  const readOnly = experiment.status === 'ended';

  const saveUrl = () => {
    const result = testPageUrl(url, project);
    setError(result.error);
    if (result.error || result.url === variant.url) return;
    if (result.url) setUrl(result.url);
    update.mutate([{ id: variant.id, patch: { url: result.url } }]);
  };

  return (
    <>
      <div className={styles.head}>
        <span className={styles.swatch} style={{ background: color }} aria-hidden="true" />
        <label htmlFor={`${id}-name`} className="visually-hidden">
          Variant name
        </label>
        <input
          id={`${id}-name`}
          className={styles.name}
          value={name}
          maxLength={60}
          readOnly={readOnly}
          onChange={(e) => setName(e.target.value)}
          onBlur={() =>
            name.trim() &&
            name.trim() !== variant.name &&
            update.mutate([{ id: variant.id, patch: { name: name.trim() } }])
          }
        />
        <span className={`${styles.key} mono`}>{variant.key}</span>
        {!isControl && variant.url && (
          <a
            className={styles.link}
            href={previewUrl(experiment, project, variant.key)}
            target="_blank"
            rel="noreferrer"
          >
            Preview
          </a>
        )}
        {!isControl && canDelete && (
          <button
            type="button"
            className={styles.delete}
            disabled={remove.isPending}
            onClick={() => remove.mutate(variant.id)}
          >
            Delete
          </button>
        )}
      </div>
      {isControl ? (
        <p className={styles.control}>
          Original page:{' '}
          {experiment.previewUrl ? (
            <span className="mono">{experiment.previewUrl}</span>
          ) : (
            'the pages your WHERE rules match'
          )}
        </p>
      ) : (
        <div className={styles.field}>
          <label htmlFor={`${id}-url`} className={styles.label}>
            Page URL
          </label>
          <input
            id={`${id}-url`}
            className={`${styles.input} mono`}
            value={url}
            placeholder={`https://${project.mainDomain}/landing-b`}
            readOnly={readOnly}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={saveUrl}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          {error && (
            <span id={`${id}-err`} className={styles.error}>
              {error}
            </span>
          )}
          {update.isError && (
            <span role="alert" className={styles.error}>
              Couldn't save: {update.error.message}
            </span>
          )}
        </div>
      )}
    </>
  );
}
