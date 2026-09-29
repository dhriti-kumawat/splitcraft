import { URL_OPS } from '../lib/conditions';
import type { ElementRule, PageRule, PageRules } from '../lib/pageRules';
import { validRegex } from '../lib/pageRules';
import type { UrlRule } from '../lib/targeting';
import styles from '../pages/experiments/TargetingPage.module.css';

/** WHERE rule rows (URL include / exclude and "element on page exists"), shared by
 * experiment targeting and saved page sets. */
export function PageRulesEditor({
  value,
  onChange,
  submitted,
}: {
  value: PageRules;
  onChange(next: PageRules): void;
  submitted: boolean;
}) {
  const { pages, elements } = value;
  const setPages = (fn: (all: PageRule[]) => PageRule[]) =>
    onChange({ pages: fn(pages), elements });
  const setElements = (fn: (all: ElementRule[]) => ElementRule[]) =>
    onChange({ pages, elements: fn(elements) });

  return (
    <>
      {pages.map((rule, i) => {
        const label = `Page rule ${i + 1}`;
        const bad =
          submitted && (!rule.value.trim() || (rule.op === 'regex' && !validRegex(rule.value)));
        const set = (patch: Partial<PageRule>) =>
          setPages((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
        return (
          <div key={i} className={`${styles.rule} ${bad ? styles.invalid : ''}`}>
            <select
              className={`${styles.select} ${styles.io}`}
              aria-label={`${label} include or exclude`}
              value={rule.kind}
              onChange={(e) => set({ kind: e.target.value as PageRule['kind'] })}
            >
              <option value="include">INCLUDE</option>
              <option value="exclude">EXCLUDE</option>
            </select>
            <span className={styles.sub}>URL</span>
            <select
              className={styles.select}
              aria-label={`${label} operator`}
              value={rule.op}
              onChange={(e) => set({ op: e.target.value as UrlRule['op'] })}
            >
              {URL_OPS.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              className={`${styles.input} ${styles.mono}`}
              aria-label={`${label} value`}
              placeholder={rule.op === 'regex' ? '^/deals/(summer|monsoon)' : '/trips/*'}
              value={rule.value}
              onChange={(e) => set({ value: e.target.value })}
              aria-invalid={bad}
            />
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${label}`}
              onClick={() => setPages((all) => all.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        );
      })}
      {elements.map((el, i) => {
        const label = `Element rule ${i + 1}`;
        const set = (patch: Partial<ElementRule>) =>
          setElements((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)));
        return (
          <div
            key={`el-${i}`}
            className={`${styles.rule} ${submitted && !el.selector.trim() ? styles.invalid : ''}`}
          >
            <span className={styles.io}>AND</span>
            <span className={styles.sub}>Element on page exists</span>
            <input
              className={`${styles.input} ${styles.mono}`}
              aria-label={`${label} CSS selector`}
              placeholder=".book-now-btn"
              value={el.selector}
              onChange={(e) => set({ selector: e.target.value })}
            />
            <span className={styles.sub}>wait up to</span>
            <input
              className={`${styles.input} ${styles.number}`}
              type="number"
              min={0}
              max={10}
              aria-label={`${label} wait in seconds`}
              value={(el.timeoutMs ?? 3000) / 1000}
              onChange={(e) => set({ timeoutMs: Math.round(Number(e.target.value) * 1000) })}
            />
            <span className={styles.sub}>s</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${label}`}
              onClick={() => setElements((all) => all.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        );
      })}
    </>
  );
}
