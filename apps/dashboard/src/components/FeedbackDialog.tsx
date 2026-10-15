import { useId, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../auth/context';
import type { FeedbackKind } from '../data/api';
import { useSendFeedback } from '../data/queries';
import { DOCS_URL } from '../lib/snippet';
import { Button } from './Button';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';
import own from './FeedbackDialog.module.css';

const KINDS: Array<{ id: FeedbackKind; label: string; placeholder: string }> = [
  {
    id: 'help',
    label: 'Ask for help',
    placeholder: 'What are you trying to do, and where are you stuck?',
  },
  {
    id: 'feedback',
    label: 'Share feedback',
    placeholder: 'What would make Splitcraft better for you?',
  },
  {
    id: 'problem',
    label: 'Report a problem',
    placeholder: 'What happened, and what did you expect to happen?',
  },
];

/**
 * Help and feedback, from anywhere in the dashboard (account level). Saved with the
 * account's email, so the reply comes by email, and optionally the page it was sent from.
 */
export function FeedbackDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string | null;
  onClose(): void;
}) {
  const { state } = useAuth();
  const { pathname } = useLocation();
  const send = useSendFeedback();
  const [kind, setKind] = useState<FeedbackKind>('help');
  const [message, setMessage] = useState('');
  const [includePage, setIncludePage] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<'sent' | 'limited' | null>(null);
  const id = useId();
  const error = message.trim() ? '' : 'Write a message first.';
  const email = state.user?.email;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    send.mutate(
      {
        kind,
        message: message.trim(),
        page: includePage ? pathname : null,
        workspaceId,
      },
      { onSuccess: (ok) => setResult(ok ? 'sent' : 'limited') },
    );
  };

  if (result === 'sent') {
    return (
      <Dialog title="Thanks, it's on its way" onClose={onClose}>
        <div className={styles.body}>
          <p className={own.done}>
            {kind === 'feedback'
              ? 'We read every message. If we have a question, we’ll email you.'
              : `We’ll reply to ${email ?? 'your account email'}.`}
          </p>
        </div>
        <div className={styles.foot}>
          <Button onClick={onClose}>Done</Button>
        </div>
      </Dialog>
    );
  }

  const current = KINDS.find((k) => k.id === kind)!;
  return (
    <Dialog
      title="Help and feedback"
      description="Questions, ideas or something broken: tell us here and we'll get back to you by email."
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div className={styles.body}>
          {(send.isError || result === 'limited') && (
            <div role="alert" className={styles.alert}>
              {result === 'limited'
                ? 'You’ve sent a lot of messages this hour. Try again a little later.'
                : `Couldn't send it: ${send.error?.message}`}
            </div>
          )}
          <div className={own.kinds} role="radiogroup" aria-label="What is it about?">
            {KINDS.map((k) => (
              <label key={k.id} className={own.kind}>
                <input
                  type="radio"
                  name={`${id}-kind`}
                  checked={kind === k.id}
                  onChange={() => setKind(k.id)}
                />
                {k.label}
              </label>
            ))}
          </div>
          <div className={styles.field}>
            <label htmlFor={id} className={styles.label}>
              Message
            </label>
            <textarea
              id={id}
              className={`${styles.input} ${own.textarea}`}
              value={message}
              maxLength={4000}
              rows={5}
              placeholder={current.placeholder}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={submitted && Boolean(error)}
              aria-describedby={submitted && error ? `${id}-e` : undefined}
            />
            {submitted && error && (
              <span id={`${id}-e`} className={styles.error}>
                {error}
              </span>
            )}
          </div>
          <label className={own.check}>
            <input
              type="checkbox"
              checked={includePage}
              onChange={(e) => setIncludePage(e.target.checked)}
            />
            <span>
              Include this page (<span className="mono">{pathname}</span>) to help us look into it
            </span>
          </label>
          <p className={own.note}>
            We&apos;ll reply to <b>{email ?? 'your account email'}</b>. Quick answers are often in
            the{' '}
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              documentation
            </a>
            .
          </p>
        </div>
        <div className={styles.foot}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
