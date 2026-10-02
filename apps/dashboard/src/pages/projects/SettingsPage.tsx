import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { DomainInput } from '../../components/DomainInput';
import { PageHeader } from '../../components/PageHeader';
import type { AlertEvent, Project, ProjectAlert } from '../../data/api';
import { useAlertMutations, useAlertsQuery, useProjectMutations } from '../../data/queries';
import { useCurrentProject, useWorkspace } from '../../data/workspace';
import { isValidMainDomain, normalizeDomain } from '../../lib/domains';
import styles from './SettingsPage.module.css';

const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Project › Settings: details, SDK key, alerts and deleting the project. */
export function SettingsPage() {
  const project = useCurrentProject()!;
  return (
    <>
      <PageHeader title="Settings" description={`Settings for ${project.name}.`} />
      <div className={styles.page}>
        <General key={project.id} project={project} />
        <Sdk project={project} />
        <Alerts project={project} />
        <DangerZone project={project} />
      </div>
    </>
  );
}

function General({ project }: { project: Project }) {
  const { workspace } = useWorkspace();
  const { update } = useProjectMutations(workspace.id);
  const [name, setName] = useState(project.name);
  const [domain, setDomain] = useState(project.mainDomain);
  const [allowed, setAllowed] = useState(project.allowedDomains);
  const [allowedError, setAllowedError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const ids = { name: useId(), domain: useId(), allowed: useId() };

  const main = normalizeDomain(domain);
  const errors = {
    name: name.trim() ? '' : 'Enter a project name.',
    domain: !main
      ? "Enter your site's domain, like mytrips.dev."
      : isValidMainDomain(main)
        ? ''
        : 'Enter a domain like mytrips.dev or localhost:3000, without a wildcard.',
  };
  const snapshot = JSON.stringify({ name: name.trim(), main, allowed });
  const dirty =
    snapshot !==
    JSON.stringify({
      name: project.name,
      main: project.mainDomain,
      allowed: project.allowedDomains,
    });
  const show = (k: keyof typeof errors) => submitted && Boolean(errors[k]);

  const save = () => {
    setSubmitted(true);
    if (errors.name || errors.domain || allowedError) return;
    update.mutate(
      {
        id: project.id,
        patch: {
          name: name.trim(),
          mainDomain: main,
          allowedDomains: allowed.filter((d) => d !== main),
        },
      },
      { onSuccess: () => setSavedSnapshot(snapshot) },
    );
  };

  return (
    <section className={styles.section} aria-labelledby="general-h">
      <div className={styles.head}>
        <h2 className={styles.title} id="general-h">
          General
        </h2>
        <p className={styles.sub}>The SDK only accepts events from these domains.</p>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={ids.name} className={styles.label}>
            Project name
          </label>
          <input
            id={ids.name}
            className={styles.input}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={show('name')}
            aria-describedby={show('name') ? `${ids.name}-e` : undefined}
          />
          {show('name') && (
            <span id={`${ids.name}-e`} className={styles.error}>
              {errors.name}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.domain} className={styles.label}>
            Main domain
          </label>
          <input
            id={ids.domain}
            className={`${styles.input} ${styles.mono}`}
            value={domain}
            spellCheck={false}
            onChange={(e) => setDomain(e.target.value)}
            onBlur={() => main && setDomain(main)}
            aria-invalid={show('domain')}
            aria-describedby={show('domain') ? `${ids.domain}-e` : undefined}
          />
          {show('domain') && (
            <span id={`${ids.domain}-e`} className={styles.error}>
              {errors.domain}
            </span>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={ids.allowed} className={styles.label}>
          Also allow on
        </label>
        <DomainInput
          id={ids.allowed}
          value={allowed}
          onChange={setAllowed}
          onError={setAllowedError}
          invalid={Boolean(allowedError)}
          describedBy={allowedError ? `${ids.allowed}-e` : `${ids.allowed}-h`}
        />
        {allowedError ? (
          <span id={`${ids.allowed}-e`} className={styles.error}>
            {allowedError}
          </span>
        ) : (
          <span id={`${ids.allowed}-h`} className={styles.hint}>
            Staging, localhost or a wildcard like *.vercel.app. www. is always allowed.
          </span>
        )}
      </div>
      <div className={styles.actions}>
        <Button onClick={save} disabled={!dirty || update.isPending}>
          Save changes
        </Button>
        <span role="status" className={update.isError ? styles.error : styles.status}>
          {update.isError
            ? `Couldn't save: ${update.error.message}`
            : savedSnapshot === snapshot
              ? 'Saved.'
              : dirty
                ? 'Unsaved changes'
                : ''}
        </span>
      </div>
    </section>
  );
}

function Sdk({ project }: { project: Project }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(project.publicKey);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 2000);
  };
  return (
    <section className={styles.section} aria-labelledby="sdk-h">
      <div className={styles.head}>
        <h2 className={styles.title} id="sdk-h">
          SDK
        </h2>
        <p className={styles.sub}>
          The public key identifies this project in the snippet. It's safe in page source: it only
          lets the SDK read live experiments and send events from your domains.
        </p>
      </div>
      <div className={styles.keyRow}>
        <span className={styles.key} aria-label="Public key">
          {project.publicKey}
        </span>
        <Button variant="secondary" onClick={copy}>
          {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Select and copy' : 'Copy key'}
        </Button>
        <span className="visually-hidden" aria-live="polite">
          {copied === 'copied' ? 'Public key copied' : ''}
        </span>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Snippet</dt>
          <dd>
            {project.installedAt
              ? `Live since ${date.format(new Date(project.installedAt))}`
              : 'Waiting for the first ping'}
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{date.format(new Date(project.createdAt))}</dd>
        </div>
      </dl>
      <Link to={`/p/${project.id}/install`} className={styles.sub} style={{ fontWeight: 600 }}>
        View install code
      </Link>
    </section>
  );
}

const ALERT_EVENTS: Array<{ id: AlertEvent; label: string }> = [
  { id: 'winner_found', label: 'A clear winner on the primary goal' },
  { id: 'sample_reached', label: 'The planned sample is reached' },
  { id: 'guardrail_paused', label: 'A guardrail paused a test' },
];

const KIND_LABEL: Record<ProjectAlert['kind'], string> = { slack: 'Slack', webhook: 'Webhook' };

function Alerts({ project }: { project: Project }) {
  const alerts = useAlertsQuery(project.id);
  const { create, remove, test } = useAlertMutations(project.id);
  const [kind, setKind] = useState<ProjectAlert['kind']>('slack');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<AlertEvent[]>(ALERT_EVENTS.map((e) => e.id));
  const [submitted, setSubmitted] = useState(false);
  const ids = { kind: useId(), url: useId(), events: useId() };
  const urlError = /^https:\/\/[^\s/]+\.\S+$/.test(url.trim())
    ? ''
    : kind === 'slack'
      ? 'Paste the Slack incoming webhook URL, starting with https://hooks.slack.com/.'
      : 'Enter an https:// URL.';
  const eventsError = events.length ? '' : 'Pick at least one alert.';

  const add = () => {
    setSubmitted(true);
    if (urlError || eventsError) return;
    create.mutate(
      { kind, url: url.trim(), events },
      {
        onSuccess: () => {
          setUrl('');
          setSubmitted(false);
        },
      },
    );
  };
  const failed = create.error ?? remove.error ?? test.error;

  return (
    <section className={styles.section} aria-labelledby="alerts-h">
      <div className={styles.head}>
        <h2 className={styles.title} id="alerts-h">
          Alerts
        </h2>
        <p className={styles.sub}>
          Get a message in Slack or at your own webhook when a test needs you. Checked every 15
          minutes; each test sends each alert once.
        </p>
      </div>

      {failed && (
        <p role="alert" className={styles.error}>
          Couldn't save: {failed.message}
        </p>
      )}

      {alerts.isPending ? (
        <p className={styles.sub} aria-busy="true">
          Loading alerts…
        </p>
      ) : alerts.isError ? (
        <p role="alert" className={styles.error}>
          Couldn't load alerts.
        </p>
      ) : alerts.data.length === 0 ? (
        <p className={styles.sub}>No alerts yet.</p>
      ) : (
        <ul className={styles.alertList}>
          {alerts.data.map((a) => (
            <li key={a.id} className={styles.alertItem}>
              <span className={styles.alertText}>
                <b>{KIND_LABEL[a.kind]}</b>{' '}
                <span className={styles.mono}>
                  {a.url.replace(/^(https:\/\/[^/]+\/).{8,}$/, '$1…')}
                </span>
                <span className={styles.sub}>
                  {ALERT_EVENTS.filter((e) => a.events.includes(e.id))
                    .map((e) => e.label)
                    .join(' · ')}
                </span>
              </span>
              <Button
                variant="secondary"
                onClick={() => test.mutate(a.id)}
                disabled={test.isPending}
                aria-label={`Send a test to ${KIND_LABEL[a.kind]} alert`}
              >
                {test.isSuccess && test.variables === a.id ? 'Sent' : 'Send test'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => remove.mutate(a.id)}
                aria-label={`Remove ${KIND_LABEL[a.kind]} alert`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.row}>
        <div className={styles.field} style={{ flex: '0 0 140px', minWidth: 0 }}>
          <label htmlFor={ids.kind} className={styles.label}>
            Send to
          </label>
          <select
            id={ids.kind}
            className={styles.input}
            value={kind}
            onChange={(e) => setKind(e.target.value as ProjectAlert['kind'])}
          >
            <option value="slack">Slack</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.url} className={styles.label}>
            {kind === 'slack' ? 'Slack webhook URL' : 'Webhook URL'}
          </label>
          <input
            id={ids.url}
            className={styles.input}
            value={url}
            placeholder={kind === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://'}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={submitted && Boolean(urlError)}
            aria-describedby={submitted && urlError ? `${ids.url}-err` : undefined}
          />
          {submitted && urlError && (
            <span id={`${ids.url}-err`} className={styles.error}>
              {urlError}
            </span>
          )}
        </div>
      </div>
      <fieldset className={styles.checks}>
        <legend className={styles.label}>Alert me when</legend>
        {ALERT_EVENTS.map((e) => (
          <label key={e.id} className={styles.check}>
            <input
              type="checkbox"
              checked={events.includes(e.id)}
              onChange={(ev) =>
                setEvents((list) =>
                  ev.target.checked ? [...list, e.id] : list.filter((x) => x !== e.id),
                )
              }
            />
            {e.label}
          </label>
        ))}
        {submitted && eventsError && <span className={styles.error}>{eventsError}</span>}
      </fieldset>
      <div>
        <Button onClick={add} disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add alert'}
        </Button>
      </div>
    </section>
  );
}

function DangerZone({ project }: { project: Project }) {
  const { workspace, user } = useWorkspace();
  const { remove } = useProjectMutations(workspace.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const id = useId();
  const canDelete = user.role === 'owner' || user.role === 'admin';

  return (
    <section className={`${styles.section} ${styles.danger}`} aria-labelledby="danger-h">
      <div className={styles.dangerRow}>
        <div className={styles.head}>
          <h2 className={styles.title} id="danger-h">
            Delete this project
          </h2>
          <p className={styles.sub}>
            {canDelete
              ? 'Removes its experiments, audiences, metrics and every collected event. The snippet stops working.'
              : 'Only workspace owners and admins can delete a project.'}
          </p>
        </div>
        <button
          type="button"
          className={styles.dangerButton}
          disabled={!canDelete}
          onClick={() => setOpen(true)}
        >
          Delete project
        </button>
      </div>
      {open && (
        <Dialog
          title={`Delete “${project.name}”?`}
          description="This permanently deletes the project, its experiments, audiences, metrics and all collected events. It can't be undone."
          onClose={() => {
            setOpen(false);
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
              <label htmlFor={id} className={dialogStyles.label}>
                Type <strong>{project.name}</strong> to confirm
              </label>
              <input
                id={id}
                className={dialogStyles.input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className={dialogStyles.foot}>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setTyped('');
              }}
            >
              Keep project
            </Button>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={typed !== project.name || remove.isPending}
              onClick={() =>
                remove.mutate(project.id, {
                  onSuccess: () => navigate('/projects', { replace: true }),
                })
              }
            >
              {remove.isPending ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
