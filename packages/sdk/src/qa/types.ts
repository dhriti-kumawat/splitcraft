/** What the QA panel shows and can do. The SDK runtime provides it; the panel only reads and calls it. */

export interface QaVariant {
  key: string;
  name: string;
}

export interface QaExperiment {
  key: string;
  name: string;
  variantKey: string;
  variants: QaVariant[];
  assignedBy: 'forced' | 'bucketed';
}

export interface QaEvent {
  label: string;
  /** False while a goal on this page has not fired yet. */
  sent: boolean;
}

export interface QaState {
  experiments: QaExperiment[];
  events: QaEvent[];
}

export interface QaSource {
  getState(): QaState;
  /** Call `fn` whenever the state changes. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
  switchVariant(experimentKey: string, variantKey: string): void;
  reset(): void;
}

export interface QaPanelModule {
  mount(source: QaSource): () => void;
}
