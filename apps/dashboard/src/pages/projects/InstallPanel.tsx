import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Project } from '../../data/api';
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
