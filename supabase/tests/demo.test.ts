import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000d7';
const OUTSIDER = '00000000-0000-0000-0000-0000000000d8';
const owner = { role: 'authenticated', userId: OWNER } as const;
const outsider = { role: 'authenticated', userId: OUTSIDER } as const;

let db: Db;
let ws: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createDb();
  for (const id of [OWNER, OUTSIDER]) await createUser(db, id);
  [{ id: ws }] = (await as(db, owner, () => q<{ id: string }>('select id from workspaces'))) as [
    { id: string },
  ];
});

afterAll(async () => {
  await db.close();
});

describe('create_demo_project', () => {
  it('creates a demo project with experiments and results', async () => {
    const [demo] = await as(db, owner, () =>
      q<{ demo_project_id: string; demo_experiment_id: string }>(
        'select * from create_demo_project($1)',
        [ws],
      ),
    );
    const [project] = await as(db, owner, () =>
      q('select name, demo, installed_at is not null as installed from projects where id = $1', [
        demo!.demo_project_id,
      ]),
    );
    expect(project).toEqual({ name: 'Demo: Trip Shop', demo: true, installed: true });

    const experiments = await as(db, owner, () =>
      q<{ status: string }>(
        'select status from experiments where project_id = $1 order by status',
        [demo!.demo_project_id],
      ),
    );
    expect(experiments.map((e) => e.status)).toEqual(['draft', 'ended', 'live']);

    const results = await as(db, owner, () =>
      q<{ variant_key: string; visitors: number; converters: number }>(
        `select r.variant_key, r.visitors, r.converters
         from experiment_results($1) r join experiments e on e.primary_metric_id = r.metric_id and e.id = $1
         order by r.variant_key`,
        [demo!.demo_experiment_id],
      ),
    );
    expect(results.map((r) => r.visitors)).toEqual([2000, 2000]);
    const [b, control] = results;
    expect(b!.converters).toBeGreaterThan(control!.converters);

    const [sample] = await as(db, owner, () =>
      q<{ sessions: number }>('select sessions from project_session_sample($1, 10) limit 1', [
        demo!.demo_project_id,
      ]),
    );
    expect(sample!.sessions).toBe(4000);
  });

  it("doesn't count demo events toward the monthly allowance", async () => {
    const [row] = await as(db, owner, () =>
      q<{ n: number }>('select workspace_events_this_month($1) as n', [ws]),
    );
    expect(row!.n).toBe(0);
  });

  it('only works in your own workspace', async () => {
    await expect(
      as(db, outsider, () => q('select * from create_demo_project($1)', [ws])),
    ).rejects.toThrow('Not a member of this workspace.');
  });
});
