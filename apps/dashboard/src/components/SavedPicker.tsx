import { useId, useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import dialogStyles from './Dialog.module.css';

/**
 * "Insert saved …" as a native select: picking an item inserts a copy of its rules. The
 * select resets, so the same item can be inserted again.
 */
export function InsertSavedSelect({
  label,
  items,
  onInsert,
  className,
}: {
  label: string;
  items: Array<{ id: string; name: string; hint?: string }>;
  onInsert(id: string): void;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <select
      className={className}
      aria-label={label}
      value=""
      onChange={(e) => e.target.value && onInsert(e.target.value)}
    >
      <option value="">{label}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.hint ? `${item.name} · ${item.hint}` : item.name}
        </option>
      ))}
    </select>
  );
}

/** Name dialog for "Save as trigger / page set". */
export function SaveAsDialog({
  title,
  description,
  placeholder,
  pending,
  error,
  onSave,
  onClose,
}: {
  title: string;
  description: string;
  placeholder: string;
  pending: boolean;
  error?: string;
  onSave(name: string): void;
  onClose(): void;
}) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const nameError = name.trim() ? '' : 'Give it a name.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!nameError) onSave(name.trim());
  };

  return (
    <Dialog title={title} description={description} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className={dialogStyles.body}>
          {error && (
            <div role="alert" className={dialogStyles.alert}>
              Couldn't save: {error}
            </div>
          )}
          <div className={dialogStyles.field}>
            <label htmlFor={id} className={dialogStyles.label}>
              Name
            </label>
            <input
              id={id}
              className={dialogStyles.input}
              value={name}
              maxLength={80}
              placeholder={placeholder}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={submitted && Boolean(nameError)}
              aria-describedby={submitted && nameError ? `${id}-e` : undefined}
            />
            {submitted && nameError && (
              <span id={`${id}-e`} className={dialogStyles.error}>
                {nameError}
              </span>
            )}
          </div>
        </div>
        <div className={dialogStyles.foot}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
