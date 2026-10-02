import { hidePage } from './antiflicker';
import { applyVariant, removeVariant } from './apply';
import { assignVariant } from './bucketing';
import {
  buildContext,
  loadState,
  recordExposure,
  recordPageview,
  saveState,
  sessionPing,
  type VisitorState,
} from './context';
import { clearForcedVariants, getForcedVariants, getPreviewToken, withForce } from './qa/force';
import { loadGlobal } from './load';
import type {
  BrowsingKind,
  DataLayerGoal,
  MetricsModule,
  TransactionGoal,
  Vital,
} from './metrics/types';
import { loadQaPanel } from './qa/loader';
import type { QaExperiment, QaSource, QaState } from './qa/types';
import { injectStyles, onceInView, waitForElement } from './helpers';
import { onRouteChange } from './router';
import { nav, splitTarget } from './split';
import { evaluateTargeting, waitForDataLayer, type Targeting } from './targeting';
import {
  createQueue,
  createTracker,
  trackClicks,
  trackPageviews,
  trackViews,
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
  /** Split URL tests: the page this variant lives on; the SDK redirects to it. */
  url?: string;
}

export interface ExperimentConfig {
  key: string;
  name: string;
  /** Share of matching visitors who enter, 0–100. */
  trafficPct: number;
  /** Mutual exclusion group, see `Allocation.group`. */
  group?: [string, number, number];
  /** A feature flag (variant `on`): nothing to apply and no exposure event. */
  flag?: true;
  variants: VariantConfig[];
  targeting: Targeting;
}

/** What the SDK fetches per project. The backend (Phase 2) serves this shape. */
export interface ProjectConfig {
  projectKey: string;
  eventsUrl: string;
  experiments: ExperimentConfig[];
  goals?: {
    clicks?: ClickGoal[];
    pageviews?: PageviewGoal[];
    custom?: CustomGoal[];
    datalayer?: DataLayerGoal[];
    transactions?: TransactionGoal[];
    /** These four load the separate metrics bundle, only when present. */
    browsing?: BrowsingKind[];
    vitals?: Vital[];
  };
  /** Visitor country from the edge (ISO 3166-1 alpha-2), if known. */
  country?: string;
  /**
   * Per-project switches, present only when turned off: `spa: false` runs experiments on
   * the first page only (no re-check on route changes); `ga4: false` stops dataLayer pushes.
   * Anti-flicker is switched off on the snippet (`data-antiflicker="off"`), because it
   * starts before the config loads.
   */
  options?: { spa?: false; ga4?: false };
}

export interface StartOptions {
  /** URL of splitcraft-qa.iife.js, loaded only when variants are forced. */
  qaPanelUrl?: string;
  /** URL of splitcraft-metrics.iife.js, loaded only for browsing, Web Vitals, dataLayer and transaction goals. */
  metricsUrl?: string;
  /** Reveal function from an anti-flicker hide started before the config loaded. */
  reveal?: () => void;
}

export interface Runtime {
  trackEvent(key: string, props?: { value?: number; [k: string]: unknown }): void;
  /** The variant key this visitor sees on this page, or null (not in the test). */
  variant(experimentKey: string): string | null;
  /** True once the first page's experiments have been decided. */
  ready(): boolean;
  /** Called whenever a variant or readiness changes (e.g. after an SPA navigation). */
  subscribe(fn: () => void): () => void;
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
    config.options?.ga4 !== false,
  );
  const clickGoals = config.goals?.clicks ?? [];
  const stops = [
    trackClicks(clickGoals, (key, value) =>
      tracker.trackEvent(key, value === undefined ? undefined : { value }),
    ),
    trackViews(clickGoals, (key) => tracker.trackEvent(key)),
    trackPageviews(config.goals?.pageviews ?? [], (key) => tracker.trackEvent(key)),
    runCustomTrackers(config.goals?.custom ?? [], {
      waitForElement,
      onceInView,
      onRouteChange,
      injectStyles,
      trackEvent: tracker.trackEvent,
    }),
  ];

  // Set when a split URL variant sends this visitor elsewhere; the page stays hidden.
  let redirect: string | null = null;

  const runExperiment = async (exp: ExperimentConfig, st: VisitorState): Promise<void> => {
    // The preview extension or bookmark shows this experiment on this page instead.
    if (
      (window as unknown as { __splitcraftPreview?: Record<string, boolean> })
        .__splitcraftPreview?.[exp.key]
    )
      return;
    const t = exp.targeting;
    if (t.waitForDataLayerMs) {
      await waitForDataLayer(t, t.waitForDataLayerMs, () => {
        const w = window as unknown as { dataLayer?: unknown[] };
        return Array.isArray(w.dataLayer) ? w.dataLayer : [];
      });
    }
    const ctx = buildContext(st, exp.key, config.country, Date.now());
    const forcedKey = forced[exp.key];
    const forcedVariant = exp.variants.find((v) => v.key === forcedKey);
    // A forced variant skips WHO / HOW / WHEN and traffic, but still only runs on its pages.
    // "Stay in audience": a visitor who has seen it before skips WHO / HOW.
    const matched = await evaluateTargeting(
      forcedVariant
        ? { where: t.where }
        : t.stay && st.x[exp.key]
          ? { where: t.where, when: t.when }
          : t,
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
            group: exp.group,
          });
    const variant = exp.variants.find((v) => v.key === variantKey);
    if (!variant) {
      removeVariant(exp.key);
      qa.setExperiment(exp.key, null);
      return;
    }
    const target = variant.url && splitTarget(variant.url, location.href);
    if (target) redirect ??= target;
    else
      applyVariant(
        { experimentKey: exp.key, variantKey: variant.key, js: variant.js, css: variant.css },
        { trackEvent: tracker.trackEvent },
      );
    if (!exp.flag && tracker.exposure(exp.key, variant.key))
      recordExposure(st, exp.key, Date.now());
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
    // First page of a session: one ping so the dashboard can estimate reach.
    if (state.s?.p === 1) {
      tracker.ping(sessionPing(state, navigator.userAgent, screen.width, config.country));
    }
    qa.newPage(clickGoals.map((g) => g.key));
    await Promise.all(config.experiments.map((exp) => runExperiment(exp, state)));
    saveState(state);
    if (redirect) {
      queue.flush();
      nav.go(redirect);
    }
  };

  let lastUrl = location.href;
  let isReady = false;
  void run(document.referrer).finally(() => {
    if (!redirect) opts.reveal?.();
    isReady = true;
    for (const fn of qa.listeners) fn();
  });
  if (config.options?.spa !== false) {
    stops.push(
      onRouteChange((url) => {
        const from = lastUrl;
        lastUrl = url;
        void run(from);
      }),
    );
  }

  const { browsing = [], vitals = [], datalayer = [], transactions = [] } = config.goals ?? {};
  if (
    (browsing.length || vitals.length || datalayer.length || transactions.length) &&
    opts.metricsUrl
  ) {
    loadGlobal<MetricsModule>(opts.metricsUrl, 'splitcraftMetrics')
      .then((m) =>
        stops.push(
          m.start({
            browsing,
            vitals,
            datalayer,
            transactions,
            track: tracker.trackEvent,
            session: () => ({ n: state.s?.n ?? 1, p: state.s?.p ?? 1 }),
          }),
        ),
      )
      .catch((err: unknown) => console.error(err));
  }

  if (Object.keys(forced).length > 0 && opts.qaPanelUrl) {
    loadQaPanel(opts.qaPanelUrl)
      .then((panel) => stops.push(panel.mount(qaSource(qa, forced))))
      .catch((err: unknown) => console.error(err));
  }

  return {
    trackEvent: tracker.trackEvent,
    variant: (key) => qa.experiments.get(key)?.variantKey ?? null,
    ready: () => isReady,
    subscribe(fn) {
      qa.listeners.add(fn);
      return () => qa.listeners.delete(fn);
    },
    stop() {
      for (const stop of stops) stop();
      queue.stop();
    },
  };
}

/**
 * Bootstrap for the CDN script tag:
 * `<script src="https://splitcraft.vercel.app/sdk/v1.js" data-project="prj_xxx" async>`.
 * Hides the page at once (unless `data-antiflicker="off"`), then fetches the config and starts.
 */
export function boot(script: HTMLScriptElement): Promise<Runtime | null> {
  const project = script.getAttribute('data-project');
  if (!project) return Promise.resolve(null);
  const reveal = script.getAttribute('data-antiflicker') === 'off' ? () => {} : hidePage();
  const base = new URL(script.src, location.href);
  const config = new URL(script.getAttribute('data-config') ?? `/v1/config/${project}.json`, base);
  const preview = getPreviewToken();
  if (preview) config.searchParams.set('preview', preview);
  const configUrl = config.href;
  const qaPanelUrl = new URL('splitcraft-qa.iife.js', base).href;
  const metricsUrl = new URL('splitcraft-metrics.iife.js', base).href;
  return fetch(configUrl, { credentials: 'omit' })
    .then((res) => {
      if (!res.ok) throw new Error(`config ${res.status}`);
      return res.json() as Promise<ProjectConfig>;
    })
    .then((config) => start(config, { qaPanelUrl, metricsUrl, reveal }))
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
    experiments,
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
