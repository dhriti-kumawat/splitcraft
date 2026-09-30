// Messages between the dashboard, this extension and previewed pages. The dashboard's
// copy is apps/dashboard/src/lib/previewBridge.ts; keep them in step.

/** What to preview, as the preview bundle takes it (packages/sdk/src/preview/types.ts). */
export interface PreviewState {
  experimentKey: string;
  experimentName: string;
  variants: Array<{ key: string; name: string; js?: string; css?: string; url?: string | null }>;
  variantKey: string;
  source: 'live' | 'saved';
}

/** From the dashboard page, through dashboard-bridge.ts. */
export type DashboardRequest =
  | { type: 'ping' }
  | { type: 'open'; url: string; hosts: string[]; state: PreviewState }
  | { type: 'update'; state: PreviewState }
  | { type: 'stop'; experimentKey: string };

/** From a previewed page's panel, through preview-bridge.ts. Never carries code. */
export type PageRequest = { type: 'switch'; variantKey: string } | { type: 'stop' };

/** To the dashboard page when the panel changes the preview. */
export type DashboardEvent =
  | { type: 'switched'; experimentKey: string; variantKey: string }
  | { type: 'stopped'; experimentKey: string };

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
