import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Project, ProjectSettings } from '../../data/api';
import { useProjectMutations } from '../../data/queries';
import { SUPABASE_URL } from '../../lib/env';
import {
  bookmarklet,
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
  {
    key: 'previewAnywhere',
    label: 'Preview on pages without the snippet',
    hint: 'Adds a preview bookmark that loads Splitcraft on any page of your site',
  },
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
      {settings.previewAnywhere && <PreviewBookmark project={project} />}
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

/**
 * The preview bookmarklet as a link to drag to the bookmarks bar. React refuses
 * `javascript:` URLs in `href`, so it is set on the element directly.
 */
function PreviewBookmark({ project }: { project: Project }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);
  const code = bookmarklet({
    sdkUrl: SDK_URL,
    publicKey: project.publicKey,
    configUrl: configUrl(SUPABASE_URL, project.publicKey),
  });
  useEffect(() => {
    ref.current?.setAttribute('href', code);
  }, [code]);
  return (
    <div className={styles.bookmark}>
      <a
        ref={ref}
        className={styles.bookmarkLink}
        onClick={(e) => e.preventDefault()}
        aria-describedby={`${project.id}-bookmark-help`}
      >
        Splitcraft preview
      </a>
      <button
        type="button"
        className={styles.copyBookmark}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied: paste it as a new bookmark’s URL' : 'Copy bookmark code'}
      </button>
      <p id={`${project.id}-bookmark-help`} className={styles.note}>
        Drag this to your bookmarks bar. Then use <b>Preview on site</b> on an experiment and, on
        the page that opens, click the bookmark. It loads Splitcraft with the forced variant and the
        QA panel, for you only. Visitors still need the snippet, and some sites block bookmarklets
        with a Content-Security-Policy.
      </p>
    </div>
  );
}
