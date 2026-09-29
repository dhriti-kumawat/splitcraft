import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import buttonStyles from '../../components/Button.module.css';
import { DomainInput } from '../../components/DomainInput';
import type { Project } from '../../data/api';
import { keys, useCreateProject, useInstallStatus } from '../../data/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../../data/workspace';
import { isValidMainDomain, normalizeDomain } from '../../lib/domains';
import { InstallPanel, InstallStatus } from './InstallPanel';
import styles from './NewProjectDrawer.module.css';

/**
 * "New project" drawer from 10-projects.html in two steps: details, then install.
 * The snippet needs the project's public key, so it appears once the project exists.
 */
export function NewProjectDrawer({ onClose }: { onClose(): void }) {
  const [project, setProject] = useState<Project | null>(null);
  const headingId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className={styles.drawer} aria-labelledby={headingId}>
      <div className={styles.head}>
        <div className={styles.titles}>
          <h2 className={styles.title} id={headingId}>
            {project ? project.name : 'New project'}
          </h2>
          <span className={styles.step}>
            {project ? 'Step 2 of 2 · Install' : 'Step 1 of 2 · Details'}
          </span>
        </div>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      {project ? <InstallStep project={project} /> : <DetailsStep onCreated={setProject} />}
    </aside>
  );
}

function DetailsStep({ onCreated }: { onCreated(project: Project): void }) {
  const { workspace } = useWorkspace();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [allowed, setAllowed] = useState<string[]>([]);
  const [allowedError, setAllowedError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), domain: useId(), allowed: useId() };

  useEffect(() => nameRef.current?.focus(), []);

  const mainDomain = normalizeDomain(domain);
  const errors = {
    name: name.trim() ? '' : 'Enter a project name.',
    domain: !mainDomain
      ? "Enter your site's domain, like mytrips.dev."
      : isValidMainDomain(mainDomain)
        ? ''
        : 'Enter a domain like mytrips.dev or localhost:3000, without a wildcard.',
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.name || errors.domain || allowedError) return;
    create.mutate(
      {
        workspaceId: workspace.id,
        name: name.trim(),
        mainDomain,
        allowedDomains: allowed.filter((d) => d !== mainDomain),
      },
      { onSuccess: onCreated },
    );
  };

  const show = (k: 'name' | 'domain') => submitted && Boolean(errors[k]);

  return (
    <form onSubmit={submit} noValidate>
      <div className={styles.body}>
        {create.isError && (
          <div role="alert" className={styles.alert}>
            Couldn't create the project: {create.error.message}
          </div>
        )}
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={ids.name} className={styles.label}>
              Project name
            </label>
            <input
              ref={nameRef}
              id={ids.name}
              className={styles.input}
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={show('name')}
              aria-describedby={show('name') ? `${ids.name}-err` : undefined}
            />
            {show('name') && (
              <span id={`${ids.name}-err`} className={styles.error}>
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
              className={styles.mono}
              value={domain}
              placeholder="mytrips.dev"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setDomain(e.target.value)}
              onBlur={() => mainDomain && setDomain(mainDomain)}
              aria-invalid={show('domain')}
              aria-describedby={show('domain') ? `${ids.domain}-err` : undefined}
            />
            {show('domain') && (
              <span id={`${ids.domain}-err`} className={styles.error}>
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
            describedBy={allowedError ? `${ids.allowed}-err` : `${ids.allowed}-hint`}
          />
          {allowedError ? (
            <span id={`${ids.allowed}-err`} className={styles.error}>
              {allowedError}
            </span>
          ) : (
            <span id={`${ids.allowed}-hint`} className={styles.hint}>
              Staging, localhost or a wildcard like *.vercel.app. www. is always allowed.
            </span>
          )}
        </div>
      </div>
      <div className={styles.foot}>
        <span className={styles.footNote}>You'll get the install code next.</span>
        <Button type="submit" disabled={create.isPending} aria-busy={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}

function InstallStep({ project }: { project: Project }) {
  const status = useInstallStatus(project.id);
  const installed = Boolean(status.data?.installedAt ?? project.installedAt);
  const client = useQueryClient();
  // Refresh the grid so the card flips to "Snippet live" too.
  useEffect(() => {
    if (installed) void client.invalidateQueries({ queryKey: keys.projects(project.workspaceId) });
  }, [installed, client, project.workspaceId]);
  return (
    <>
      <div className={styles.body}>
        <p className={styles.hint} style={{ margin: 0 }}>
          Add this to every page of <span className="mono">{project.mainDomain}</span>, then open
          any page. This panel updates when the first event arrives.
        </p>
        <InstallPanel project={project} />
      </div>
      <div className={styles.foot}>
        <InstallStatus installed={installed} />
        <Link
          to={`/p/${project.id}/experiments`}
          className={`${buttonStyles.button} ${buttonStyles.primary}`}
        >
          Open project
        </Link>
      </div>
    </>
  );
}
