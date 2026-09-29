import { useOutletContext } from 'react-router';
import type { Experiment, Project } from '../../data/api';

export interface ExperimentContext {
  experiment: Experiment;
  project: Project;
}

/** The experiment loaded by ExperimentLayout, for its step pages. */
export function useExperiment(): ExperimentContext {
  return useOutletContext<ExperimentContext>();
}
