import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { DomainInput } from '../../components/DomainInput';
import { PageHeader } from '../../components/PageHeader';
import type { Project } from '../../data/api';
import { useProjectMutations } from '../../data/queries';
import { useCurrentProject, useWorkspace } from '../../data/workspace';
import { isValidMainDomain, normalizeDomain } from '../../lib/domains';
import styles from './SettingsPage.module.css';

const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Project › Settings: details, SDK key and deleting the project. */
export function SettingsPage() {
  const project = useCurrentProject()!;
  return (
    <>
      <PageHeader title="Settings" description={`Settings for ${project.name}.`} />
      <div className={styles.page}>
        <General key={project.id} project={project} />
        <Sdk project={project} />
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
