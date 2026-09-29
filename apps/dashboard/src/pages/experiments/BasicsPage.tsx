import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import type { Experiment } from '../../data/api';
import {
  useGoalsQuery,
  useOverviewQuery,
  useUpdateExperiment,
  useUpdateVariants,
} from '../../data/queries';
import { useWorkspace } from '../../data/workspace';
import { launchChecks, qaDone } from '../../lib/launch';
import { sampleSizePerVariant } from '../../lib/stats';
import { useExperiment } from './experimentContext';
import styles from './BasicsPage.module.css';

const number = new Intl.NumberFormat('en-US');
const COLORS = ['var(--variant-a)', 'var(--variant-b)', 'var(--highlight)', 'var(--accent)'];

/** Experiment step 1 (12-exp-step1-basics.html). */
export function BasicsPage() {
  const { experiment, project } = useExperiment();
  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <About experiment={experiment} />
        <TargetingSummary
          experiment={experiment}
          base={`/p/${project.id}/experiments/${experiment.id}`}
        />
        <Traffic experiment={experiment} />
        <GoalsSummary
          experiment={experiment}
          base={`/p/${project.id}/experiments/${experiment.id}`}
        />
      </div>
      <aside className={styles.aside} aria-label="Planning">
        <SampleSize experiment={experiment} />
        <Checklist />
      </aside>
    </div>
  );
}

/** Saves a field when it loses focus, and says so. */
function useSaveOnBlur(experiment: Experiment) {
  const update = useUpdateExperiment(experiment);
  const status = update.isPending
    ? 'Saving…'
    : update.isError
      ? "Couldn't save. Try again."
      : update.isSuccess
        ? 'Saved'
        : '';
  return { update, status };
}

function About({ experiment }: { experiment: Experiment }) {
  const { update, status } = useSaveOnBlur(experiment);
  const [name, setName] = useState(experiment.name);
  const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
  const ids = { name: useId(), hyp: useId() };
  const nameError = name.trim() ? '' : 'The experiment needs a name.';

  return (
    <section className={styles.section} aria-labelledby={`${ids.hyp}-h`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.title} id={`${ids.hyp}-h`}>
          Hypothesis
        </h2>
        <span className={update.isError ? styles.error : styles.saved} role="status">
          {status}
        </span>
      </div>
      <div className={styles.field}>
        <label htmlFor={ids.name} className={styles.label}>
          Name
        </label>
        <input
          id={ids.name}
          className={styles.input}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={() =>
            !nameError && name.trim() !== experiment.name && update.mutate({ name: name.trim() })
          }
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? `${ids.name}-err` : undefined}
        />
        {nameError && (
          <span id={`${ids.name}-err`} className={styles.error}>
            {nameError}
          </span>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor={ids.hyp} className={styles.label}>
          Hypothesis
        </label>
        <textarea
          id={ids.hyp}
          className={styles.textarea}
          value={hypothesis}
          placeholder="What you saw, what you'll change, and which metric should move. E.g. “Visitors hover near the price and leave. Showing cancellation terms under Book will increase book clicks.”"
          onChange={(e) => setHypothesis(e.target.value)}
          onBlur={() => hypothesis !== experiment.hypothesis && update.mutate({ hypothesis })}
        />
      </div>
    </section>
  );
}

function TargetingSummary({ experiment, base }: { experiment: Experiment; base: string }) {
  const t = experiment.targeting;
  const who = t.who?.segmentIds.length
    ? `${t.who.segmentIds.length} ${t.who.segmentIds.length === 1 ? 'segment' : 'segments'}, ${t.who.mode}`
    : 'Everyone';
  const urlRules = (t.where?.include?.length ?? 0) + (t.where?.exclude?.length ?? 0);
  const elements = t.where?.elements?.length ?? 0;
  const where =
    urlRules || elements
      ? [
          urlRules && `${urlRules} URL ${urlRules === 1 ? 'rule' : 'rules'}`,
          elements && `${elements} element ${elements === 1 ? 'rule' : 'rules'}`,
        ]
          .filter(Boolean)
          .join(' + ')
      : 'All pages';
  const triggers = (t.how ?? []).reduce((n, g) => n + g.items.length, 0);
  const how = triggers ? `${triggers} ${triggers === 1 ? 'trigger' : 'triggers'}` : 'Any visit';
  const when = {
    every_load: 'Every page load',
    once: 'Once per visitor',
    once_per_session: 'Once per session',
    every_n_days: `Every ${t.when?.mode === 'every_n_days' ? t.when.days : ''} days`,
  }[t.when?.mode ?? 'every_load'];

  return (
    <section className={styles.section} aria-labelledby="targeting-h">
      <div className={styles.sectionHead}>
        <h2 className={styles.title} id="targeting-h">
          Targeting
        </h2>
        <Link to={`${base}/targeting`} className={styles.editLink}>
          Edit targeting
        </Link>
      </div>
      <dl className={styles.grid4} style={{ margin: 0 }}>
        {[
          ['Who', who],
          ['Where', where],
          ['How', how],
          ['When', when],
        ].map(([label, value]) => (
          <div key={label} className={styles.fact}>
            <dt className={styles.lbl}>{label}</dt>
            <dd className={styles.factValue} style={{ margin: 0 }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Traffic({ experiment }: { experiment: Experiment }) {
  const update = useUpdateExperiment(experiment);
  const updateVariants = useUpdateVariants(experiment);
  const [traffic, setTraffic] = useState(String(experiment.trafficPct));
  const total = experiment.variants.reduce((s, v) => s + v.weight, 0) || 1;
  const [weights, setWeights] = useState(() =>
    experiment.variants.map((v) => String(Math.round((v.weight / total) * 1000) / 10)),
  );
  const ids = { traffic: useId(), split: useId() };
  const locked = experiment.status !== 'draft';

  const trafficNum = Number(traffic);
  const trafficError =
    traffic.trim() === '' || !Number.isFinite(trafficNum) || trafficNum < 0 || trafficNum > 100
      ? 'Enter a percentage from 0 to 100.'
      : '';
  const weightNums = weights.map(Number);
  const sum = weightNums.reduce((a, b) => a + b, 0);
  const splitError =
    weightNums.some((w) => !Number.isFinite(w) || w < 0) || Math.abs(sum - 100) > 0.01
      ? `The split must add up to 100% (now ${Math.round(sum * 10) / 10}%).`
      : '';

  const saveTraffic = () => {
    if (!trafficError && trafficNum !== experiment.trafficPct)
      update.mutate({ trafficPct: trafficNum });
  };
  const saveSplit = () => {
    if (splitError || locked) return;
    const changed = experiment.variants
      .map((v, i) => ({ id: v.id, weight: weightNums[i]!, old: (v.weight / total) * 100 }))
      .filter((v) => Math.abs(v.weight - v.old) > 0.01);
    if (changed.length)
      updateVariants.mutate(changed.map((c) => ({ id: c.id, patch: { weight: c.weight } })));
  };

  return (
    <section className={styles.section} aria-labelledby="traffic-h">
      <div className={styles.sectionHead}>
        <h2 className={styles.title} id="traffic-h">
          Traffic
        </h2>
        <div className={styles.trafficRow}>
          <label htmlFor={ids.traffic}>Include</label>
          <input
            id={ids.traffic}
            className={styles.small}
            inputMode="decimal"
            value={traffic}
            onChange={(e) => setTraffic(e.target.value)}
            onBlur={saveTraffic}
            aria-invalid={Boolean(trafficError)}
            aria-describedby={trafficError ? `${ids.traffic}-err` : undefined}
          />
          <span>% of matching visitors</span>
        </div>
      </div>
      {trafficError && (
        <span id={`${ids.traffic}-err`} className={styles.error}>
          {trafficError}
        </span>
      )}
      <div className={styles.splitBar} aria-hidden="true">
        {experiment.variants.map((v, i) => (
          <div
            key={v.id}
            style={{ width: `${(v.weight / total) * 100}%`, background: COLORS[i % COLORS.length] }}
          >
            {v.name} · {Math.round((v.weight / total) * 100)}%
          </div>
        ))}
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }} aria-describedby={`${ids.split}-note`}>
        <legend className="visually-hidden">Split between variants</legend>
        <div className={styles.weights}>
          {experiment.variants.map((v, i) => (
            <label key={v.id} className={styles.weight}>
              {v.name}
              <input
                className={styles.small}
                inputMode="decimal"
                value={weights[i]}
                disabled={locked}
                onChange={(e) => setWeights((w) => w.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={saveSplit}
                aria-invalid={Boolean(splitError)}
              />
              %
            </label>
          ))}
        </div>
      </fieldset>
      <span id={`${ids.split}-note`} className={splitError ? styles.error : styles.hint}>
        {splitError ||
          (locked
            ? 'The split is locked once an experiment has started: changing it would move visitors between variants.'
            : 'Traffic can be raised later without moving anyone already in the test.')}
      </span>
    </section>
  );
}

function GoalsSummary({ experiment, base }: { experiment: Experiment; base: string }) {
  const goals = useGoalsQuery(experiment.id);
  const secondary = goals.data?.filter((g) => g.role === 'secondary') ?? [];
  const guardrails = goals.data?.filter((g) => g.role === 'guardrail') ?? [];
  const list = (items: typeof secondary) => items.map((g) => g.metric.name).join(', ');
  return (
    <section className={styles.section} aria-labelledby="goals-h">
      <div className={styles.sectionHead}>
        <h2 className={styles.title} id="goals-h">
          Goals
        </h2>
        <Link to={`${base}/goals`} className={styles.editLink}>
          Edit goals
        </Link>
      </div>
      <div className={styles.goalRow}>
        <span className={`${styles.tag} ${styles.primary}`}>Primary</span>
        <span>{experiment.primaryMetricName ?? 'Not set'}</span>
      </div>
      <div className={styles.goalRow}>
        <span className={`${styles.tag} ${styles.secondary}`}>Secondary</span>
        <span>
          {secondary.length} {secondary.length === 1 ? 'goal' : 'goals'}
        </span>
        {secondary.length > 0 && <span className="mono">{list(secondary)}</span>}
      </div>
      <div className={styles.goalRow}>
        <span className={`${styles.tag} ${styles.guardrail}`}>Guardrail</span>
        <span>
          {guardrails.length} {guardrails.length === 1 ? 'limit' : 'limits'}
        </span>
        {guardrails.length > 0 && <span className="mono">{list(guardrails)}</span>}
      </div>
    </section>
  );
}

function SampleSize({ experiment }: { experiment: Experiment }) {
  const update = useUpdateExperiment(experiment);
  const { workspace } = useWorkspace();
  const overview = useOverviewQuery(workspace.id);
  const [baseline, setBaseline] = useState(
    String(((experiment.plan.baseline ?? 0.05) * 100).toFixed(1)),
  );
  const [mde, setMde] = useState(String(Math.round((experiment.plan.mde ?? 0.1) * 100)));
  const ids = { baseline: useId(), mde: useId() };

  const b = Number(baseline) / 100;
  const m = Number(mde) / 100;
  const valid = b > 0 && b < 1 && m > 0 && m < 10 && b * (1 + m) < 1;
  const perVariant = valid ? sampleSizePerVariant(b, m) : null;

  // Visitors a day the test can get: the project's recent traffic, cut by the traffic share.
  const stats = overview.data?.find((s) => s.projectId === experiment.projectId);
  const last7 = stats?.dailyVisitors.slice(-7) ?? [];
  const daily = last7.length
    ? (last7.reduce((a, x) => a + x, 0) / last7.length) * (experiment.trafficPct / 100)
    : 0;
  const days =
    perVariant && daily > 0 ? Math.ceil((perVariant * experiment.variants.length) / daily) : null;

  // Keep the saved plan in step with valid inputs.
  useEffect(() => {
    if (!perVariant || !Number.isFinite(perVariant) || experiment.status !== 'draft') return;
    const t = setTimeout(() => {
      if (
        experiment.plannedSample !== perVariant ||
        experiment.plan.baseline !== b ||
        experiment.plan.mde !== m
      ) {
        update.mutate({ plannedSample: perVariant, plan: { baseline: b, mde: m } });
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perVariant, b, m]);

  return (
    <section className={styles.section} aria-labelledby="sample-h">
      <h2 className={styles.title} id="sample-h">
        Sample size
      </h2>
      <div className={styles.planInputs}>
        <div className={styles.field}>
          <label htmlFor={ids.baseline} className={styles.lbl}>
            Baseline
          </label>
          <span className={styles.trafficRow}>
            <input
              id={ids.baseline}
              className={styles.small}
              inputMode="decimal"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              disabled={experiment.status !== 'draft'}
            />
            %
          </span>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.mde} className={styles.lbl}>
            Smallest lift
          </label>
          <span className={styles.trafficRow}>
            <input
              id={ids.mde}
              className={styles.small}
              inputMode="decimal"
              value={mde}
              onChange={(e) => setMde(e.target.value)}
              disabled={experiment.status !== 'draft'}
            />
            %
          </span>
        </div>
      </div>
      <div className={styles.result} role="status">
        {perVariant && Number.isFinite(perVariant) ? (
          <>
            <span className={styles.bigNumber}>
              {number.format(perVariant)} <span className={styles.unit}>per variant</span>
            </span>
            <span className={`${styles.resultText} ${days && days > 42 ? styles.warnText : ''}`}>
              {days
                ? `About ${days} ${days === 1 ? 'day' : 'days'} at ${number.format(Math.round(daily))} targeted visitors a day.${
                    days > 42 ? ' Widen targeting or aim for a bigger lift.' : ''
                  }`
                : 'No traffic data yet to estimate the duration.'}{' '}
              95% confidence, 80% power.
            </span>
          </>
        ) : (
          <span className={styles.resultText}>
            Enter a baseline conversion rate (e.g. 5) and the smallest lift worth detecting (e.g.
            10).
          </span>
        )}
      </div>
    </section>
  );
}

function Checklist() {
  const { experiment, project } = useExperiment();
  const checks = launchChecks(experiment, project, qaDone(experiment.id));
  if (experiment.status !== 'draft') return null;
  return (
    <section className={styles.section} aria-labelledby="launch-h">
      <h2 className={styles.title} id="launch-h">
        Before you launch
      </h2>
      <ul className={styles.checklist} id="launch-blockers">
        {checks.map((c) => (
          <li key={c.id} className={c.ok ? '' : c.blocking ? styles.blocked : styles.todo}>
            {c.ok ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 10l4 4 8-8" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke={c.blocking ? 'var(--danger)' : 'var(--warn-dot)'}
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7" />
              </svg>
            )}
            {c.label}
            <span className="visually-hidden">
              {c.ok ? ' (done)' : c.blocking ? ' (required before launch)' : ' (recommended)'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
