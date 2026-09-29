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
  it('gets a workspace named after their first name, as owner', async () => {
    const result = await signUp('00000000-0000-0000-0000-000000000001', 'dhriti@example.com', {
      full_name: 'Dhriti Kumawat',
    });
    expect(result.workspaces).toEqual([{ name: "Dhriti's Workspace" }]);
    expect(result.members).toEqual([{ role: 'owner' }]);
  });

  it('falls back to the email name without a full name', async () => {
    const result = await signUp('00000000-0000-0000-0000-000000000002', 'sam@example.com', null);
    expect(result.workspaces).toEqual([{ name: "sam's Workspace" }]);
  });

  it('only sees their own new workspace', async () => {
    const result = await signUp('00000000-0000-0000-0000-000000000003', 'alex@example.com', {
      full_name: '  Alex  ',
    });
    expect(result.workspaces).toEqual([{ name: "Alex's Workspace" }]);
  });
});
