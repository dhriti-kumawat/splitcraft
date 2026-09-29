import { useId, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/Button';
import buttonStyles from '../../components/Button.module.css';
import { ConditionBuilder } from '../../components/ConditionBuilder';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { PageHeader } from '../../components/PageHeader';
import { PageRulesEditor } from '../../components/PageRulesEditor';
import { InsertSavedSelect } from '../../components/SavedPicker';
import type { Saved, SavedKind, SavedRules, Segment } from '../../data/api';
import {
  useExperimentsQuery,
  useSavedMutations,
  useSavedQuery,
  useSegmentMutations,
  useSegmentsQuery,
} from '../../data/queries';
import { useCurrentProject } from '../../data/workspace';
import { TopBarActions } from '../../layout/TopBarActions';
import { describeGroups, groupsProblemCount } from '../../lib/conditions';
import {
  describePageRules,
  fromWhere,
  pageRuleProblems,
  toWhere,
  type PageRules,
} from '../../lib/pageRules';
import { fromGroups, toGroups } from '../../lib/segments';
import type { ConditionGroup } from '../../lib/targeting';
import targetingStyles from '../experiments/TargetingPage.module.css';
import styles from './AudiencesPage.module.css';

type Tab = 'segments' | SavedKind;

const TABS: Array<{
  id: Tab;
  label: string;
  path: string;
  noun: string;
  empty: string;
  tip: string;
}> = [
  {
    id: 'segments',
    label: 'Segments',
    path: '',
    noun: 'segment',
    empty: 'No segments yet.',
    tip: "Who a visitor is across visits. Pick them in any experiment's WHO. Edits apply on the next page load.",
  },
  {
    id: 'triggers',
    label: 'Triggers',
    path: '/triggers',
    noun: 'trigger',
    empty: 'No saved triggers yet.',
    tip: "Conditions in the current visit. Insert them into any experiment's HOW; the experiment keeps its own copy.",
  },
  {
    id: 'page_sets',
    label: 'Page sets',
    path: '/page-sets',
    noun: 'page set',
    empty: 'No saved page sets yet.',
    tip: "URL and element rules. Use them in any experiment's WHERE; the experiment keeps its own copy.",
  },
];

/** Project › Audiences: saved segments (20-segment-builder.html), triggers and page sets. */
export function AudiencesPage() {
  const project = useCurrentProject()!;
  const { segmentId, savedId } = useParams();
  const { pathname } = useLocation();
  const tab = TABS.find((t) => t.path && pathname.includes(`/audiences${t.path}`)) ?? TABS[0]!;
  const base = `/p/${project.id}/audiences${tab.path}`;
  const segments = useSegmentsQuery(project.id);
  const triggers = useSavedQuery('triggers', project.id);
  const pageSets = useSavedQuery('page_sets', project.id);
  const experiments = useExperimentsQuery(project.id);
  const usedBy = (id: string) =>
    (experiments.data ?? []).filter(
      (e) => e.targeting.who?.segmentIds.includes(id) && e.status !== 'ended',
    );

  const query = tab.id === 'segments' ? segments : tab.id === 'triggers' ? triggers : pageSets;
  const items: Array<{ id: string; name: string }> = query.data ?? [];
  const currentId = tab.id === 'segments' ? segmentId : savedId;
  const creating = currentId === 'new';

  let editor: ReactNode;
  if (tab.id === 'segments') {
    const selected = segments.data?.find((s) => s.id === segmentId);
    editor = creating ? (
      <SegmentEditor key="new" projectId={project.id} usedBy={[]} others={segments.data ?? []} />
    ) : selected ? (
      <SegmentEditor
        key={selected.id}
        projectId={project.id}
        segment={selected}
        usedBy={usedBy(selected.id).map((e) => e.name)}
        others={(segments.data ?? []).filter((s) => s.id !== selected.id)}
      />
    ) : null;
  } else {
    const list = (tab.id === 'triggers' ? triggers.data : pageSets.data) ?? [];
    const selected = list.find((s) => s.id === savedId);
    editor =
      creating || selected ? (
        <SavedEditor
          key={`${tab.id}-${selected?.id ?? 'new'}`}
          kind={tab.id}
          projectId={project.id}
          item={selected}
        />
      ) : null;
  }

  return (
    <>
      <TopBarActions>
        <Link to={`${base}/new`} className={`${buttonStyles.button} ${buttonStyles.primary}`}>
          + New {tab.noun}
        </Link>
      </TopBarActions>
      <PageHeader
        title="Audiences"
        description="Save who, where and when once, then reuse it in any experiment's targeting."
      />
      <nav className={styles.tabs} aria-label="Audience types">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={`/p/${project.id}/audiences${t.path}`}
            className={styles.tab}
            aria-current={t.id === tab.id ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className={styles.layout}>
        <nav className={styles.list} aria-labelledby="saved-list">
          <div className={styles.listHead}>
            <span className={styles.lbl} id="saved-list">
              Saved {tab.label.toLowerCase()}
            </span>
          </div>
          {query.isPending ? (
            <span className={styles.status}>Loading…</span>
          ) : (
            <ul className={styles.items}>
              {items.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`${base}/${s.id}`}
                    className={styles.item}
                    aria-current={s.id === currentId ? 'page' : undefined}
                  >
                    {s.name}
                    {tab.id === 'segments' && usedBy(s.id).length > 0 && (
                      <span className={styles.used}>
                        {usedBy(s.id).length} {usedBy(s.id).length === 1 ? 'test' : 'tests'}
                      </span>
                    )}
                    {tab.id === 'page_sets' && (
                      <span className={styles.used}>
                        {describePageRules((s as Saved<'page_sets'>).rules)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {query.isSuccess && items.length === 0 && (
            <span className={styles.status}>{tab.empty}</span>
          )}
          <div className={styles.tip}>
            <strong>Reusable everywhere</strong>
            {tab.tip}
          </div>
        </nav>

        {editor ?? (
          <div className={`${styles.editor} ${styles.empty}`}>
            {currentId && query.isSuccess
              ? `This ${tab.noun} doesn't exist.`
              : `Pick a ${tab.noun}, or create a new one.`}
          </div>
        )}
      </div>
    </>
  );
}

function SegmentEditor({
  projectId,
  segment,
  usedBy,
  others,
}: {
  projectId: string;
  segment?: Segment;
  usedBy: string[];
  /** Other saved segments, for "Insert saved audience". */
  others: Segment[];
}) {
  const { create, update, remove } = useSegmentMutations(projectId);
  const navigate = useNavigate();
  const [name, setName] = useState(segment?.name ?? '');
  const [groups, setGroups] = useState<ConditionGroup[]>(() =>
    segment ? toGroups(segment.rules) : [{ mode: 'all', items: [] }],
  );
  const [submitted, setSubmitted] = useState(false);
  // Snapshot of what was last saved, so "Saved" disappears as soon as anything changes.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = useId();
  const problems = groupsProblemCount(groups);
  const nameError = name.trim() ? '' : 'Name the segment.';
  const dirty =
    !segment ||
    name !== segment.name ||
    JSON.stringify(fromGroups(groups)) !== JSON.stringify(fromGroups(toGroups(segment.rules)));

  const snapshot = JSON.stringify({ name, groups });
  const saved = savedSnapshot === snapshot;

  const save = () => {
    setSubmitted(true);
    if (nameError || problems) return;
    const rules = fromGroups(groups.filter((g) => g.items.length > 0));
    if (segment) {
      update.mutate(
        { id: segment.id, name: name.trim(), rules },
        { onSuccess: () => setSavedSnapshot(snapshot) },
      );
    } else {
      create.mutate(
        { name: name.trim(), rules },
        { onSuccess: (s) => navigate(`/p/${projectId}/audiences/${s.id}`, { replace: true }) },
      );
    }
  };
  const failed = create.error ?? update.error ?? remove.error;

  return (
    <section
      className={styles.editor}
      aria-label={segment ? `Segment ${segment.name}` : 'New segment'}
    >
      <div className={styles.summary}>
        <span className={styles.lbl}>In plain words</span>
        <span className={styles.summaryText} aria-live="polite">
          {describeGroups(groups)}
        </span>
      </div>
      <div className={styles.nameRow}>
        <div className={styles.field}>
          <label htmlFor={id} className={styles.label}>
            Segment name
          </label>
          <input
            id={id}
            className={styles.input}
            value={name}
            maxLength={80}
            placeholder="High-intent returners"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && Boolean(nameError)}
            aria-describedby={submitted && nameError ? `${id}-err` : undefined}
          />
          {submitted && nameError && (
            <span id={`${id}-err`} className={styles.error}>
              {nameError}
            </span>
          )}
        </div>
      </div>
      <ConditionBuilder groups={groups} onChange={setGroups} noun="Segment" />
      <InsertSavedSelect
        label="Insert saved audience"
        className={styles.insert}
        items={others.map((s) => ({ id: s.id, name: s.name }))}
        onInsert={(id) => {
          const other = others.find((s) => s.id === id)!;
          // A copy of its rules as one more group; later edits to it don't change this one.
          setGroups((g) => [...g.filter((x) => x.items.length), ...toGroups(other.rules)]);
        }}
      />
      <div className={styles.actions}>
        <Button
          onClick={save}
          disabled={create.isPending || update.isPending || (!dirty && Boolean(segment))}
        >
          {segment ? 'Save segment' : 'Create segment'}
        </Button>
        <span
          role="status"
          className={failed || (submitted && problems) ? styles.error : styles.status}
        >
          {failed
            ? `Couldn't save: ${failed.message}`
            : submitted && problems
              ? `${problems} ${problems === 1 ? 'condition needs' : 'conditions need'} a value.`
              : saved
                ? 'Saved. Live experiments use it from the next page load.'
                : dirty && segment
                  ? 'Unsaved changes'
                  : ''}
        </span>
        {segment && (
          <button
            type="button"
            className={styles.danger}
            style={{ marginLeft: 'auto' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete segment
          </button>
        )}
      </div>
      {confirmDelete && segment && (
        <Dialog
          title={`Delete “${segment.name}”?`}
          description={
            usedBy.length
              ? `It is used by ${usedBy.join(', ')}. Those experiments will match nobody from this segment until you change their targeting.`
              : 'This can’t be undone.'
          }
          onClose={() => setConfirmDelete(false)}
        >
          <div className={dialogStyles.foot}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep segment
            </Button>
            <Button
              onClick={() =>
                remove.mutate(segment.id, {
                  onSuccess: () => navigate(`/p/${projectId}/audiences`, { replace: true }),
                })
              }
            >
              Delete segment
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

/** Editor for a saved trigger (visit conditions) or page set (WHERE rules). */
function SavedEditor<K extends SavedKind>({
  kind,
  projectId,
  item,
}: {
  kind: K;
  projectId: string;
  item?: Saved<K>;
}) {
  const { create, update, remove } = useSavedMutations(kind, projectId);
  const navigate = useNavigate();
  const noun = kind === 'triggers' ? 'trigger' : 'page set';
  const Noun = kind === 'triggers' ? 'Trigger' : 'Page set';
  const path = `/p/${projectId}/audiences/${kind === 'triggers' ? 'triggers' : 'page-sets'}`;
  const [name, setName] = useState(item?.name ?? '');
  const [groups, setGroups] = useState<ConditionGroup[]>(() =>
    kind === 'triggers' && item
      ? toGroups(item.rules as ConditionGroup)
      : [{ mode: 'all', items: [] }],
  );
  const [pages, setPages] = useState<PageRules>(() =>
    kind === 'page_sets' && item
      ? fromWhere(item.rules as SavedRules['page_sets'])
      : { pages: [{ kind: 'include', op: 'matches', value: '' }], elements: [] },
  );
  const [submitted, setSubmitted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const id = useId();

  const rules = (
    kind === 'triggers' ? fromGroups(groups.filter((g) => g.items.length)) : (toWhere(pages) ?? {})
  ) as SavedRules[K];
  const empty = kind === 'triggers' ? !groups.some((g) => g.items.length) : !toWhere(pages);
  const problems = kind === 'triggers' ? groupsProblemCount(groups) : pageRuleProblems(pages);
  const nameError = name.trim() ? '' : `Name the ${noun}.`;
  const snapshot = JSON.stringify({ name, rules });
  const dirty = !item || snapshot !== JSON.stringify({ name: item.name, rules: item.rules });

  const save = () => {
    setSubmitted(true);
    if (nameError || problems || empty) return;
    if (item) {
      update.mutate(
        { id: item.id, name: name.trim(), rules },
        { onSuccess: () => setSavedSnapshot(snapshot) },
      );
    } else {
      create.mutate(
        { name: name.trim(), rules },
        { onSuccess: (s) => navigate(`${path}/${s.id}`, { replace: true }) },
      );
    }
  };
  const failed = create.error ?? update.error ?? remove.error;

  return (
    <section className={styles.editor} aria-label={item ? `${Noun} ${item.name}` : `New ${noun}`}>
      {kind === 'triggers' && (
        <div className={styles.summary}>
          <span className={styles.lbl}>In plain words</span>
          <span className={styles.summaryText} aria-live="polite">
            {describeGroups(groups)}
          </span>
        </div>
      )}
      <div className={styles.nameRow}>
        <div className={styles.field}>
          <label htmlFor={id} className={styles.label}>
            {Noun} name
          </label>
          <input
            id={id}
            className={styles.input}
            value={name}
            maxLength={80}
            placeholder={kind === 'triggers' ? 'Engaged mobile visit' : 'Trip and deal pages'}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && Boolean(nameError)}
            aria-describedby={submitted && nameError ? `${id}-err` : undefined}
          />
          {submitted && nameError && (
            <span id={`${id}-err`} className={styles.error}>
              {nameError}
            </span>
          )}
        </div>
      </div>
      {kind === 'triggers' ? (
        <ConditionBuilder groups={groups} onChange={setGroups} noun="Trigger" />
      ) : (
        <div className={`${targetingStyles.section} ${styles.pageRules}`}>
          <PageRulesEditor value={pages} onChange={setPages} submitted={submitted} />
          <div className={targetingStyles.buttons} style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className={targetingStyles.small}
              onClick={() =>
                setPages({
                  ...pages,
                  pages: [...pages.pages, { kind: 'include', op: 'matches', value: '' }],
                })
              }
            >
              + Rule
            </button>
            <button
              type="button"
              className={targetingStyles.small}
              onClick={() =>
                setPages({ ...pages, elements: [...pages.elements, { selector: '' }] })
              }
            >
              + Element rule
            </button>
          </div>
        </div>
      )}
      <div className={styles.actions}>
        <Button onClick={save} disabled={create.isPending || update.isPending || !dirty}>
          {item ? `Save ${noun}` : `Create ${noun}`}
        </Button>
        <span
          role="status"
          className={failed || (submitted && (problems || empty)) ? styles.error : styles.status}
        >
          {failed
            ? `Couldn't save: ${failed.message}`
            : submitted && empty
              ? `Add at least one ${kind === 'triggers' ? 'condition' : 'rule'}.`
              : submitted && problems
                ? `${problems} ${problems === 1 ? 'rule needs' : 'rules need'} a value.`
                : savedSnapshot === snapshot
                  ? 'Saved. Experiments that already use it keep their own copy.'
                  : dirty && item
                    ? 'Unsaved changes'
                    : ''}
        </span>
        {item && (
          <button
            type="button"
            className={styles.danger}
            style={{ marginLeft: 'auto' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete {noun}
          </button>
        )}
      </div>
      {confirmDelete && item && (
        <Dialog
          title={`Delete “${item.name}”?`}
          description="Experiments that used it keep their own copy of the rules."
          onClose={() => setConfirmDelete(false)}
        >
          <div className={dialogStyles.foot}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep {noun}
            </Button>
            <Button
              onClick={() =>
                remove.mutate(item.id, { onSuccess: () => navigate(path, { replace: true }) })
              }
            >
              Delete {noun}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
