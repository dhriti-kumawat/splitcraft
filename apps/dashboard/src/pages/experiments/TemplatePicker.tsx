import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { TEMPLATES, type Template } from '../../lib/templates';
import styles from './TemplatePicker.module.css';

/**
 * Template gallery for variant code. When the variant already has code, it asks whether
 * to replace it or add the template below, so nothing is lost by accident.
 */
export function TemplatePicker({
  hasCode,
  onPick,
  onClose,
}: {
  hasCode: boolean;
  onPick(t: Template, mode: 'replace' | 'append'): void;
  onClose(): void;
}) {
  const [chosen, setChosen] = useState<Template | null>(null);

  if (chosen) {
    return (
      <Dialog
        title={`Use “${chosen.name}”?`}
        description="This variant already has code. Replace it, or add the template below what you have."
        onClose={onClose}
      >
        <div className={dialogStyles.foot}>
          <Button variant="secondary" onClick={() => setChosen(null)}>
            Back
          </Button>
          <Button variant="secondary" onClick={() => onPick(chosen, 'append')}>
            Add below
          </Button>
          <Button onClick={() => onPick(chosen, 'replace')}>Replace code</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Start from a template"
      description="Working code for common tests. Change the example selectors to match your page."
      onClose={onClose}
    >
      <ul className={styles.grid}>
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={styles.card}
              onClick={() => (hasCode && t.id !== 'blank' ? setChosen(t) : onPick(t, 'replace'))}
            >
              <span className={styles.category}>{t.category}</span>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.description}>{t.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
