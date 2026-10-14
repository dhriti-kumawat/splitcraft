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
 * the site has it, else the bookmark), the rest folded away. All three show unsaved edits
 * live and can start the visual editor: the snippet and the bookmark take them from this tab.
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
  // The snippet is on the site: the quickest way, no install.
  const hasSnippet = Boolean(project.installedAt);
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
  // The snippet way and the bookmark way both open the page linked to this tab.
  const openLinkedTab = (live: boolean) => {
    setError('');
    const url = previewUrl(experiment, project, visualVariant, live ? location.origin : undefined);
    if (!openForBookmark(url, state())) {
      setError('Your browser blocked the new tab. Allow pop-ups for this site and try again.');
      return;
    }
    markQaDone(experiment.id);
    // The snippet starts the preview itself; the bookmark still needs a click on the page.
    if (live) onClose();
    else setOpened(true);
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
          <SnippetOption onOpen={() => openLinkedTab(true)} primary />
        ) : (
          <BookmarkOption
            project={project}
            onOpen={() => openLinkedTab(false)}
            opened={opened}
            primary
          />
        )}

        {ext === undefined ? (
          <p className={styles.muted} aria-busy="true">
            Checking for the extension…
          </p>
        ) : (
          !ext && (
            <section className={styles.option} aria-labelledby="pv-ext">
              <h3 id="pv-ext" className={styles.title}>
                {hasSnippet
                  ? 'Works on strict sites too: the extension'
                  : 'Want edits to show live? Get the extension'}
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
              {ext && hasSnippet && <SnippetOption onOpen={() => openLinkedTab(true)} />}
              <BookmarkOption
                project={project}
                onOpen={() => openLinkedTab(false)}
                opened={opened}
              />
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

function SnippetOption({ onOpen, primary }: { onOpen(): void; primary?: boolean }) {
  return (
    <section className={primary ? styles.option : styles.plain} aria-labelledby="pv-snippet">
      <h3 id="pv-snippet" className={styles.title}>
        {primary ? 'Open it on your site' : 'With the snippet'}
      </h3>
      <p className={styles.muted}>
        The snippet on your site shows your edits live, saved or not, while this tab stays open.
      </p>
      {primary ? (
        <Button onClick={onOpen}>Open preview</Button>
      ) : (
        <button type="button" className={styles.link} onClick={onOpen}>
          Open with the snippet
        </button>
      )}
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
