import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { Button } from '../components/Button';
import { Logo } from '../components/icons';
import { useWorkspaceMutations } from './queries';
import styles from './NoWorkspace.module.css';

const TOKEN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Shown to a signed-in account that belongs to no workspace: create one or join by invite. */
export function NoWorkspace({ onCreated }: { onCreated(id: string): void }) {
  const { state, api } = useAuth();
  const user = state.user!;
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Logo />
          Splitcraft
        </span>
        <div className={styles.account}>
          <span className={styles.email}>{user.email}</span>
          <button
            type="button"
            className={styles.logout}
            onClick={async () => {
              await api.signOut();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Welcome to Splitcraft</p>
          <h1 className={styles.title}>Set up a workspace to start testing</h1>
          <p className={styles.lede}>
            A workspace holds your projects, experiments and team. Create your own, or join one a
            teammate invited you to.
          </p>
        </div>

        <div className={styles.cards}>
          <CreateCard userId={user.id} onCreated={onCreated} />
          <JoinCard />
        </div>

        <ul className={styles.points} aria-label="What a workspace includes">
          <li>
            <span className={styles.pointTitle}>Projects</span>
            One per site or app, each with its own snippet.
          </li>
          <li>
            <span className={styles.pointTitle}>Team</span>
            Invite teammates as admins or members.
          </li>
          <li>
            <span className={styles.pointTitle}>Free plan</span>
            100,000 events a month, no card needed.
          </li>
        </ul>
      </main>
    </div>
  );
}

function CreateCard({ userId, onCreated }: { userId: string; onCreated(id: string): void }) {
  const { create } = useWorkspaceMutations(userId);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const error = name.trim() ? '' : 'Name the workspace, e.g. your company or a client.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    create.mutate(name.trim(), {
      onSuccess: (workspaceId) => {
        onCreated(workspaceId);
        navigate('/projects');
      },
    });
  };

  return (
    <section className={`${styles.card} ${styles.primary}`} aria-labelledby={`${id}-h`}>
      <span className={styles.step} aria-hidden="true">
        1
      </span>
      <h2 id={`${id}-h`} className={styles.cardTitle}>
        Create a workspace
      </h2>
      <p className={styles.cardText}>You'll be its owner. You can rename it any time.</p>
      <form onSubmit={submit} noValidate className={styles.form}>
        <label htmlFor={id} className={styles.label}>
          Workspace name
        </label>
        <input
          id={id}
          className={styles.input}
          value={name}
          maxLength={100}
          placeholder="e.g. Acme Inc."
          autoComplete="organization"
          onChange={(e) => setName(e.target.value)}
          aria-invalid={submitted && Boolean(error)}
          aria-describedby={submitted && error ? `${id}-e` : undefined}
        />
        {submitted && error && (
          <span id={`${id}-e`} className={styles.error}>
            {error}
          </span>
        )}
        {create.isError && (
          <span role="alert" className={styles.error}>
            Couldn't create the workspace: {create.error.message}
          </span>
        )}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create workspace'}
        </Button>
      </form>
    </section>
  );
}

function JoinCard() {
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const id = useId();
  const token = link.match(TOKEN)?.[0];
  const error = token ? '' : 'Paste the whole invite link your teammate sent.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (token) navigate(`/invite/${token.toLowerCase()}`);
  };

  return (
    <section className={styles.card} aria-labelledby={`${id}-h`}>
      <span className={styles.step} aria-hidden="true">
        2
      </span>
      <h2 id={`${id}-h`} className={styles.cardTitle}>
        Join with an invite
      </h2>
      <p className={styles.cardText}>Invites work for the email address they were sent to.</p>
      <form onSubmit={submit} noValidate className={styles.form}>
        <label htmlFor={id} className={styles.label}>
          Invite link
        </label>
        <input
          id={id}
          className={styles.input}
          value={link}
          placeholder="https://…/invite/…"
          autoComplete="off"
          onChange={(e) => setLink(e.target.value)}
          aria-invalid={submitted && Boolean(error)}
          aria-describedby={submitted && error ? `${id}-e` : undefined}
        />
        {submitted && error && (
          <span id={`${id}-e`} className={styles.error}>
            {error}
          </span>
        )}
        <Button type="submit" variant="secondary">
          Open invite
        </Button>
      </form>
    </section>
  );
}
