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
 * "Preview on site": the three ways to see a variant on the real page, most reliable first.
 * The extension and the bookmark show unsaved edits live; the snippet shows saved code.
 */
export function PreviewDialog({
  experiment,
  project,
  onClose,
}: {
  experiment: Experiment;
  project: Project;
  onClose(): void;
}) {
  const ext = useExtension();
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const page = testPage(experiment, project);

  const openExtension = () => {
    setError('');
    openWithExtension(page, projectHosts(project), previewState(experiment)).then(
      () => {
        markQaDone(experiment.id);
        onClose();
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  };
  const openBookmarkTab = () => {
    setError('');
    if (openForBookmark(previewUrl(experiment, project), previewState(experiment))) {
      markQaDone(experiment.id);
      setOpened(true);
    } else setError('Your browser blocked the new tab. Allow pop-ups for this site and try again.');
  };

  return (
    <Dialog
      title="Preview on site"
      description={`See ${experiment.name} on ${page.replace(/^https?:\/\//, '')} before visitors do. Only you see it.`}
      onClose={onClose}
      wide
    >
      <div className={dialog.body}>
        {error && (
          <div role="alert" className={dialog.alert}>
            {error}
          </div>
        )}

        <section className={styles.option} aria-labelledby="pv-ext">
          <div className={styles.head}>
            <h3 id="pv-ext" className={styles.title}>
              Splitcraft Preview extension
            </h3>
            <span className={styles.badge}>Recommended</span>
          </div>
          <p className={styles.text}>
            Works on any page of your site, with or without the snippet. Edits you make here show on
            the page as you type. Chrome, Edge, Brave and Arc.
          </p>
          {ext === undefined ? (
            <p className={styles.text} aria-busy="true">
              Checking for the extension…
            </p>
          ) : ext ? (
            <>
              <p className={styles.ok}>Installed (version {ext.version}).</p>
              {!ext.userScripts && (
                <p className={styles.warn}>
                  To run variant JS on sites with a strict security policy, open{' '}
                  <span className="mono">chrome://extensions</span>, choose <b>Details</b> on
                  Splitcraft Preview and turn on <b>Allow user scripts</b>.
                </p>
              )}
              <Button onClick={openExtension}>Open preview</Button>
            </>
          ) : (
            <ol className={styles.steps}>
              <li>
                <a href={EXTENSION_ZIP_URL} download className={styles.link}>
                  Download the extension
                </a>{' '}
                and unzip it.
              </li>
              <li>
                Open <span className="mono">chrome://extensions</span> and turn on{' '}
                <b>Developer mode</b>.
              </li>
              <li>
                Click <b>Load unpacked</b> and choose the{' '}
                <span className="mono">splitcraft-preview</span> folder.
              </li>
              <li>Reload this page. This box then shows Open preview.</li>
            </ol>
          )}
        </section>

        <section className={styles.option} aria-labelledby="pv-bookmark">
          <h3 id="pv-bookmark" className={styles.title}>
            No install: preview bookmark
          </h3>
          <ol className={styles.steps}>
            <li>
              Drag <PreviewBookmark project={project} /> to your bookmarks bar (once).
            </li>
            <li>
              <button type="button" className={styles.inline} onClick={openBookmarkTab}>
                Open the page
              </button>{' '}
              in a new tab.
            </li>
            <li>
              On that page, click the bookmark. Edits here show there while both tabs stay open.
            </li>
          </ol>
          {opened && (
            <p className={styles.ok} role="status">
              Page opened. Click the Splitcraft preview bookmark on it.
            </p>
          )}
          <p className={styles.muted}>
            Some sites block bookmarks like this with a Content-Security-Policy; use the extension
            there.
          </p>
        </section>

        <section className={styles.option} aria-labelledby="pv-snippet">
          <h3 id="pv-snippet" className={styles.title}>
            Page already has the snippet
          </h3>
          <p className={styles.text}>
            Opens the page with this variant forced and the QA panel. Shows saved code.
          </p>
          <a
            className={styles.link}
            href={previewUrl(experiment, project)}
            target="_blank"
            rel="noreferrer"
            onClick={() => markQaDone(experiment.id)}
          >
            Open with the snippet
          </a>
        </section>
      </div>
      <div className={dialog.foot}>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
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
