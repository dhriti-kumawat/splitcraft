import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { Logo } from '../../components/icons';
import { useData } from '../../data/context';
import { keys, useInviteQuery } from '../../data/queries';
import styles from '../auth/AuthPage.module.css';

const WORKSPACE_KEY = 'splitly_workspace';

/** /invite/:token — join a workspace from an invite link. */
export function InvitePage() {
  const { token = '' } = useParams();
  const { state, api: auth } = useAuth();
  const api = useData();
  const client = useQueryClient();
  const navigate = useNavigate();
  const invite = useInviteQuery(token);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const email = state.user?.email ?? '';

  const accept = async () => {
    setJoining(true);
    setError('');
    try {
      const workspaceId = await api.acceptInvite(token);
      try {
        localStorage.setItem(WORKSPACE_KEY, workspaceId);
      } catch {
        // The workspace switcher still lists it.
      }
      await client.invalidateQueries({ queryKey: keys.workspaces(state.user!.id) });
      navigate('/projects', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join the workspace.');
      setJoining(false);
    }
  };

  let body;
  if (invite.isPending) {
    body = <p aria-busy="true">Checking the invite…</p>;
  } else if (invite.isError || !invite.data) {
    body = (
      <Message
        title="This invite link isn't valid"
        text="Check that you copied the whole link, or ask for a new invite."
      />
    );
  } else if (invite.data.accepted) {
    body = (
      <Message
        title="This invite has already been used"
        text="If that was you, the workspace is in your workspace switcher."
      />
    );
  } else if (invite.data.expired) {
    body = (
      <Message title="This invite has expired" text="Invites work for 7 days. Ask for a new one." />
    );
  } else if (invite.data.email.toLowerCase() !== email.toLowerCase()) {
    body = (
      <div className={styles.stack}>
        <div className={styles.intro}>
          <h1 className={styles.title}>This invite is for {invite.data.email}</h1>
          <p className={styles.subtitle}>
            You're logged in as <b>{email}</b>. Log in with the invited address to join{' '}
            {invite.data.workspaceName}.
          </p>
        </div>
        <button
          type="button"
          className={styles.cta}
          onClick={async () => {
            await auth.signOut();
            navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
          }}
        >
          Use a different account
        </button>
      </div>
    );
  } else {
    body = (
      <div className={styles.stack}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Join {invite.data.workspaceName}</h1>
          <p className={styles.subtitle}>
            You've been invited as <b>{invite.data.role}</b>. You'll see its projects and
            experiments in your workspace switcher.
          </p>
        </div>
        {error && (
          <div role="alert" className={styles.alert}>
            <span>{error}</span>
          </div>
        )}
        <button
          type="button"
          className={styles.cta}
          onClick={accept}
          disabled={joining}
          aria-busy={joining}
        >
          {joining && <span className={styles.spinner} aria-hidden="true" />}
          {joining ? 'Joining…' : `Join ${invite.data.workspaceName}`}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/projects" className={styles.brand}>
          <Logo size={28} />
          Splitly
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>{body}</div>
      </main>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.stack}>
      <div className={styles.intro}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{text}</p>
      </div>
      <Link to="/projects" className={styles.cta}>
        Go to Splitly
      </Link>
    </div>
  );
}
