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
export function NewProjectDrawer({ onClose: close }: { onClose(): void }) {
  const [project, setProject] = useState<Project | null>(null);
  const { workspace, selectWorkspace } = useWorkspace();
  const headingId = useId();
  // Made in another workspace: switch to it on the way out. Switching at once would reload
  // the page under the drawer and lose the install step.
  const leave = () => {
    if (project && project.workspaceId !== workspace.id) selectWorkspace(project.workspaceId);
  };
  const onClose = () => {
    leave();
    close();
  };
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
      {project ? (
        <InstallStep project={project} onLeave={leave} />
      ) : (
        <DetailsStep onCreated={setProject} />
      )}
    </aside>
  );
}

function DetailsStep({ onCreated }: { onCreated(project: Project): void }) {
  const { workspace, workspaces } = useWorkspace();
  const create = useCreateProject();
  // Where the project goes, shown up front (like Vercel's scope picker): a project made in
  // someone else's workspace belongs to them.
  const [targetId, setTargetId] = useState(workspace.id);
  const target = workspaces.find((w) => w.id === targetId) ?? workspace;
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [allowed, setAllowed] = useState<string[]>([]);
  const [allowedError, setAllowedError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), domain: useId(), allowed: useId(), workspace: useId() };

  useEffect(() => nameRef.current?.focus(), []);

  const mainDomain = normalizeDomain(domain);
  const errors = {
    name: name.trim() ? '' : 'Enter a project name.',
    domain: !mainDomain
      ? "Enter your site's domain, like larkspurtravel.com."
      : isValidMainDomain(mainDomain)
        ? ''
        : 'Enter a domain like larkspurtravel.com or localhost:3000, without a wildcard.',
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.name || errors.domain || allowedError) return;
    create.mutate(
      {
        workspaceId: target.id,
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
        <div className={styles.field}>
          <label htmlFor={ids.workspace} className={styles.label}>
            Workspace
          </label>
          <select
            id={ids.workspace}
            className={styles.input}
            value={target.id}
            onChange={(e) => setTargetId(e.target.value)}
            aria-describedby={target.role === 'owner' ? undefined : `${ids.workspace}-note`}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.role === 'owner'
                  ? ''
                  : ` (you're ${w.role === 'admin' ? 'an admin' : 'a member'})`}
              </option>
            ))}
          </select>
          {target.role !== 'owner' && (
            <span id={`${ids.workspace}-note`} className={styles.note}>
              Everyone in {target.name} can see and change this project, and its owner and admins
              can delete it.
              {workspaces.some((w) => w.role === 'owner')
                ? ' For a project of your own, pick your workspace.'
                : ' For a project of your own, create your own workspace from the workspace menu.'}
            </span>
          )}
        </div>
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
              placeholder="larkspurtravel.com"
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

function InstallStep({ project, onLeave }: { project: Project; onLeave(): void }) {
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
          onClick={onLeave}
        >
          Open project
        </Link>
      </div>
    </>
  );
}
