import { useState } from 'react';
import { Link } from 'react-router';
import type { Experiment } from '../../data/api';
import { useExperimentsByProject } from '../../data/queries';
import { useWorkspace } from '../../data/workspace';
import { variantsReady } from '../../lib/launch';
import styles from './Onboarding.module.css';

const HIDDEN_KEY = (workspaceId: string) => `splitcraft_onboarding_hidden_${workspaceId}`;

function readHidden(workspaceId: string): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY(workspaceId)) === '1';
  } catch {
    return false;
  }
}

interface Step {
  title: string;
  text: string;
  done: boolean;
  to: string;
  action: string;
}

/**
 * First-run checklist on Projects: create a project, install the snippet, create an
 * experiment, get it ready, launch. Each step is read from real data, so it ticks itself
 * off. Hidden once everything is done, or when someone chooses "Hide".
 */
export function Onboarding({ onNewProject }: { onNewProject(): void }) {
  const { workspace, projects } = useWorkspace();
  const [hidden, setHidden] = useState(() => readHidden(workspace.id));
  const byProject = useExperimentsByProject(projects.map((p) => p.id));
  const experiments: Experiment[] = projects.flatMap((p) => byProject[p.id]?.experiments ?? []);
  const loading = projects.some((p) => !byProject[p.id]?.experiments);

  const project = projects.find((p) => p.installedAt) ?? projects[0];
  const base = project ? `/p/${project.id}` : '';
  const ready = experiments.find((e) => e.primaryMetricId && variantsReady(e));
  const first = ready ?? experiments[0];
  const steps: Step[] = [
    {
      title: 'Create a project',
      text: 'One per site or app. It gets its own snippet.',
      done: projects.length > 0,
      to: '',
      action: 'New project',
    },
    {
      title: 'Install the snippet',
      text: 'Paste one script tag into your site’s <head>. It ticks off on the first page view.',
      done: projects.some((p) => p.installedAt),
      to: `${base}/install`,
      action: 'Install',
    },
    {
      title: 'Create an experiment',
      text: 'Name the change you want to test and write down your hypothesis.',
      done: experiments.length > 0,
      to: `${base}/experiments`,
      action: 'Experiments',
    },
    {
      title: 'Write the variant and pick a goal',
      text: 'Start from a template, then choose the metric that decides the winner.',
      done: Boolean(ready),
      to: first ? `/p/${first.projectId}/experiments/${first.id}/variants` : `${base}/experiments`,
      action: 'Open experiment',
    },
    {
      title: 'Preview and launch',
      text: 'Check it on your site with Preview on site, then launch.',
      done: experiments.some((e) => e.status !== 'draft'),
      to: first ? `/p/${first.projectId}/experiments/${first.id}/basics` : `${base}/experiments`,
      action: 'Launch',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  if (hidden || loading || !next) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDDEN_KEY(workspace.id), '1');
    } catch {
      // Not remembered; hidden for now.
    }
  };

  return (
    <section className={styles.card} aria-labelledby="onboarding-h">
      <div className={styles.head}>
        <div>
          <h2 id="onboarding-h" className={styles.title}>
            Get your first test live
          </h2>
          <p className={styles.sub}>
            {doneCount} of {steps.length} done · about 10 minutes
          </p>
        </div>
        <button type="button" className={styles.hide} onClick={hide}>
          Hide
        </button>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className={styles.steps}>
        {steps.map((s, i) => {
          const current = s === next;
          return (
            <li
              key={s.title}
              className={`${styles.step} ${s.done ? styles.done : ''} ${current ? styles.current : ''}`}
              aria-current={current ? 'step' : undefined}
            >
              <span className={styles.mark} aria-hidden="true">
                {s.done ? '✓' : i + 1}
              </span>
              <span className={styles.text}>
                <span className={styles.stepTitle}>
                  {s.title}
                  {s.done && <span className="visually-hidden"> (done)</span>}
                </span>
                {current && <span className={styles.stepText}>{s.text}</span>}
              </span>
              {current &&
                (s.to ? (
                  <Link to={s.to} className={styles.action}>
                    {s.action}
                  </Link>
                ) : (
                  <button type="button" className={styles.action} onClick={onNewProject}>
                    {s.action}
                  </button>
                ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
