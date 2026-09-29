export const VERSION = '0.0.0';

export { getVisitorId } from './visitor';
export { assignVariant, bucketOf, type Allocation, type VariantWeight } from './bucketing';
export { evaluateTargeting, type Targeting, type TargetingContext } from './targeting';
export { injectStyles, onceInView, onRouteChange, waitForElement } from './helpers';
export { applyVariant, removeVariant, type VariantCode } from './apply';
export { hidePage } from './antiflicker';
export {
  createQueue,
  createTracker,
  trackClicks,
  trackPageviews,
  type ClickGoal,
  type PageviewGoal,
  type Tracker,
} from './tracking';
export { clearForcedVariants, getForcedVariants, withForce, type ForcedVariants } from './qa/force';
export { loadQaPanel } from './qa/loader';
export type { QaSource, QaState, QaExperiment, QaEvent } from './qa/types';
