import { Fragment } from 'react';
import {
  conditionProblems,
  DEVICES,
  FIELDS,
  fieldFor,
  needsValue,
  NUMBER_OPS,
  SOURCES,
  STRING_OPS,
  URL_OPS,
  UTM_PARAMS,
  type ConditionType,
} from '../lib/conditions';
import type { Condition, ConditionGroup } from '../lib/targeting';
import { formatRange, type Range } from '../lib/reach';
import styles from './ConditionBuilder.module.css';

type Item = Condition | ConditionGroup;
const isGroup = (item: Item): item is ConditionGroup => 'mode' in item;
const CATEGORIES = [...new Set(FIELDS.map((f) => f.category))];

interface Props {
  groups: ConditionGroup[];
  onChange(groups: ConditionGroup[]): void;
  /** Used in accessible names, e.g. "Segment" or "Trigger". */
  noun: string;
  /** Allow several top-level groups (ANDed). Default true. */
  multipleGroups?: boolean;
  /** Default mode for a new top-level group. */
  defaultMode?: ConditionGroup['mode'];
  /** Share of recent sessions each group matches (reach estimates), if known. */
  estimate?: (group: ConditionGroup) => Range | null;
}

/**
 * The shared condition builder (segments and targeting): groups with ALL / ANY / NONE,
 * nesting, and a row per condition with field, operator and value.
 */
export function ConditionBuilder({
  groups,
  onChange,
  noun,
  multipleGroups = true,
  defaultMode = 'all',
  estimate,
}: Props) {
  const setGroup = (i: number, g: ConditionGroup) =>
    onChange(groups.map((x, j) => (j === i ? g : x)));
  const removeGroup = (i: number) => onChange(groups.filter((_, j) => j !== i));

  return (
    <div className={styles.builder}>
      {groups.length === 0 && <p className={styles.empty}>No conditions: everyone matches.</p>}
      {groups.map((g, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={styles.and}>AND</span>}
          <Group
            group={g}
            path={`${noun} group ${i + 1}`}
            onChange={(next) => setGroup(i, next)}
            onRemove={multipleGroups || groups.length > 1 ? () => removeGroup(i) : undefined}
            estimate={estimate}
          />
        </Fragment>
      ))}
      {(multipleGroups || groups.length === 0) && (
        <div>
          <button
            type="button"
            className={styles.small}
            onClick={() =>
              onChange([...groups, { mode: defaultMode, items: [FIELDS[0]!.create()] }])
            }
          >
            + Add group
          </button>
        </div>
      )}
    </div>
  );
}

function Group({
  group,
  path,
  onChange,
  onRemove,
  nested,
  estimate,
}: {
  group: ConditionGroup;
  path: string;
  onChange(g: ConditionGroup): void;
  onRemove?(): void;
  nested?: boolean;
  estimate?: Props['estimate'];
}) {
  const match = group.items.length ? estimate?.(group) : null;
  const setItem = (i: number, item: Item) =>
    onChange({ ...group, items: group.items.map((x, j) => (j === i ? item : x)) });
  const removeItem = (i: number) =>
    onChange({ ...group, items: group.items.filter((_, j) => j !== i) });
  const add = (item: Item) => onChange({ ...group, items: [...group.items, item] });

  return (
    <div
      className={`${styles.group} ${nested ? styles.nested : ''}`}
      role="group"
      aria-label={path}
    >
      <div className={styles.groupHead}>
        <div className={styles.groupTitle}>
          <div className={styles.modes} role="group" aria-label={`${path} match`}>
            {(['all', 'any', 'none'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.mode} ${m === 'none' ? styles.exclude : ''}`}
                aria-pressed={group.mode === m}
                onClick={() => onChange({ ...group, mode: m })}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <span>
            {group.mode === 'all'
              ? 'Every condition must match'
              : group.mode === 'any'
                ? 'At least one must match'
                : 'Excludes anyone who matches'}
          </span>
          {match && (
            <span
              className={styles.match}
              title="Share of the last 30 days' sessions this group matches. A range means some conditions need the live page to check."
            >
              {formatRange(match)} match
            </span>
          )}
        </div>
        <div className={styles.groupActions}>
          <button type="button" className={styles.small} onClick={() => add(FIELDS[0]!.create())}>
            + Condition
          </button>
          <button
            type="button"
            className={styles.small}
            onClick={() => add({ mode: 'any', items: [FIELDS[0]!.create()] })}
          >
            + Nested group
          </button>
          {onRemove && (
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${path}`}
              onClick={onRemove}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {group.items.map((item, i) =>
        isGroup(item) ? (
          <Group
            key={i}
            nested
            group={item}
            path={`${path}, nested group ${i + 1}`}
            onChange={(g) => setItem(i, g)}
            onRemove={() => removeItem(i)}
            estimate={estimate}
          />
        ) : (
          <Row
            key={i}
            condition={item}
            label={`${path}, condition ${i + 1}`}
            onChange={(c) => setItem(i, c)}
            onRemove={() => removeItem(i)}
          />
        ),
      )}
    </div>
  );
}

function Row({
  condition: c,
  label,
  onChange,
  onRemove,
}: {
  condition: Condition;
  label: string;
  onChange(c: Condition): void;
  onRemove(): void;
}) {
  const problems = conditionProblems(c);
  const set = (patch: Partial<Condition>) => onChange({ ...c, ...patch } as Condition);
  const a = (part: string) => `${label} ${part}`;

  const stringOp = (op: Extract<Condition, { op: string }>['op'] & string) => (
    <select
      className={styles.select}
      aria-label={a('operator')}
      value={op}
      onChange={(e) => set({ op: e.target.value } as Partial<Condition>)}
    >
      {STRING_OPS.map((o) => (
        <option key={o.op} value={o.op}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const stringValue = (op: string, value: string | string[] | undefined, placeholder = 'value') =>
    needsValue(op as never) && (
      <input
        className={`${styles.input} ${styles.mono}`}
        aria-label={a('value')}
        placeholder={
          op === 'is' || op === 'is_not' ? `${placeholder} (comma = any of)` : placeholder
        }
        value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
        onChange={(e) => {
          const raw = e.target.value;
          const list = raw
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
          set({
            value: (op === 'is' || op === 'is_not') && list.length > 1 ? list : raw,
          } as Partial<Condition>);
        }}
      />
    );
  const numberFields = (op: string, value: number, unit?: string) => (
    <>
      <select
        className={styles.select}
        aria-label={a('operator')}
        value={op}
        onChange={(e) => set({ op: e.target.value } as Partial<Condition>)}
      >
        {NUMBER_OPS.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        className={`${styles.input} ${styles.number}`}
        type="number"
        aria-label={a('value')}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) =>
          set({ value: e.target.value === '' ? NaN : Number(e.target.value) } as Partial<Condition>)
        }
      />
      {unit && <span className={styles.text}>{unit}</span>}
    </>
  );
  const checks = <T extends string>(options: Array<{ value: T; label: string }>, value: T[]) => (
    <div className={styles.checks} role="group" aria-label={a('values')}>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="checkbox"
            checked={value.includes(o.value)}
            onChange={(e) =>
              set({
                value: e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value),
              } as Partial<Condition>)
            }
          />
          {o.label}
        </label>
      ))}
    </div>
  );
  const textInput = (key: 'name' | 'key' | 'path', value: string, placeholder: string) => (
    <input
      className={`${styles.input} ${styles.mono}`}
      aria-label={a(placeholder)}
      placeholder={placeholder}
      value={value}
      onChange={(e) => set({ [key]: e.target.value } as Partial<Condition>)}
    />
  );

  let editor;
  switch (c.type) {
    case 'visitor_type':
      editor = (
        <select
          className={styles.select}
          aria-label={a('value')}
          value={c.value}
          onChange={(e) => set({ value: e.target.value as 'new' })}
        >
          <option value="new">New visitor</option>
          <option value="returning">Returning visitor</option>
        </select>
      );
      break;
    case 'session_number':
    case 'pages_viewed_session':
      editor = numberFields(c.op, c.value);
      break;
    case 'screen_width':
      editor = numberFields(c.op, c.value, 'px');
      break;
    case 'page_views_matching':
      editor = (
        <>
          <select
            className={styles.select}
            aria-label={a('URL operator')}
            value={c.url.op}
            onChange={(e) => set({ url: { ...c.url, op: e.target.value as typeof c.url.op } })}
          >
            {URL_OPS.map((o) => (
              <option key={o.op} value={o.op}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className={`${styles.input} ${styles.mono}`}
            aria-label={a('URL')}
            value={c.url.value}
            onChange={(e) => set({ url: { ...c.url, value: e.target.value } })}
          />
          <span className={styles.text}>at least</span>
          <input
            className={`${styles.input} ${styles.number}`}
            type="number"
            min={1}
            aria-label={a('times')}
            value={c.count}
            onChange={(e) => set({ count: Number(e.target.value) })}
          />
          <span className={styles.text}>times in</span>
          <input
            className={`${styles.input} ${styles.number}`}
            type="number"
            min={1}
            aria-label={a('days')}
            value={c.days}
            onChange={(e) => set({ days: Number(e.target.value) })}
          />
          <span className={styles.text}>days</span>
        </>
      );
      break;
    case 'device_type':
      editor = checks(DEVICES, c.value);
      break;
    case 'source_type':
      editor = checks(SOURCES, c.value);
      break;
    case 'country':
      editor = (
        <>
          {stringOp(c.op)}
          {stringValue(c.op, c.value, 'IN, GB')}
        </>
      );
      break;
    case 'utm':
      editor = (
        <>
          <select
            className={styles.select}
            aria-label={a('parameter')}
            value={c.param}
            onChange={(e) => set({ param: e.target.value as typeof c.param })}
          >
            {UTM_PARAMS.map((p) => (
              <option key={p} value={p}>
                utm_{p}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label={a('touch')}
            value={c.touch}
            onChange={(e) => set({ touch: e.target.value as 'first' })}
          >
            <option value="first">first-touch</option>
            <option value="last">last-touch</option>
          </select>
          {stringOp(c.op)}
          {stringValue(c.op, c.value)}
        </>
      );
      break;
    case 'cookie':
      editor = (
        <>
          {textInput('name', c.name, 'cookie name')}
          {stringOp(c.op)}
          {stringValue(c.op, c.value)}
        </>
      );
      break;
    case 'data_layer':
      editor = (
        <>
          {textInput('key', c.key, 'key, e.g. user.plan')}
          {stringOp(c.op)}
          {stringValue(c.op, c.value)}
        </>
      );
      break;
    case 'js_variable':
      editor = (
        <>
          {textInput('path', c.path, 'path on window, e.g. app.user.plan')}
          {stringOp(c.op)}
          {stringValue(c.op, c.value)}
        </>
      );
      break;
    case 'custom_js':
      editor = (
        <textarea
          className={styles.textarea}
          aria-label={a('code')}
          spellCheck={false}
          value={c.code}
          onChange={(e) => set({ code: e.target.value })}
        />
      );
      break;
  }

  return (
    <div className={`${styles.row} ${problems.length ? styles.invalid : ''}`}>
      <select
        className={`${styles.select} ${styles.field}`}
        aria-label={a('field')}
        value={c.type}
        onChange={(e) => onChange(fieldFor(e.target.value as ConditionType).create())}
      >
        {CATEGORIES.map((cat) => (
          <optgroup key={cat} label={cat}>
            {FIELDS.filter((f) => f.category === cat).map((f) => (
              <option key={f.type} value={f.type}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {editor}
      <button
        type="button"
        className={styles.remove}
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        ×
      </button>
      {problems.length > 0 && <span className={styles.problem}>{problems.join(' ')}</span>}
    </div>
  );
}
