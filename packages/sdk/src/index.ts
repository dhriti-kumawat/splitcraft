import {
  boot,
  start as startRuntime,
  type ProjectConfig,
  type Runtime,
  type StartOptions,
} from './runtime';

export const VERSION = '0.0.0';

// Public API. In the CDN build these become `window.splitcraft.*`.
export { injectStyles, onceInView, onRouteChange, waitForElement } from './helpers';
export type { ExperimentConfig, ProjectConfig, StartOptions, VariantConfig } from './runtime';
export type { Targeting } from './targeting';

type TrackArgs = Parameters<Runtime['trackEvent']>;

let runtime: Runtime | null = null;
// Calls made before the config has loaded; replayed once it has. Capped to stay small.
const pending: TrackArgs[] = [];

export function trackEvent(...args: TrackArgs): void {
  if (runtime) runtime.trackEvent(...args);
  else if (pending.length < 100) pending.push(args);
}

/** Start with a config already in hand (npm use). The CDN script starts itself. */
export function start(config: ProjectConfig, opts?: StartOptions): Runtime {
  return attach(startRuntime(config, opts));
}

function attach(rt: Runtime): Runtime {
  runtime = rt;
  for (const args of pending.splice(0)) rt.trackEvent(...args);
  return rt;
}

const script = typeof document !== 'undefined' ? document.currentScript : null;
if (script?.tagName === 'SCRIPT' && script.hasAttribute('data-project')) {
  void boot(script as HTMLScriptElement).then((rt) => rt && attach(rt));
}
