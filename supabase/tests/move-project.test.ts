import { as, createDb, type Db } from './db';

const ANA = '00000000-0000-0000-0000-0000000a0001';
const BEN = '00000000-0000-0000-0000-0000000a0002';
const CY = '00000000-0000-0000-0000-0000000a0003';
const ana = { role: 'authenticated', userId: ANA } as const;
const ben = { role: 'authenticated', userId: BEN } as const;
const cy = { role: 'authenticated', userId: CY } as const;

let db: Db;
let acme: string; // Ana owns it; Ben is an admin, Cy a member.
let bens: string; // Ben's own workspace.
let cys: string; // Cy's own workspace.
let project: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
const workspaceOf = async () =>
  (
    await q<{ workspace_id: string }>('select workspace_id from projects where id = $1', [project])
  )[0]!.workspace_id;

beforeAll(async () => {
  db = await createDb();
  await q(`insert into auth.users (id) values ($1), ($2), ($3)`, [ANA, BEN, CY]);
  [{ id: acme }] = (await as(db, ana, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Acme Inc.') returning id`),
  )) as [{ id: string }];
  [{ id: bens }] = (await as(db, ben, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Ben''s projects') returning id`),
  )) as [{ id: string }];
  [{ id: cys }] = (await as(db, cy, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Cy''s projects') returning id`),
  )) as [{ id: string }];
  await q(
    `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')`,
    [acme, BEN, CY],
  );
});

beforeEach(async () => {
  [{ id: project }] = (await as(db, ben, () =>
    q<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'Ben''s blog', 'ben.dev') returning id`,
      [acme],
    ),
  )) as [{ id: string }];
  await as(db, ben, () =>
    q(`insert into experiments (project_id, key, name) values ($1, 'hero', 'Hero')`, [project]),
  );
});

afterAll(async () => {
  await db.close();
});

describe('move_project', () => {
  it('moves a project and everything in it when the caller runs both workspaces', async () => {
    const [{ public_key: before }] = (await q<{ public_key: string }>(
      'select public_key from projects where id = $1',
      [project],
    )) as [{ public_key: string }];
    await as(db, ben, () => q('select move_project($1, $2)', [project, bens]));
    expect(await workspaceOf()).toBe(bens);
    // Same snippet key; the experiment came along; Acme's owner no longer sees it.
    const [{ public_key: after }] = (await q<{ public_key: string }>(
      'select public_key from projects where id = $1',
      [project],
    )) as [{ public_key: string }];
    expect(after).toBe(before);
    expect(
      await as(db, ben, () => q('select 1 from experiments where project_id = $1', [project])),
    ).toHaveLength(1);
    expect(await as(db, ana, () => q('select 1 from projects where id = $1', [project]))).toEqual(
      [],
    );
  });

  it('refuses members, outsiders, and workspaces the caller doesn’t run', async () => {
    // Cy is only a member of Acme.
    await expect(
      as(db, cy, () => q('select move_project($1, $2)', [project, cys])),
    ).rejects.toThrow(/Only owners and admins/);
    // Ana owns Acme but has no say in Ben's workspace.
    await expect(
      as(db, ana, () => q('select move_project($1, $2)', [project, bens])),
    ).rejects.toThrow(/owner or admin of the workspace you move it to/);
    await expect(
      as(db, ben, () => q('select move_project($1, $2)', [project, acme])),
    ).rejects.toThrow(/already in that workspace/);
    expect(await workspaceOf()).toBe(acme);
  });

  it('is the only way to change a project’s workspace', async () => {
    // A member could update the row directly before; now the trigger stops it.
    await expect(
      as(db, cy, () => q('update projects set workspace_id = $1 where id = $2', [cys, project])),
    ).rejects.toThrow(/Move to another workspace/);
    await expect(
      as(db, ben, () => q('update projects set workspace_id = $1 where id = $2', [bens, project])),
    ).rejects.toThrow(/Move to another workspace/);
    // Other edits still work.
    await as(db, cy, () => q(`update projects set name = 'Blog' where id = $1`, [project]));
    expect(await workspaceOf()).toBe(acme);
  });

  it('is not callable without logging in', async () => {
    await expect(
      as(db, { role: 'anon' }, () => q('select move_project($1, $2)', [project, bens])),
    ).rejects.toThrow(/permission denied/);
  });
});
