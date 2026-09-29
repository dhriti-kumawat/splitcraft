import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import dialogStyles from '../../components/Dialog.module.css';
import { PageHeader } from '../../components/PageHeader';
import type { Invite, Person, Role } from '../../data/api';
import { useInvitesQuery, usePeopleQuery, useTeamMutations } from '../../data/queries';
import { useWorkspace } from '../../data/workspace';
import { inviteLink } from '../../lib/invites';
import styles from './TeamPage.module.css';

const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Workspace › Team: members, roles and invites. */
export function TeamPage() {
  const { workspace, user } = useWorkspace();
  const canManage = user.role === 'owner' || user.role === 'admin';
  const people = usePeopleQuery(workspace.id);
  const invites = useInvitesQuery(workspace.id, canManage);
  const team = useTeamMutations(workspace.id);
  const [leaving, setLeaving] = useState(false);
  const failed = team.setRole.error ?? team.remove.error ?? team.revoke.error;

  const canEdit = (p: Person) =>
    canManage && p.userId !== user.id && (p.role !== 'owner' || user.role === 'owner');

  return (
    <>
      <PageHeader
        title="Team"
        description={`People in ${workspace.name}. Everyone here can see and edit its projects.`}
      />
      <div className={styles.page}>
        {failed && (
          <div role="alert" className={styles.alert}>
            {failed.message}
          </div>
        )}
        <section className={styles.section} aria-labelledby="members-h">
          <h2 className={styles.title} id="members-h">
            Members {people.data && <span className={styles.muted}>· {people.data.length}</span>}
          </h2>
          {people.isPending ? (
            <p className={styles.sub} aria-busy="true">
              Loading members…
            </p>
          ) : people.isError ? (
            <p role="alert" className={styles.error}>
              Couldn't load members: {people.error.message}
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.data.map((p) => (
                  <tr key={p.userId}>
                    <td>
                      <div className={styles.person}>
                        <span className={styles.name}>
                          {p.name ?? p.email.split('@')[0]}
                          {p.userId === user.id && <span className={styles.you}>You</span>}
                        </span>
                        <span className={styles.email}>{p.email}</span>
                      </div>
                    </td>
                    <td>
                      {canEdit(p) ? (
                        <select
                          className={styles.select}
                          aria-label={`Role for ${p.email}`}
                          value={p.role}
                          onChange={(e) =>
                            team.setRole.mutate({ userId: p.userId, role: e.target.value as Role })
                          }
                        >
                          {user.role === 'owner' && <option value="owner">Owner</option>}
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span className={styles.role}>{p.role}</span>
                      )}
                    </td>
                    <td className={styles.muted}>{date.format(new Date(p.joinedAt))}</td>
                    <td style={{ textAlign: 'right' }}>
                      {p.userId === user.id ? (
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => setLeaving(true)}
                        >
                          Leave
                        </button>
                      ) : (
                        canEdit(p) && (
                          <button
                            type="button"
                            className={styles.remove}
                            aria-label={`Remove ${p.email}`}
                            onClick={() => team.remove.mutate(p.userId)}
                          >
                            Remove
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={styles.sub}>
            Owners manage everything, including other owners. Admins invite and remove members and
            delete projects. Members build and run experiments.
          </p>
        </section>

        {canManage && <Invites invites={invites.data ?? []} team={team} />}
      </div>
      {leaving && <LeaveDialog onClose={() => setLeaving(false)} />}
    </>
  );
}

function Invites({
  invites,
  team,
}: {
  invites: Invite[];
  team: ReturnType<typeof useTeamMutations>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Invite['role']>('member');
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<Invite | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Fixed at mount so render stays pure.
  const [now] = useState(() => Date.now());
  const ids = { email: useId(), role: useId() };
  const error = EMAIL.test(email.trim()) ? '' : 'Enter the email address they will log in with.';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    team.invite.mutate(
      { email: email.trim().toLowerCase(), role },
      {
        onSuccess: (invite) => {
          setCreated(invite);
          setEmail('');
          setSubmitted(false);
        },
      },
    );
  };

  const copy = async (invite: Invite) => {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.token));
      setCopied(invite.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="invite-h">
      <div>
        <h2 className={styles.title} id="invite-h">
          Invite people
        </h2>
        <p className={styles.sub}>
          Splitly creates a link for them; it doesn't send emails yet. The link works for that email
          address only, once, for 7 days.
        </p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor={ids.email} className={styles.label}>
            Email
          </label>
          <input
            id={ids.email}
            className={styles.input}
            type="email"
            value={email}
            placeholder="teammate@company.com"
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={submitted && Boolean(error)}
            aria-describedby={submitted && error ? `${ids.email}-e` : undefined}
          />
          {submitted && error && (
            <span id={`${ids.email}-e`} className={styles.error}>
              {error}
            </span>
          )}
        </div>
        <div className={styles.field} style={{ flex: '0 0 auto' }}>
          <label htmlFor={ids.role} className={styles.label}>
            Role
          </label>
          <select
            id={ids.role}
            className={styles.select}
            value={role}
            onChange={(e) => setRole(e.target.value as Invite['role'])}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className={styles.field} style={{ flex: '0 0 auto' }}>
          <span className={styles.label} aria-hidden="true">
            &nbsp;
          </span>
          <Button type="submit" disabled={team.invite.isPending}>
            Create invite link
          </Button>
        </div>
      </form>
      {team.invite.isError && (
        <p role="alert" className={styles.error}>
          Couldn't create the invite: {team.invite.error.message}
        </p>
      )}
      {created && (
        <div className={styles.linkBox} role="status">
          <span>
            Link for <strong>{created.email}</strong>:
          </span>
          <span className={styles.linkText}>{inviteLink(created.token)}</span>
          <Button variant="secondary" onClick={() => copy(created)}>
            {copied === created.id ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}
      {invites.length > 0 && (
        <table className={styles.table}>
          <caption className="visually-hidden">Pending invites</caption>
          <thead>
            <tr>
              <th scope="col">Pending invite</th>
              <th scope="col">Role</th>
              <th scope="col">Expires</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => {
              const expired = Date.parse(i.expiresAt) < now;
              return (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td className={styles.role}>{i.role}</td>
                  <td className={styles.muted}>
                    {expired ? 'Expired' : date.format(new Date(i.expiresAt))}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!expired && (
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => copy(i)}
                        aria-label={`Copy invite link for ${i.email}`}
                      >
                        {copied === i.id ? 'Copied' : 'Copy link'}
                      </button>
                    )}{' '}
                    <button
                      type="button"
                      className={styles.remove}
                      style={{ marginLeft: 12 }}
                      onClick={() => team.revoke.mutate(i.id)}
                      aria-label={`Revoke invite for ${i.email}`}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function LeaveDialog({ onClose }: { onClose(): void }) {
  const { workspace, user, workspaces, selectWorkspace } = useWorkspace();
  const team = useTeamMutations(workspace.id);
  const navigate = useNavigate();
  return (
    <Dialog
      title={`Leave ${workspace.name}?`}
      description="You lose access to its projects until someone invites you again."
      onClose={onClose}
    >
      {team.remove.isError && (
        <div className={dialogStyles.body}>
          <div role="alert" className={dialogStyles.alert}>
            {team.remove.error.message}
          </div>
        </div>
      )}
      <div className={dialogStyles.foot}>
        <Button variant="secondary" onClick={onClose}>
          Stay
        </Button>
        <Button
          onClick={() =>
            team.remove.mutate(user.id, {
              onSuccess: () => {
                const next = workspaces.find((w) => w.id !== workspace.id);
                if (next) selectWorkspace(next.id);
                navigate('/projects', { replace: true });
              },
            })
          }
        >
          Leave workspace
        </Button>
      </div>
    </Dialog>
  );
}
