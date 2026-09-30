import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Project, ProjectSettings } from '../../data/api';
import { useProjectMutations } from '../../data/queries';
import { SUPABASE_URL } from '../../lib/env';
import {
  configUrl,
  INSTALL_TARGETS,
  SDK_URL,
  SDK_URL_IS_PLACEHOLDER,
  snippet,
  type InstallTarget,
} from '../../lib/snippet';
import styles from './InstallPanel.module.css';

/** Install tabs (HTML / Next.js / React / GTM), code with Copy, from 10-projects.html. */
export function InstallPanel({ project }: { project: Project }) {
  const [target, setTarget] = useState<InstallTarget>('html');
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();
  const code = snippet(target, {
    sdkUrl: SDK_URL,
    publicKey: project.publicKey,
    configUrl: configUrl(SUPABASE_URL, project.publicKey),
    antiFlicker: project.settings.antiFlicker,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 2000);
  };

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + INSTALL_TARGETS.length) % INSTALL_TARGETS.length;
    setTarget(INSTALL_TARGETS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title} id={`${baseId}-title`}>
          Install
        </span>
        <div className={styles.tabs} role="tablist" aria-labelledby={`${baseId}-title`}>
          {INSTALL_TARGETS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={target === t.id}
              aria-controls={`${baseId}-panel`}
              tabIndex={target === t.id ? 0 : -1}
              className={styles.tab}
              onClick={() => setTarget(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={styles.code}
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${target}`}
      >
        <pre tabIndex={0} aria-label="Install code">
          {code}
        </pre>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Select and copy' : 'Copy'}
        </button>
        <span className="visually-hidden" aria-live="polite">
          {copied === 'copied' ? 'Install code copied' : ''}
        </span>
      </div>
      <SdkSwitches project={project} />
      {SDK_URL_IS_PLACEHOLDER && (
        <p className={styles.warn}>
          The SDK isn't hosted yet, so <span className="mono">{SDK_URL}</span> is a placeholder. Set{' '}
          <span className="mono">VITE_SDK_URL</span> once it is.
        </p>
      )}
    </div>
  );
}

/** "Listening for first ping…" until the SDK's first event, then "Snippet live". */
export function InstallStatus({ installed }: { installed: boolean }) {
  return (
    <span className={`${styles.status} ${installed ? styles.live : ''}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {installed ? 'Snippet live: first ping received' : 'Listening for first ping…'}
    </span>
  );
}

const SWITCHES: Array<{ key: keyof ProjectSettings; label: string; hint: string }> = [
  { key: 'antiFlicker', label: 'Anti-flicker', hint: 'Hide page until variants apply, max 400 ms' },
  { key: 'spa', label: 'Single-page app mode', hint: 'Re-check targeting on every route change' },
  { key: 'ga4', label: 'Send events to GA4', hint: 'Push exposures to window.dataLayer' },
];

/** Per-project SDK switches, saved as soon as they change. */
function SdkSwitches({ project }: { project: Project }) {
  const { update } = useProjectMutations(project.workspaceId);
  // Optimistic: show the new state while it saves; roll back if saving fails.
  const [pending, setPending] = useState<ProjectSettings | null>(null);
  const settings = pending ?? project.settings;
  const toggle = (key: keyof ProjectSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setPending(next);
    update.mutate(
      { id: project.id, patch: { settings: next } },
      { onSettled: () => setPending(null) },
    );
  };
  return (
    <div className={styles.switches} role="group" aria-label="SDK options">
      {SWITCHES.map((s) => (
        <div key={s.key} className={styles.switchRow}>
          <span className={styles.switchText}>
            <span className={styles.switchLabel} id={`${project.id}-${s.key}`}>
              {s.label}
            </span>
            <span className={styles.switchHint}>{s.hint}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings[s.key]}
            aria-labelledby={`${project.id}-${s.key}`}
            className={styles.switch}
            onClick={() => toggle(s.key)}
          >
            <span className={styles.knob} aria-hidden="true" />
          </button>
        </div>
      ))}
      <p className={styles.note}>
        To preview a test before the snippet is on a page, use <b>Preview on site</b> in the
        experiment: the Splitcraft Preview extension or bookmark shows it on any page.
      </p>
      {update.isError ? (
        <p role="alert" className={styles.warn}>
          Couldn't save: {update.error.message}
        </p>
      ) : (
        !settings.antiFlicker && (
          <p className={styles.note}>
            Anti-flicker is set on the snippet: copy the updated code to your site.
          </p>
        )
      )}
    </div>
  );
}
