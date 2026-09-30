// Entry for the preview bundle (splitcraft-preview.iife.js → window.splitcraftPreview).
// Loaded by the Splitcraft Preview extension or the preview bookmark, on pages with or
// without the snippet. It never sends events.
import { bootBookmark } from './bookmark';
import { createPreview } from './controller';

const api = createPreview();
export const { start, update, rerun, stop, helpers, error } = api;

const script = document.currentScript as HTMLScriptElement | null;
if (script?.dataset.mode === 'bookmark' && script.dataset.dashboard && script.dataset.config) {
  bootBookmark(api, { dashboard: script.dataset.dashboard, config: script.dataset.config });
}
