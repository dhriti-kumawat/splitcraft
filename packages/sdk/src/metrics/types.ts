/** Browsing measures (PRODUCT_SPEC §5), each sent under a fixed event key. */
export type BrowsingKind = 'engaged' | 'pages' | 'time' | 'return';
export type Vital = 'lcp' | 'inp' | 'cls';

export const BROWSING_KEYS: Record<BrowsingKind, string> = {
  engaged: 'browse.engaged',
  pages: 'browse.page',
  time: 'browse.time',
  return: 'browse.return',
};

export interface MetricsModule {
  start(opts: {
    browsing: BrowsingKind[];
    vitals: Vital[];
    track(key: string, props?: { value?: number }): void;
    /** Current session: number (1 = first visit) and pages viewed so far. */
    session(): { n: number; p: number };
  }): () => void;
}
