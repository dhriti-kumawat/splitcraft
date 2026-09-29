import { as, createDb, createUser, type Db } from './db';

const ALICE = '00000000-0000-0000-0000-00000000a11c';
const BOB = '00000000-0000-0000-0000-000000000b0b';
const CAROL = '00000000-0000-0000-0000-0000000ca201';

let db: Db;
let aliceWs: string;
let aliceProject: string;
let aliceExperiment: string;

const alice = { role: 'authenticated', userId: ALICE } as const;
const bob = { role: 'authenticated', userId: BOB } as const;
const carol = { role: 'authenticated', userId: CAROL } as const;
const anon = { role: 'anon' } as const;
const service = { role: 'service_role' } as const;

// Typed as non-empty so tests can destructure the first row; an empty result makes the
// destructuring throw, which fails the test just as clearly.
async function rows<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<[T, ...T[]]> {
  return (await db.query<T>(sql, params)).rows as [T, ...T[]];
}

beforeAll(async () => {
  db = await createDb();
  await createUser(db, ALICE);
  await createUser(db, BOB);
  await createUser(db, CAROL);

  // Alice creates a workspace, a project, an experiment with a variant, and receives events.
  await as(db, alice, async () => {
    [{ id: aliceWs }] = await rows<{ id: string }>(
      `insert into workspaces (name) values ('Northwind Travel') returning id`,
    );
    [{ id: aliceProject }] = await rows<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'Trip Demo', 'mytrips.dev') returning id`,
      [aliceWs],
    );
    [{ id: aliceExperiment }] = await rows<{ id: string }>(
      `insert into experiments (project_id, key, name) values ($1, 'trust', 'Trust badges') returning id`,
      [aliceProject],
    );
    await rows(`insert into variants (experiment_id, key, name, js) values ($1, 'b', 'B', 'v1')`, [
      aliceExperiment,
    ]);
  });
  await as(db, service, () =>
    rows(`insert into events (project_id, visitor_id, type) values ($1, 'v_1', 'ping')`, [
      aliceProject,
    ]),
  );
  // Bob has his own workspace.
  await as(db, bob, () => rows(`insert into workspaces (name) values ('Bob''s Workspace')`));
});

afterAll(async () => {
  await db.close();
});

describe('workspaces', () => {
  it('makes the creator the owner', async () => {
    const members = await as(db, alice, () =>
      rows('select user_id, role from workspace_members where workspace_id = $1', [aliceWs]),
    );
    expect(members).toEqual([{ user_id: ALICE, role: 'owner' }]);
  });

  it('shows users only the workspaces they belong to', async () => {
    const names = (
      await as(db, bob, () => rows<{ name: string }>('select name from workspaces order by name'))
    ).map((r) => r.name);
    // The workspace Bob created plus the one made for him at sign-up; never Alice's.
    expect(names).toEqual(["Bob's Workspace", 'My workspace']);
  });

  it('does not let a non-member rename or delete a workspace', async () => {
    await as(db, bob, async () => {
      await rows(`update workspaces set name = 'hacked' where id = $1`, [aliceWs]);
      await rows(`delete from workspaces where id = $1`, [aliceWs]);
    });
    const [ws] = await as(db, alice, () =>
      rows('select name from workspaces where id = $1', [aliceWs]),
    );
    expect(ws).toEqual({ name: 'Northwind Travel' });
  });

  it('does not let a user add themselves to someone else’s workspace', async () => {
    await expect(
      as(db, bob, () =>
        rows(
          `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')`,
          [aliceWs, BOB],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('members', () => {
  it('lets an owner invite a member who then sees the project', async () => {
    await as(db, alice, () =>
      rows(
        `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')`,
        [aliceWs, CAROL],
      ),
    );
    const projects = await as(db, carol, () => rows('select name from projects'));
    expect(projects).toEqual([{ name: 'Trip Demo' }]);
  });

  it('does not let a plain member change roles', async () => {
    // Carol owns her own sign-up workspace; check the one she was invited to.
    await as(db, carol, () =>
      rows(`update workspace_members set role = 'owner' where user_id = $1 and workspace_id = $2`, [
        CAROL,
        aliceWs,
      ]),
    );
    const [me] = await as(db, carol, () =>
      rows('select role from workspace_members where user_id = $1 and workspace_id = $2', [
        CAROL,
        aliceWs,
      ]),
    );
    expect(me).toEqual({ role: 'member' });
  });
});

describe('project data', () => {
  it('hides every project-scoped table from other workspaces', async () => {
    await as(db, bob, async () => {
      for (const table of [
        'projects',
        'experiments',
        'variants',
        'variant_versions',
        'segments',
        'triggers',
        'page_sets',
        'metrics',
        'experiment_metrics',
        'events',
      ]) {
        expect(await rows(`select * from ${table}`), table).toEqual([]);
      }
    });
  });

  it('does not let another workspace create data in this project', async () => {
    await expect(
      as(db, bob, () =>
        rows(`insert into experiments (project_id, key, name) values ($1, 'evil', 'Evil')`, [
          aliceProject,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(db, bob, () =>
        rows(`insert into variants (experiment_id, key, name) values ($1, 'x', 'X')`, [
          aliceExperiment,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('does not let a member move a project into a workspace they are not in', async () => {
    const [{ id: bobWs }] = await as(db, bob, () =>
      rows<{ id: string }>('select id from workspaces'),
    );
    await expect(
      as(db, alice, () =>
        rows('update projects set workspace_id = $1 where id = $2', [bobWs, aliceProject]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('gives each project a unique public key', async () => {
    const [p] = await as(db, alice, () =>
      rows<{ public_key: string }>('select public_key from projects where id = $1', [aliceProject]),
    );
    expect(p!.public_key).toMatch(/^prj_[0-9a-f]{32}$/);
  });
});

describe('variant history', () => {
  it('saves the previous code as a version and bumps the version number', async () => {
    await as(db, alice, () =>
      rows(`update variants set js = 'v2' where experiment_id = $1 and key = 'b'`, [
        aliceExperiment,
      ]),
    );
    const [variant] = await as(db, alice, () =>
      rows<{ js: string; version: number }>(
        'select js, version from variants where experiment_id = $1',
        [aliceExperiment],
      ),
    );
    expect(variant).toEqual({ js: 'v2', version: 2 });
    const versions = await as(db, alice, () => rows('select js from variant_versions'));
    expect(versions).toEqual([{ js: 'v1' }]);
  });

  it('does not let users write history directly', async () => {
    const [{ id }] = await as(db, alice, () => rows<{ id: string }>('select id from variants'));
    await expect(
      as(db, alice, () =>
        rows(`insert into variant_versions (variant_id, js, css) values ($1, 'fake', '')`, [id]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('events', () => {
  it('lets members read their project events', async () => {
    const events = await as(db, alice, () => rows('select type from events'));
    expect(events).toEqual([{ type: 'ping' }]);
  });

  it('does not let dashboard users write events', async () => {
    await expect(
      as(db, alice, () =>
        rows(`insert into events (project_id, visitor_id, type) values ($1, 'v_fake', 'goal')`, [
          aliceProject,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('anon', () => {
  it('has no access to any table', async () => {
    for (const table of ['workspaces', 'projects', 'experiments', 'variants', 'events']) {
      await expect(
        as(db, anon, () => rows(`select * from ${table}`)),
        table,
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      as(db, anon, () =>
        rows(`insert into events (project_id, visitor_id, type) values ($1, 'v_x', 'goal')`, [
          aliceProject,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
