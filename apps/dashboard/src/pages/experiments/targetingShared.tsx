import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import type { Segment } from '../../data/api';
import { useSessionSampleQuery } from '../../data/queries';
import { describeGroups } from '../../lib/conditions';
import { evaluateTargeting, formatRange, share } from '../../lib/reach';
import { toGroups } from '../../lib/segments';
import type { StoredTargeting } from '../../lib/targeting';
import styles from './TargetingPage.module.css';

// Shared by the Audience and Targeting steps: the summary sentence, the reach estimate and
// the save bar.

export const number = new Intl.NumberFormat('en-US');

/**
 * Reach from a sample of the last 30 days' sessions (lib/reach.ts). A range means some
 * rules need the live page to check (cookies, dataLayer, page history, elements).
 */
export function ReachEstimate({
  projectId,
  targeting,
  segments,
  trafficPct,
  plannedSample,
  arms,
}: {
  projectId: string;
  targeting: StoredTargeting;
  segments: Segment[];
  trafficPct: number;
  plannedSample: number | null;
  arms: number;
}) {
  const sample = useSessionSampleQuery(projectId);
  if (sample.isPending) return null;
  if (sample.isError) return <span className={styles.sub}>Couldn't estimate reach.</span>;
  const { sessions, days } = sample.data;
  const rules = Object.fromEntries(segments.map((s) => [s.id, s.rules]));
  const reach = share(sample.data.sample, (s) => evaluateTargeting(targeting, rules, s));
  if (!reach || !sessions) {
    return (
      <span className={styles.sub}>
        Reach appears once the snippet has seen some visits. It samples the last 30 days.
      </span>
    );
  }
  const perDay = (x: number) => (x * sessions * (trafficPct / 100)) / days;
  const lowDay = Math.round(perDay(reach.low));
  const highDay = Math.round(perDay(reach.high));
  const daysFor = (n: number) => Math.ceil(((plannedSample ?? 0) * arms) / n);
  return (
    <div className={styles.reach} aria-label="Reach estimate">
      <span>
        <span className={styles.big}>{formatRange(reach)}</span> of sessions ·{' '}
        {lowDay === highDay
          ? `≈ ${number.format(lowDay)}`
          : `≈ ${number.format(lowDay)}–${number.format(highDay)}`}{' '}
        visitors a day
      </span>
      {reach.high > reach.low && (
        <span className={styles.sub}>
          Some rules need the live page (cookies, dataLayer, page history or elements), so this is a
          range.
        </span>
      )}
      {plannedSample !== null && (
        <span className={styles.sub}>
          {highDay === 0
            ? 'No recent session matches. Widen a rule.'
            : `At this reach, the planned sample (${number.format(plannedSample)} per variant) takes about ${
                lowDay === highDay || lowDay === 0
                  ? daysFor(highDay)
                  : `${daysFor(highDay)}–${daysFor(lowDay)}`
              } days.`}
        </span>
      )}
      <span className={styles.sub}>
        From {number.format(sample.data.sample.length)} of {number.format(sessions)} sessions in the
        last {days} {days === 1 ? 'day' : 'days'}. Pages are judged by where each session started.
      </span>
    </div>
  );
}

export function whoSentence(t: StoredTargeting, segmentName: (id: string) => string): string {
  const parts: string[] = [];
  const who = [
    ...(t.who?.segmentIds ?? []).map((id) => segmentName(id)),
    ...(t.who?.rules?.items.length
      ? [
          `visitors where ${describeGroups(toGroups(t.who.rules))
            .replace(/\.$/, '')
            .replace(/^./, (c) => c.toLowerCase())}`,
        ]
      : []),
  ];
  parts.push(who.length ? who.join(t.who?.mode === 'all' ? ' and ' : ' or ') : 'Everyone');
  const include = t.where?.include ?? [];
  const exclude = t.where?.exclude ?? [];
  parts.push(
    include.length ? `on pages ${include.map((r) => r.value).join(' or ')}` : 'on every page',
  );
  if (exclude.length) parts.push(`except ${exclude.map((r) => r.value).join(' or ')}`);
  if (t.where?.elements?.length)
    parts.push(`with ${t.where.elements.map((e) => e.selector).join(' and ')} on the page`);
  if (t.how?.length)
    parts.push(
      `when ${describeGroups(t.how)
        .replace(/\.$/, '')
        .replace(/^./, (c) => c.toLowerCase())}`,
    );
  const freq =
    t.when?.mode === 'once'
      ? 'once'
      : t.when?.mode === 'once_per_session'
        ? 'once per session'
        : t.when?.mode === 'every_n_days'
          ? `every ${t.when.days} days`
          : 'on every page load';
  parts.push(freq);
  const a = t.activation;
  if (a)
    parts.push(
      a.mode === 'element'
        ? `once ${a.selector} appears`
        : a.mode === 'js'
          ? 'once its JS condition is true'
          : 'when your code activates it',
    );
  const sentence = `${parts.join(', ')}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** The save button with its status beside it. */
export function SaveBar({
  label,
  onSave,
  disabled,
  status,
  error,
  note,
}: {
  label: string;
  onSave(): void;
  disabled: boolean;
  status: string;
  error?: boolean;
  note?: ReactNode;
}) {
  return (
    <div className={styles.saveBar}>
      <Button onClick={onSave} disabled={disabled}>
        {label}
      </Button>
      <span role="status" className={error ? styles.error : styles.status}>
        {status}
      </span>
      {note && <span className={styles.note}>{note}</span>}
    </div>
  );
}
