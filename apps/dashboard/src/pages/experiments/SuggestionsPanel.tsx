import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import type { ExperimentSuggestion, Project } from '../../data/api';
import { useCreateFromSuggestion, useSuggestExperiments } from '../../data/queries';
import { TEMPLATES } from '../../lib/templates';
import styles from './SuggestionsPanel.module.css';

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/** Scans the project's site and offers experiments to start in one click. */
export function SuggestionsPanel({ project }: { project: Project }) {
  const scan = useSuggestExperiments(project.id);
  const create = useCreateFromSuggestion(project.id);
  const navigate = useNavigate();
  const result = scan.data;

  const start = (idea: ExperimentSuggestion) =>
    create.mutate(idea, {
      onSuccess: (exp) => navigate(`/p/${project.id}/experiments/${exp.id}/variants`),
    });

  return (
    <section className={styles.panel} aria-labelledby="suggestions-title">
      <div className={styles.head}>
        <div>
          <h2 id="suggestions-title" className={styles.title}>
            Experiment ideas
          </h2>
          <p className={styles.muted}>
            Scan <span className="mono">{project.mainDomain}</span> for pages, buttons, forms and
            endpoints, then start a suggested test in one click.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => scan.mutate()}
          disabled={scan.isPending}
          aria-busy={scan.isPending}
        >
          {scan.isPending
            ? 'Scanning…'
            : result
              ? 'Scan again'
              : scan.isError
                ? 'Try again'
                : 'Scan site'}
        </Button>
      </div>

      {scan.isPending ? (
        <p className={styles.muted} aria-busy="true">
          Scanning {project.mainDomain}. This can take up to 20 seconds.
        </p>
      ) : scan.isError ? (
        <p className={styles.error} role="alert">
          {scan.error.message}
        </p>
      ) : result && result.suggestions.length === 0 ? (
        <p className={styles.muted}>
          No ideas found. Check that {project.mainDomain} is public and has headings or buttons.
        </p>
      ) : result ? (
        <>
          {create.isError && (
            <p className={styles.error} role="alert">
              Couldn't create the experiment: {create.error.message}
            </p>
          )}
          <ul className={styles.list}>
            {result.suggestions.map((idea) => (
              <li key={`${idea.template}-${idea.page}`} className={styles.item}>
                <div className={styles.text}>
                  <span className={styles.name}>{idea.name}</span>
                  <span className={styles.muted}>{idea.hypothesis}</span>
                  <span className={styles.meta}>
                    <span className="mono">{pathOf(idea.page)}</span> ·{' '}
                    {TEMPLATES.find((t) => t.id === idea.template)?.name ?? idea.template}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(idea)}
                  disabled={create.isPending}
                  aria-label={`Create draft: ${idea.name}`}
                >
                  {create.isPending && create.variables === idea ? 'Creating…' : 'Create draft'}
                </Button>
              </li>
            ))}
          </ul>
          <p className={styles.meta}>
            Scanned {result.pages.length} {result.pages.length === 1 ? 'page' : 'pages'}
            {result.pages.some((p) => p.endpoints.length)
              ? ` · endpoints: ${[...new Set(result.pages.flatMap((p) => p.endpoints))].slice(0, 6).join(', ')}`
              : ''}{' '}
            · {result.source === 'ai' ? 'Suggested by Claude' : 'Suggested by built-in rules'}
          </p>
        </>
      ) : null}
    </section>
  );
}
