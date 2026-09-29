import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useExperimentsByProject, useMetricsQuery, useSegmentsQuery } from '../data/queries';
import { useCurrentProject, useWorkspace } from '../data/workspace';
import { SearchIcon } from './icons';
import styles from './CommandPalette.module.css';

interface Result {
  id: string;
  group: 'Pages' | 'Projects' | 'Experiments' | 'Audiences' | 'Metrics';
  label: string;
  hint?: string;
  to: string;
}

const GROUPS: Result['group'][] = ['Pages', 'Projects', 'Experiments', 'Audiences', 'Metrics'];
const MAX_PER_GROUP = 6;

/**
 * ⌘K / Ctrl+K search over pages, projects, experiments (every project in the workspace),
 * and the current project's audiences and metrics. A combobox: type to filter, arrow
 * keys to move, Enter to open, Escape to close.
 */
export function CommandPalette({ onClose }: { onClose(): void }) {
  const { projects } = useWorkspace();
  const project = useCurrentProject();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const byProject = useExperimentsByProject(projects.map((p) => p.id));
  const segments = useSegmentsQuery(project?.id ?? '', Boolean(project));
  const metrics = useMetricsQuery(project?.id ?? '', Boolean(project));

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const all = useMemo(() => {
    const out: Result[] = [
      { id: 'page-projects', group: 'Pages', label: 'Projects', to: '/projects' },
      { id: 'page-team', group: 'Pages', label: 'Team', to: '/team' },
      { id: 'page-workspace', group: 'Pages', label: 'Workspace settings', to: '/workspace' },
    ];
    if (project) {
      const base = `/p/${project.id}`;
      for (const [path, label] of [
        ['experiments', 'Experiments'],
        ['audiences', 'Audiences'],
        ['metrics', 'Metrics'],
        ['install', 'Install'],
        ['settings', 'Project settings'],
      ] as const) {
        out.push({
          id: `page-${path}`,
          group: 'Pages',
          label,
          hint: project.name,
          to: `${base}/${path}`,
        });
      }
    }
    for (const p of projects) {
      out.push({
        id: `project-${p.id}`,
        group: 'Projects',
        label: p.name,
        hint: p.mainDomain,
        to: `/p/${p.id}/experiments`,
      });
      for (const e of byProject[p.id]?.experiments ?? []) {
        out.push({
          id: `experiment-${e.id}`,
          group: 'Experiments',
          label: e.name,
          hint: `${p.name} · ${e.archivedAt ? 'archived' : e.status}`,
          to: `/p/${p.id}/experiments/${e.id}/${e.status === 'draft' ? 'basics' : 'results'}`,
        });
      }
    }
    if (project) {
      for (const s of segments.data ?? []) {
        out.push({
          id: `segment-${s.id}`,
          group: 'Audiences',
          label: s.name,
          hint: project.name,
          to: `/p/${project.id}/audiences/${s.id}`,
        });
      }
      for (const m of metrics.data ?? []) {
        out.push({
          id: `metric-${m.id}`,
          group: 'Metrics',
          label: m.name,
          hint: m.eventKey,
          to: `/p/${project.id}/metrics/${m.id}`,
        });
      }
    }
    return out;
  }, [projects, project, byProject, segments.data, metrics.data]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const score = (r: Result) => {
      const label = r.label.toLowerCase();
      if (!q) return 1;
      if (label.startsWith(q)) return 3;
      if (label.includes(q)) return 2;
      return r.hint?.toLowerCase().includes(q) ? 1 : 0;
    };
    return GROUPS.flatMap((group) =>
      all
        .filter((r) => r.group === group)
        .map((r) => ({ r, s: score(r) }))
        .filter((x) => x.s > 0 && (q || group !== 'Experiments' || x.r.hint?.endsWith('live')))
        .sort((a, b) => b.s - a.s)
        .slice(0, MAX_PER_GROUP)
        .map((x) => x.r),
    );
  }, [all, query]);

  const current = Math.min(active, results.length - 1);
  const open = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    navigate(r.to);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(results[current]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  const optionId = (r: Result) => `${listId}-${r.id}`;

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Search">
        <div className={styles.inputRow}>
          <SearchIcon />
          <input
            ref={inputRef}
            className={styles.input}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[current] ? optionId(results[current]) : undefined}
            aria-label="Search projects, experiments, audiences and pages"
            placeholder="Search projects, tests, audiences…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <div id={listId} role="listbox" aria-label="Results" className={styles.list}>
          {results.length === 0 && <p className={styles.empty}>No matches for “{query}”.</p>}
          {GROUPS.map((group) => {
            const items = results.filter((r) => r.group === group);
            if (!items.length) return null;
            return (
              <div key={group} role="group" aria-label={group}>
                <div className={styles.group} aria-hidden="true">
                  {group === 'Experiments' && !query.trim() ? 'Live experiments' : group}
                </div>
                {items.map((r) => {
                  const selected = results[current] === r;
                  return (
                    <div
                      key={r.id}
                      id={optionId(r)}
                      role="option"
                      aria-selected={selected}
                      className={styles.option}
                      onMouseMove={() => setActive(results.indexOf(r))}
                      onClick={() => open(r)}
                    >
                      <span className={styles.label}>{r.label}</span>
                      {r.hint && <span className={styles.hint}>{r.hint}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
