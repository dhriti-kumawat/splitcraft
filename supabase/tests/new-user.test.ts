import { as, createDb, type Db } from './db';

let db: Db;

beforeAll(async () => {
  db = await createDb();
});

afterAll(async () => {
  await db.close();
});

async function signUp(id: string, email: string, meta: Record<string, unknown> | null) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    email,
    meta && JSON.stringify(meta),
  ]);
  return as(db, { role: 'authenticated', userId: id }, async () => {
    const workspaces = (await db.query<{ name: string }>('select name from workspaces')).rows;
    const members = (await db.query<{ role: string }>('select role from workspace_members')).rows;
    return { workspaces, members };
  });
}

describe('new user', () => {
  it('gets no workspace until they set one up', async () => {
    const result = await signUp('00000000-0000-0000-0000-000000000001', 'jo@acme.co.uk', {
      full_name: 'Jo Smith',
    });
    expect(result).toEqual({ workspaces: [], members: [] });
  });

  it('can create their first workspace and owns it', async () => {
    const id = '00000000-0000-0000-0000-000000000002';
    await signUp(id, 'sam@gmail.com', null);
    const rows = await as(db, { role: 'authenticated', userId: id }, async () => {
      await db.query(`insert into workspaces (name) values ('Sam Studio')`);
      return (
        await db.query<{ name: string; role: string }>(
          'select w.name, m.role from workspaces w join workspace_members m on m.workspace_id = w.id',
        )
      ).rows;
    });
    expect(rows).toEqual([{ name: 'Sam Studio', role: 'owner' }]);
  });
});

describe('default_workspace_name', () => {
  it('still names workspaces after a work domain, for anything that uses it', async () => {
    const name = async (email: string) =>
      (await db.query<{ n: string }>('select public.default_workspace_name($1) as n', [email]))
        .rows[0]!.n;
    expect(await name('jo@acme.co.uk')).toBe('Acme');
    expect(await name('sam@gmail.com')).toBe('My workspace');
  });
});

describe('backfill', () => {
  it('gives accounts created before the migration a workspace', async () => {
    const fresh = await (await import('@electric-sql/pglite')).PGlite.create();
    // Apply everything up to the new-user migration, add an account, then apply it.
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../migrations/', import.meta.url);
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const stub = (await import('./db')).SUPABASE_STUB;
    await fresh.exec(stub);
    for (const f of files.filter((f) => f < '20260929130000')) {
      await fresh.exec(readFileSync(new URL(f, dir), 'utf8'));
    }
    await fresh.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'early@example.com', '{"full_name":"Early Bird"}')`,
      ['00000000-0000-0000-0000-00000000e001'],
    );
    await fresh.exec(readFileSync(new URL('20260929130000_new_user_workspace.sql', dir), 'utf8'));
    const rows = (
      await fresh.query<{ name: string; role: string }>(
        `select w.name, m.role from workspaces w join workspace_members m on m.workspace_id = w.id`,
      )
    ).rows;
    expect(rows).toEqual([{ name: "Early's Workspace", role: 'owner' }]);
    await fresh.close();
  });
});
