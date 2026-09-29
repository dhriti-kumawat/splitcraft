import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000c1';
const OUTSIDER = '00000000-0000-0000-0000-0000000000c2';
const owner = { role: 'authenticated', userId: OWNER } as const;
const outsider = { role: 'authenticated', userId: OUTSIDER } as const;

let db: Db;
let ws: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

const activity = (who: typeof owner | typeof outsider, limit = 8) =>
  as(db, who, () =>
    q<{ kind: string; project_name: string; subject: string }>(
      'select kind, project_name, subject from public.workspace_activity($1, $2)',
      [ws, limit],
    ),
  );

beforeAll(async () => {
  db = await createDb();
  for (const id of [OWNER, OUTSIDER]) await createUser(db, id);
  [{ id: ws }] = (await as(db, owner, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Team') returning id`),
  )) as [{ id: string }];
  const [{ id: project }] = (await as(db, owner, () =>
    q<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain, created_at, installed_at)
       values ($1, 'Trip Demo', 'trip.dev', now() - interval '5 days', now() - interval '4 days') returning id`,
      [ws],
    ),
  )) as [{ id: string }];
  await as(db, owner, () =>
    q(
      `insert into experiments (project_id, key, name, status, created_at, started_at)
       values ($1, 'sticky', 'Sticky bar', 'live', now() - interval '3 days', now() - interval '2 days')`,
      [project],
    ),
  );
  await as(db, owner, () =>
    q(
      `insert into segments (project_id, name, created_at, updated_at)
       values ($1, 'Returners', now() - interval '3 hours', now() - interval '1 hour')`,
      [project],
    ),
  );
});

afterAll(async () => {
  await db.close();
});

describe('workspace_activity', () => {
  it('lists the latest changes first, with the project name', async () => {
    expect(await activity(owner)).toEqual([
      { kind: 'segment_updated', project_name: 'Trip Demo', subject: 'Returners' },
      { kind: 'experiment_launched', project_name: 'Trip Demo', subject: 'Sticky bar' },
      { kind: 'experiment_created', project_name: 'Trip Demo', subject: 'Sticky bar' },
      { kind: 'project_installed', project_name: 'Trip Demo', subject: 'Trip Demo' },
      { kind: 'project_created', project_name: 'Trip Demo', subject: 'Trip Demo' },
    ]);
  });

  it('respects the limit', async () => {
    expect(await activity(owner, 2)).toHaveLength(2);
  });

  it('shows nothing to someone outside the workspace', async () => {
    expect(await activity(outsider)).toEqual([]);
  });
});
