import type { SavedKind } from '../data/api';
import {
  useExperimentQuery,
  useMetricsQuery,
  useSavedQuery,
  useSegmentsQuery,
} from '../data/queries';

// Breadcrumb labels for pages about one record. They share the page's own query, so
// they don't fetch twice, and show the generic word until the name has loaded.

export function ExperimentName({ id }: { id: string }) {
  const experiment = useExperimentQuery(id);
  return <>{experiment.data?.name ?? 'Experiment'}</>;
}

export function SegmentName({ projectId, id }: { projectId: string; id: string }) {
  const segments = useSegmentsQuery(projectId);
  if (id === 'new') return <>New segment</>;
  return <>{segments.data?.find((s) => s.id === id)?.name ?? 'Segment'}</>;
}

export function MetricName({ projectId, id }: { projectId: string; id: string }) {
  const metrics = useMetricsQuery(projectId);
  return <>{metrics.data?.find((m) => m.id === id)?.name ?? 'Metric'}</>;
}

export function SavedName({
  kind,
  projectId,
  id,
}: {
  kind: SavedKind;
  projectId: string;
  id: string;
}) {
  const saved = useSavedQuery(kind, projectId);
  if (id === 'new') return <>{kind === 'triggers' ? 'New trigger' : 'New page set'}</>;
  return (
    <>
      {saved.data?.find((s) => s.id === id)?.name ?? (kind === 'triggers' ? 'Trigger' : 'Page set')}
    </>
  );
}
