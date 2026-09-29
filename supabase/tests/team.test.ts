import { as, createDb, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-00000000f001';
const ADMIN = '00000000-0000-0000-0000-00000000f002';
const NEWBIE = '00000000-0000-0000-0000-00000000f003';
const OTHER = '00000000-0000-0000-0000-00000000f004';
const owner = { role: 'authenticated', userId: OWNER } as const;
const admin = { role: 'authenticated', userId: ADMIN } as const;
const newbie = { role: 'authenticated', userId: NEWBIE } as const;
const other = { role: 'authenticated', userId: OTHER } as const;

let db: Db;
let ws: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function invite(
  by: typeof owner | typeof admin,
  email: string,
  role = 'member',
): Promise<string> {
  const [r] = await as(db, by, () =>
    q<{ token: string }>(
      `insert into workspace_invites (workspace_id, email, role) values ($1, $2, $3) returning token`,
      [ws, email, role],
    ),
  );
  return r!.token;
}

beforeAll(async () => {
  db = await createDb();
  await q(
    `insert into auth.users (id, email, raw_user_meta_data) values
    ($1, 'owner@team.dev', '{"full_name":"Olive Owner"}'),
    ($2, 'admin@team.dev', '{"full_name":"Ada Admin"}'),
    ($3, 'new@team.dev', null),
    ($4, 'other@team.dev', null)`,
    [OWNER, ADMIN, NEWBIE, OTHER],
  );
  [{ id: ws }] = (await as(db, owner, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Team') returning id`),
  )) as [{ id: string }];
  await as(db, owner, () =>
    q(`insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'admin')`, [
      ws,
      ADMIN,
    ]),
  );
});

afterAll(async () => {
  await db.close();
});

describe('workspace_people', () => {
  it('lists members with email, name and role, owners first', async () => {
    const people = await as(db, admin, () =>
      q<{ email: string; full_name: string | null; role: string }>(
        'select email, full_name, role from workspace_people($1)',
        [ws],
      ),
    );
    expect(people).toEqual([
      { email: 'owner@team.dev', full_name: 'Olive Owner', role: 'owner' },
      { email: 'admin@team.dev', full_name: 'Ada Admin', role: 'admin' },
    ]);
  });

  it('shows nothing to someone outside the workspace', async () => {
    expect(await as(db, other, () => q('select * from workspace_people($1)', [ws]))).toEqual([]);
  });
});

describe('invites', () => {
  it('lets an admin invite, and the invited email accept', async () => {
    const token = await invite(admin, 'new@team.dev');
    const [details] = await as(db, newbie, () => q('select * from invite_details($1)', [token]));
    expect(details).toEqual({
      workspace_name: 'Team',
      email: 'new@team.dev',
      role: 'member',
      expired: false,
      accepted: false,
    });

    const [joined] = await as(db, newbie, () =>
      q<{ id: string }>('select accept_invite($1) as id', [token]),
    );
    expect(joined!.id).toBe(ws);
    expect(
      await as(db, newbie, () =>
        q('select role from workspace_members where workspace_id = $1 and user_id = $2', [
          ws,
          NEWBIE,
        ]),
      ),
    ).toEqual([{ role: 'member' }]);
    await expect(as(db, newbie, () => q('select accept_invite($1)', [token]))).rejects.toThrow(
      'already been used',
    );
  });

  it('refuses another account, expired links and unknown tokens', async () => {
    const token = await invite(owner, 'someone@team.dev');
    await expect(as(db, other, () => q('select accept_invite($1)', [token]))).rejects.toThrow(
      'This invite is for someone@team.dev',
    );
    await q(`update workspace_invites set expires_at = now() - interval '1 day' where token = $1`, [
      token,
    ]);
    await expect(as(db, other, () => q('select accept_invite($1)', [token]))).rejects.toThrow(
      'expired',
    );
    await expect(
      as(db, other, () => q('select accept_invite($1)', ['00000000-0000-0000-0000-000000000000'])),
    ).rejects.toThrow('not valid');
  });

  it('does not let members invite or see invites', async () => {
    await expect(invite(newbie as never, 'x@team.dev')).rejects.toThrow(/row-level security/);
    expect(await as(db, newbie, () => q('select * from workspace_invites'))).toEqual([]);
  });

  it('does not let anyone invite as owner', async () => {
    await expect(invite(owner, 'boss@team.dev', 'owner')).rejects.toThrow(/check/);
  });
});

describe('owner rules', () => {
  it('does not let an admin make someone an owner', async () => {
    await expect(
      as(db, admin, () =>
        q(`update workspace_members set role = 'owner' where workspace_id = $1 and user_id = $2`, [
          ws,
          NEWBIE,
        ]),
      ),
    ).rejects.toThrow('Only an owner');
  });

  it('does not let an admin remove the owner', async () => {
    await expect(
      as(db, admin, () =>
        q(`delete from workspace_members where workspace_id = $1 and user_id = $2`, [ws, OWNER]),
      ),
    ).rejects.toThrow('Only an owner');
  });

  it('keeps at least one owner', async () => {
    await expect(
      as(db, owner, () =>
        q(`update workspace_members set role = 'admin' where workspace_id = $1 and user_id = $2`, [
          ws,
          OWNER,
        ]),
      ),
    ).rejects.toThrow('at least one owner');
    await expect(
      as(db, owner, () =>
        q(`delete from workspace_members where workspace_id = $1 and user_id = $2`, [ws, OWNER]),
      ),
    ).rejects.toThrow('at least one owner');
  });

  it('lets an owner promote someone, then step down or leave', async () => {
    await as(db, owner, () =>
      q(`update workspace_members set role = 'owner' where workspace_id = $1 and user_id = $2`, [
        ws,
        ADMIN,
      ]),
    );
    await as(db, owner, () =>
      q(`delete from workspace_members where workspace_id = $1 and user_id = $2`, [ws, OWNER]),
    );
    const roles = await as(db, admin, () =>
      q<{ role: string }>('select role from workspace_people($1)', [ws]),
    );
    expect(roles.map((r) => r.role)).toEqual(['owner', 'member']);
  });

  it('still lets an owner delete the whole workspace', async () => {
    await as(db, admin, () => q('delete from workspaces where id = $1', [ws]));
    expect(await as(db, admin, () => q('select id from workspaces where id = $1', [ws]))).toEqual(
      [],
    );
  });
});
