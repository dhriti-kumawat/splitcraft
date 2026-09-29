import { hidePage } from './antiflicker';
import { applyVariant, removeVariant } from './apply';
import { assignVariant } from './bucketing';
import {
  buildContext,
  loadState,
  recordExposure,
  recordPageview,
  saveState,
  type VisitorState,
} from './context';
import { clearForcedVariants, getForcedVariants, withForce } from './qa/force';
import { loadQaPanel } from './qa/loader';
import type { QaExperiment, QaSource, QaState } from './qa/types';
import { injectStyles, onceInView, waitForElement } from './helpers';
import { onRouteChange } from './router';
import { evaluateTargeting, type Targeting } from './targeting';
import {
  createQueue,
  createTracker,
  trackClicks,
  trackPageviews,
  runCustomTrackers,
  type ClickGoal,
  type CustomGoal,
  type PageviewGoal,
  type TrackedEvent,
} from './tracking';
import { getVisitorId } from './visitor';

export interface VariantConfig {
  key: string;
  name: string;
  weight: number;
  js?: string;
  css?: string;
}

export interface ExperimentConfig {
  key: string;
  name: string;
  /** Share of matching visitors who enter, 0–100. */
  trafficPct: number;
  variants: VariantConfig[];
  targeting: Targeting;
}

/** What the SDK fetches per project. The backend (Phase 2) serves this shape. */
export interface ProjectConfig {
  projectKey: string;
  eventsUrl: string;
  experiments: ExperimentConfig[];
  goals?: { clicks?: ClickGoal[]; pageviews?: PageviewGoal[]; custom?: CustomGoal[] };
  /** Visitor country from the edge (ISO 3166-1 alpha-2), if known. */
  country?: string;
}

export interface StartOptions {
  /** URL of splitcraft-qa.iife.js, loaded only when variants are forced. */
  qaPanelUrl?: string;
  /** Reveal function from an anti-flicker hide started before the config loaded. */
  reveal?: () => void;
}

export interface Runtime {
  trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void;
  stop(): void;
}

/**
 * Run every experiment in `config` on this page, and again after each SPA navigation:
 * evaluate targeting, bucket (or use the forced variant), apply, send the exposure.
 */
export function start(config: ProjectConfig, opts: StartOptions = {}): Runtime {
  const visitorId = getVisitorId();
  const state = loadState();
  const forced = getForcedVariants();
  const qa = createQaState();

  const queue = createQueue({ endpoint: config.eventsUrl, projectKey: config.projectKey });
  const tracker = createTracker(
    {
      ...queue,
      push(event) {
        queue.push(event);
        qa.sent(event);
      },
    },
    visitorId,
  );
  const clickGoals = config.goals?.clicks ?? [];
  const stops = [
    trackClicks(clickGoals, (key) => tracker.trackEvent(key)),
    trackPageviews(config.goals?.pageviews ?? [], (key) => tracker.trackEvent(key)),
    runCustomTrackers(config.goals?.custom ?? [], {
      waitForElement,
      onceInView,
      onRouteChange,
      injectStyles,
      trackEvent: tracker.trackEvent,
    }),
  ];

  const runExperiment = async (exp: ExperimentConfig, st: VisitorState): Promise<void> => {
    const ctx = buildContext(st, exp.key, config.country, Date.now());
    const forcedKey = forced[exp.key];
    const forcedVariant = exp.variants.find((v) => v.key === forcedKey);
    // A forced variant skips WHO / HOW / WHEN and traffic, but still only runs on its pages.
    const matched = await evaluateTargeting(
      forcedVariant ? { where: exp.targeting.where } : exp.targeting,
      ctx,
    );
    const variantKey = !matched
      ? null
      : forcedVariant
        ? forcedVariant.key
        : assignVariant(visitorId, {
            experimentKey: exp.key,
            trafficPct: exp.trafficPct,
            variants: exp.variants,
          });
    const variant = exp.variants.find((v) => v.key === variantKey);
    if (!variant) {
      removeVariant(exp.key);
      qa.setExperiment(exp.key, null);
      return;
    }
    applyVariant(
      { experimentKey: exp.key, variantKey: variant.key, js: variant.js, css: variant.css },
      { trackEvent: tracker.trackEvent },
    );
    if (tracker.exposure(exp.key, variant.key)) recordExposure(st, exp.key, Date.now());
    qa.setExperiment(exp.key, {
      key: exp.key,
      name: exp.name,
      variantKey: variant.key,
      variants: exp.variants.map(({ key, name }) => ({ key, name })),
      assignedBy: forcedVariant ? 'forced' : 'bucketed',
    });
  };

  const run = async (referrer: string): Promise<void> => {
    recordPageview(state, location.href, referrer, Date.now());
    qa.newPage(clickGoals.map((g) => g.key));
    await Promise.all(config.experiments.map((exp) => runExperiment(exp, state)));
    saveState(state);
  };

  let lastUrl = location.href;
  void run(document.referrer).finally(() => opts.reveal?.());
  stops.push(
    onRouteChange((url) => {
      const from = lastUrl;
      lastUrl = url;
      void run(from);
    }),
  );

  if (Object.keys(forced).length > 0 && opts.qaPanelUrl) {
    loadQaPanel(opts.qaPanelUrl)
      .then((panel) => stops.push(panel.mount(qaSource(qa, forced))))
      .catch((err: unknown) => console.error(err));
  }

  return {
    trackEvent: tracker.trackEvent,
    stop() {
      for (const stop of stops) stop();
      queue.stop();
    },
  };
}

/**
 * Bootstrap for the CDN script tag:
 * `<script src="https://splitcraft.app/sdk/v1.js" data-project="prj_xxx" async>`.
 * Hides the page at once, then fetches the config and starts.
 */
export function boot(script: HTMLScriptElement): Promise<Runtime | null> {
  const project = script.getAttribute('data-project');
  if (!project) return Promise.resolve(null);
  const reveal = hidePage();
  const base = new URL(script.src, location.href);
  const configUrl =
    script.getAttribute('data-config') ?? new URL(`/v1/config/${project}.json`, base).href;
  const qaPanelUrl = new URL('splitcraft-qa.iife.js', base).href;
  return fetch(configUrl, { credentials: 'omit' })
    .then((res) => {
      if (!res.ok) throw new Error(`config ${res.status}`);
      return res.json() as Promise<ProjectConfig>;
    })
    .then((config) => start(config, { qaPanelUrl, reveal }))
    .catch((err: unknown) => {
      reveal();
      console.error('[splitcraft] Could not start:', err);
      return null;
    });
}

// ------------------------------------------------------------------ QA state

function createQaState() {
  const experiments = new Map<string, QaExperiment>();
  let events: QaState['events'] = [];
  let waiting: string[] = [];
  const listeners = new Set<() => void>();
  const changed = (): void => {
    for (const fn of listeners) fn();
  };

  return {
    listeners,
    get: (): QaState => ({
      experiments: [...experiments.values()],
      events: [...events, ...waiting.map((label) => ({ label, sent: false }))],
    }),
    newPage(goalKeys: string[]) {
      events = [];
      waiting = [...goalKeys];
      changed();
    },
    setExperiment(key: string, exp: QaExperiment | null) {
      if (exp) experiments.set(key, exp);
      else experiments.delete(key);
      changed();
    },
    sent(e: TrackedEvent) {
      const label =
        e.type === 'exposure' ? `exposure · ${e.experimentKey} · ${e.variantKey}` : (e.key ?? '');
      events.push({ label, sent: true });
      waiting = waiting.filter((k) => k !== e.key);
      changed();
    },
  };
}

function qaSource(qa: ReturnType<typeof createQaState>, forced: Record<string, string>): QaSource {
  return {
    getState: qa.get,
    subscribe(fn) {
      qa.listeners.add(fn);
      return () => qa.listeners.delete(fn);
    },
    switchVariant(experimentKey, variantKey) {
      location.assign(withForce(location.href, { ...forced, [experimentKey]: variantKey }));
    },
    reset() {
      clearForcedVariants();
      location.assign(withForce(location.href, {}));
    },
  };
}
