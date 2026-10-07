// Messages between the dashboard, this extension and previewed pages. The dashboard's
// copy is apps/dashboard/src/lib/previewBridge.ts; keep them in step.

/** What to preview, as the preview bundle takes it (packages/sdk/src/preview/types.ts). */
export interface PreviewState {
  experimentKey: string;
  experimentName: string;
  variants: Array<{ key: string; name: string; js?: string; css?: string; url?: string | null }>;
  variantKey: string;
  source: 'live' | 'saved';
  visual?: boolean;
}

/** From the dashboard page, through dashboard-bridge.ts. */
export type DashboardRequest =
  | { type: 'ping' }
  | { type: 'open'; url: string; hosts: string[]; state: PreviewState }
  | { type: 'update'; state: PreviewState; select?: boolean }
  | { type: 'stop'; experimentKey: string };

/** A visual editor change: data only; the dashboard builds (and checks) the code from it. */
export interface VisualChange {
  selector: string;
  kind: string;
  value?: string;
  prop?: string;
  name?: string;
  target?: string;
  position?: string;
}

/**
 * From a previewed page's panel, through preview-bridge.ts. Never carries code: visual
 * changes are checked data, and the dashboard shows the code they make before saving.
 */
export type PageRequest =
  | { type: 'switch'; variantKey: string }
  | { type: 'stop' }
  | { type: 'visual'; variantKey: string; changes: VisualChange[] };

const KINDS = [
  'text',
  'html',
  'hide',
  'remove',
  'style',
  'attr',
  'move',
  'insert',
  'color',
  'background',
];
const FIELDS = ['value', 'prop', 'name', 'target', 'position'] as const;

/** Keeps only well-formed visual changes (at most 200), or null when there are none. */
export function visualChanges(raw: unknown): VisualChange[] | null {
  if (!Array.isArray(raw)) return null;
  const ok: VisualChange[] = [];
  for (const c of raw.slice(0, 200)) {
    if (typeof c !== 'object' || c === null) continue;
    const r = c as Record<string, unknown>;
    if (typeof r.selector !== 'string' || !r.selector || r.selector.length > 300) continue;
    if (typeof r.kind !== 'string' || !KINDS.includes(r.kind)) continue;
    const change: VisualChange = { selector: r.selector, kind: r.kind };
    let valid = true;
    for (const f of FIELDS) {
      if (r[f] === undefined) continue;
      if (typeof r[f] !== 'string' || (r[f] as string).length > 20000) valid = false;
      else change[f] = r[f] as string;
    }
    if (valid) ok.push(change);
  }
  return ok.length ? ok : null;
}

/** To the dashboard page when the panel changes the preview. */
export type DashboardEvent =
  | { type: 'switched'; experimentKey: string; variantKey: string }
  | { type: 'stopped'; experimentKey: string }
  | { type: 'visual'; experimentKey: string; variantKey: string; changes: VisualChange[] };

export interface PingReply {
  version: string;
  /** chrome.userScripts is allowed: JS runs even on pages whose CSP blocks eval. */
  userScripts: boolean;
}

/** The dashboards allowed to send code (manifest content_scripts match these too). */
export const DASHBOARD_ORIGINS = [
  'https://splitcraft-app.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
