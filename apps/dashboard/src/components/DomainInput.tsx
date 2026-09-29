import { useState, type KeyboardEvent } from 'react';
import { isValidAllowedDomain, normalizeDomain } from '../lib/domains';
import styles from './DomainInput.module.css';

interface Props {
  id: string;
  value: string[];
  onChange(domains: string[]): void;
  /** Called with a message when the typed text isn't a valid domain, or '' when it is. */
  onError(message: string): void;
  describedBy?: string;
  invalid?: boolean;
}

export const DOMAIN_ERROR =
  'Enter a domain like shop.example.com, localhost:3000 or *.example.com.';

/** "Also allow on" chips: Enter, comma or leaving the field adds; Backspace removes the last. */
export function DomainInput({ id, value, onChange, onError, describedBy, invalid }: Props) {
  const [text, setText] = useState('');

  const commit = (): boolean => {
    const domain = normalizeDomain(text);
    if (!domain) return true;
    if (!isValidAllowedDomain(domain)) {
      onError(DOMAIN_ERROR);
      return false;
    }
    onError('');
    if (!value.includes(domain)) onChange([...value, domain]);
    setText('');
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={styles.box}
      data-invalid={invalid ? 'true' : undefined}
      onClick={() => document.getElementById(id)?.focus()}
    >
      {value.map((domain) => (
        <span key={domain} className={styles.chip}>
          {domain}
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove ${domain}`}
            onClick={() => onChange(value.filter((d) => d !== domain))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        className={styles.input}
        value={text}
        placeholder={value.length ? '' : 'Add domain or wildcard'}
        onChange={(e) => {
          setText(e.target.value);
          if (invalid) onError('');
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
