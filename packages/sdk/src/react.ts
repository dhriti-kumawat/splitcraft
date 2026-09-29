// React binding: `import { useExperiment } from '@splitcraft/sdk/react'`.
// React is an optional peer dependency; this file is its own entry, so apps without React
// never load it, and it shares the SDK's state with the main entry.
import { useSyncExternalStore } from 'react';
import { ready, subscribe, variant } from './index';

export interface ExperimentState {
  /** The variant key this visitor sees, or null (not in the test, or not decided yet). */
  variant: string | null;
  /** False until the SDK has decided the first page's experiments. */
  ready: boolean;
}

/**
 * The visitor's variant of an experiment, updated after SPA navigations. On the server
 * it reports `{ variant: null, ready: false }`, so render the control until ready.
 *
 * ```tsx
 * const { variant, ready } = useExperiment('sticky-book-bar');
 * if (!ready) return <Skeleton />;
 * return variant === 'b' ? <StickyBar /> : <InlineButton />;
 * ```
 */
export function useExperiment(experimentKey: string): ExperimentState {
  const v = useSyncExternalStore(
    subscribe,
    () => variant(experimentKey),
    () => null,
  );
  const r = useSyncExternalStore(subscribe, ready, () => false);
  return { variant: v, ready: r };
}
