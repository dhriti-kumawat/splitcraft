import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialog from '../../components/Dialog.module.css';
import type { Experiment, Project } from '../../data/api';
import { SUPABASE_URL } from '../../lib/env';
import { markQaDone, previewUrl, testPage } from '../../lib/launch';
import {
  openForBookmark,
  openWithExtension,
  previewState,
  projectHosts,
  useExtension,
} from '../../lib/previewBridge';
import { bookmarklet, configUrl, EXTENSION_ZIP_URL } from '../../lib/snippet';
import styles from './PreviewDialog.module.css';

/**
 * "Preview on site": one clear way first (the extension if installed, else the snippet if
 * the site has it, else the bookmark), the rest folded away. The extension and the bookmark
 * show unsaved edits live; the snippet shows saved code.
 */
export function PreviewDialog({
  experiment,
  project,
  onClose,
  visualVariant,
}: {
  experiment: Experiment;
  project: Project;
  onClose(): void;
  /** Opened from "Edit visually": start the visual editor on this variant. */
  visualVariant?: string;
}) {
  const ext = useExtension();
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const page = testPage(experiment, project);
  // The snippet is on the site: the quickest way, no install. It shows saved code.
  // Visual editing needs the live link to this tab, which the snippet link can't give.
  const hasSnippet = Boolean(project.installedAt) && !visualVariant;
  const state = () => ({
    ...previewState(experiment, undefined, visualVariant),
    ...(visualVariant && { visual: true }),
  });

  const openExtension = () => {
    setError('');
    openWithExtension(page, projectHosts(project), state()).then(
      () => {
        markQaDone(experiment.id);
        onClose();
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  };
  const openBookmarkTab = () => {
    setError('');
    if (openForBookmark(previewUrl(experiment, project), state())) {
      markQaDone(experiment.id);
      setOpened(true);
    } else setError('Your browser blocked the new tab. Allow pop-ups for this site and try again.');
  };

  return (
    <Dialog
      title={visualVariant ? 'Edit visually' : 'Preview on site'}
      description={
        visualVariant
          ? `Opens ${page.replace(/^https?:\/\//, '')} with the visual editor on. Click any element to change it; the code comes back here.`
          : `See ${experiment.name} on ${page.replace(/^https?:\/\//, '')} before visitors do. Only you see it.`
      }
      onClose={onClose}
      wide
    >
      <div className={dialog.body}>
        {error && (
          <div role="alert" className={dialog.alert}>
            {error}
          </div>
        )}

        {ext ? (
          <section className={styles.option} aria-labelledby="pv-ext">
            <h3 id="pv-ext" className={styles.title}>
              Live preview with the extension
            </h3>
            <p className={styles.ok}>Installed (version {ext.version}). Edits show as you type.</p>
            {!ext.userScripts && (
              <p className={styles.warn}>
                Strict site? In <span className="mono">chrome://extensions</span>, open{' '}
                <b>Details</b> on Splitcraft Preview and turn on <b>Allow user scripts</b>.
              </p>
            )}
            <Button onClick={openExtension}>Open preview</Button>
          </section>
        ) : hasSnippet ? (
          <SnippetOption experiment={experiment} project={project} primary />
        ) : (
          <BookmarkOption project={project} onOpen={openBookmarkTab} opened={opened} primary />
        )}

        {ext === undefined ? (
          <p className={styles.muted} aria-busy="true">
            Checking for the extension…
          </p>
        ) : (
          !ext && (
            <section className={styles.option} aria-labelledby="pv-ext">
              <h3 id="pv-ext" className={styles.title}>
                Want edits to show live? Get the extension
              </h3>
              <p className={styles.muted}>Chrome, Edge, Brave and Arc. Takes about a minute.</p>
              <details className={styles.more}>
                <summary>How to install</summary>
                <ol className={styles.steps}>
                  <li>
                    <a href={EXTENSION_ZIP_URL} download className={styles.link}>
                      Download the extension
                    </a>{' '}
                    and unzip it.
                  </li>
                  <li>
                    Open <span className="mono">chrome://extensions</span>, turn on{' '}
                    <b>Developer mode</b>.
                  </li>
                  <li>
                    Click <b>Load unpacked</b>, choose the{' '}
                    <span className="mono">splitcraft-preview</span> folder.
                  </li>
                  <li>Reload this page.</li>
                </ol>
              </details>
            </section>
          )
        )}

        {(ext || hasSnippet) && (
          <details className={styles.more}>
            <summary>Other ways to open it</summary>
            <div className={styles.moreBody}>
              {ext && hasSnippet && <SnippetOption experiment={experiment} project={project} />}
              <BookmarkOption project={project} onOpen={openBookmarkTab} opened={opened} />
            </div>
          </details>
        )}
      </div>
      <div className={dialog.foot}>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}

function SnippetOption({
  experiment,
  project,
  primary,
}: {
  experiment: Experiment;
  project: Project;
  primary?: boolean;
}) {
  return (
    <section className={primary ? styles.option : styles.plain} aria-labelledby="pv-snippet">
      <h3 id="pv-snippet" className={styles.title}>
        {primary ? 'Open it on your site' : 'With the snippet'}
      </h3>
      <p className={styles.muted}>Shows your saved changes. Save first if you just edited.</p>
      <a
        className={primary ? styles.button : styles.link}
        href={previewUrl(experiment, project)}
        target="_blank"
        rel="noreferrer"
        onClick={() => markQaDone(experiment.id)}
      >
        {primary ? 'Open preview' : 'Open with the snippet'}
      </a>
    </section>
  );
}

function BookmarkOption({
  project,
  onOpen,
  opened,
  primary,
}: {
  project: Project;
  onOpen(): void;
  opened: boolean;
  primary?: boolean;
}) {
  return (
    <section className={primary ? styles.option : styles.plain} aria-labelledby="pv-bookmark">
      <h3 id="pv-bookmark" className={styles.title}>
        {primary ? 'Preview with a bookmark, no install' : 'With a bookmark'}
      </h3>
      <ol className={styles.steps}>
        <li>
          Drag <PreviewBookmark project={project} /> to your bookmarks bar (once).
        </li>
        <li>
          <button type="button" className={styles.inline} onClick={onOpen}>
            Open the page
          </button>{' '}
          and click the bookmark there.
        </li>
      </ol>
      {opened && (
        <p className={styles.ok} role="status">
          Page opened. Click the Splitcraft preview bookmark on it.
        </p>
      )}
    </section>
  );
}

/**
 * The bookmark to drag to the bookmarks bar. React refuses `javascript:` URLs in `href`,
 * so it is set on the element directly.
 */
function PreviewBookmark({ project }: { project: Project }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const code = bookmarklet({
    configUrl: configUrl(SUPABASE_URL, project.publicKey),
    dashboard: location.origin,
  });
  useEffect(() => {
    ref.current?.setAttribute('href', code);
  }, [code]);
  return (
    <a
      ref={ref}
      className={styles.bookmark}
      onClick={(e) => e.preventDefault()}
      title="Drag me to your bookmarks bar"
    >
      Splitcraft preview
    </a>
  );
}
