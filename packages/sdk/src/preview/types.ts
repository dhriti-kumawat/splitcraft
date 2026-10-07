/** One variant as the dashboard sends it: saved code, or unsaved edits from the editor. */
export interface PreviewVariant {
  key: string;
  name: string;
  js?: string;
  css?: string;
  /** Split URL tests: the variant's page. */
  url?: string | null;
}

/** What to preview on this page. */
export interface PreviewState {
  experimentKey: string;
  experimentName: string;
  variants: PreviewVariant[];
  variantKey: string;
  /**
   * Where the code comes from, shown in the panel: `live` (streamed from the open
   * dashboard) or `saved` (read from the config with the preview token).
   */
  source: 'live' | 'saved';
  /** Start the visual editor on this variant as soon as the preview opens. */
  visual?: boolean;
}

export interface StartOptions {
  /**
   * The Chrome extension runs variant JS itself (chrome.userScripts, which the page's
   * Content-Security-Policy can't block). Otherwise the bundle runs it.
   */
  externalJs?: boolean;
  /** Called for the panel's actions; the extension or the bookmark bridge handles them. */
  onAction?(action: PreviewAction): void;
}

/** Where a moved or inserted element goes, relative to the target element. */
export type VisualPosition = 'before' | 'after' | 'prepend' | 'append';

/**
 * One change from the visual editor. It is data only: the dashboard turns it into
 * variant code, checking every field (see apps/dashboard/src/lib/visual.ts).
 * `color` and `background` are the editor's first version, kept for old previews.
 */
export type VisualChange =
  | { selector: string; kind: 'text' | 'html'; value: string }
  | { selector: string; kind: 'hide' | 'remove' }
  | { selector: string; kind: 'style'; prop: string; value: string }
  | { selector: string; kind: 'attr'; name: string; value: string }
  | { selector: string; kind: 'move'; target: string; position: VisualPosition }
  | { selector: string; kind: 'insert'; value: string; position: VisualPosition }
  | { selector: string; kind: 'color' | 'background'; value: string };

export type PreviewAction =
  | { type: 'switch'; variantKey: string }
  | { type: 'stop' }
  | { type: 'reload' }
  | { type: 'visual'; variantKey: string; changes: VisualChange[] };

/** `update` result: `live` when applied in place, `rerun` when the JS changed. */
export type UpdateResult = 'live' | 'rerun';

/** window.splitcraftPreview */
export interface PreviewApi {
  start(state: PreviewState, opts?: StartOptions): void;
  update(state: PreviewState): UpdateResult;
  /** Run the current variant's JS again on this page (bookmark mode, after `rerun`). */
  rerun(): void;
  stop(): void;
  /** `splitcraft.*` helpers for variant code the extension runs itself. */
  helpers: Record<string, unknown>;
  /** Show an error in the panel, e.g. when the extension's JS run failed. */
  error(message: string): void;
}
