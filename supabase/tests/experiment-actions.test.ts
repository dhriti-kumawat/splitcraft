import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000a1';
const ADMIN = '00000000-0000-0000-0000-0000000000a2';
const MEMBER = '00000000-0000-0000-0000-0000000000a3';
const OUTSIDER = '00000000-0000-0000-0000-0000000000a4';
const owner = { role: 'authenticated', userId: OWNER } as const;
const admin = { role: 'authenticated', userId: ADMIN } as const;
const member = { role: 'authenticated', userId: MEMBER } as const;
const outsider = { role: 'authenticated', userId: OUTSIDER } as const;

let db: Db;
let project: string;
let metric: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function newExperiment(key: string, status = 'draft'): Promise<string> {
  const [e] = await as(db, owner, () =>
    q<{ id: string }>(
      `insert into experiments (project_id, key, name, hypothesis, traffic_pct, targeting, primary_metric_id, plan, status)
       values ($1, $2, 'Sticky bar', 'Bar helps', 80, '{"when":{"mode":"always"}}', $3, '{"mde":0.1}', $4)
       returning id`,
      [project, key, metric, status],
    ),
  );
  await as(db, owner, () =>
    q(
      `insert into variants (experiment_id, key, name, weight, js, css) values
       ($1, 'control', 'Control', 40, '', ''), ($1, 'b', 'Sticky', 60, 'bar()', '.bar{}')`,
      [e!.id],
    ),
  );
  await as(db, owner, () =>
    q(
      `insert into experiment_metrics (experiment_id, metric_id, role, "limit") values ($1, $2, 'guardrail', '{"max":0.02}')`,
      [e!.id, metric],
    ),
  );
  return e!.id;
}

const duplicate = (who: typeof owner | typeof member | typeof outsider, id: string) =>
  as(db, who, () =>
    q<{ id: string }>('select public.duplicate_experiment($1) as id', [id]).then((r) => r[0]!.id),
  );

beforeAll(async () => {
  db = await createDb();
  for (const id of [OWNER, ADMIN, MEMBER, OUTSIDER]) await createUser(db, id);
  const [{ id: ws }] = (await as(db, owner, () =>
    q<{ id: string }>(`insert into workspaces (name) values ('Team') returning id`),
  )) as [{ id: string }];
  await as(db, owner, () =>
    q(
      `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'admin'), ($1, $3, 'member')`,
      [ws, ADMIN, MEMBER],
    ),
  );
  [{ id: project }] = (await as(db, owner, () =>
    q<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id`,
      [ws],
    ),
  )) as [{ id: string }];
  [{ id: metric }] = (await as(db, owner, () =>
    q<{ id: string }>(
      `insert into metrics (project_id, event_key, name, source) values ($1, 'book', 'Book click', 'click') returning id`,
      [project],
    ),
  )) as [{ id: string }];
});

afterAll(async () => {
  await db.close();
});

describe('duplicate_experiment', () => {
  it('copies setup, variants and goals into a new draft', async () => {
    const src = await newExperiment('sticky', 'ended');
    const id = await duplicate(member, src);
    const [copy] = await as(db, member, () =>
      q(
        `select key, name, hypothesis, status, traffic_pct::float as traffic, targeting, primary_metric_id, plan, started_at
         from experiments where id = $1`,
        [id],
      ),
    );
    expect(copy).toEqual({
      key: 'sticky-copy',
      name: 'Sticky bar (copy)',
      hypothesis: 'Bar helps',
      status: 'draft',
      traffic: 80,
      targeting: { when: { mode: 'always' } },
      primary_metric_id: metric,
      plan: { mde: 0.1 },
      started_at: null,
    });
    expect(
      await as(db, member, () =>
        q(
          `select key, name, weight::float as weight, js, css, version from variants where experiment_id = $1 order by key`,
          [id],
        ),
      ),
    ).toEqual([
      { key: 'b', name: 'Sticky', weight: 60, js: 'bar()', css: '.bar{}', version: 1 },
      { key: 'control', name: 'Control', weight: 40, js: '', css: '', version: 1 },
    ]);
    expect(
      await as(db, member, () =>
        q(`select metric_id, role, "limit" from experiment_metrics where experiment_id = $1`, [id]),
      ),
    ).toEqual([{ metric_id: metric, role: 'guardrail', limit: { max: 0.02 } }]);
  });

  it('picks the next free key', async () => {
    const src = await newExperiment('hero');
    await duplicate(owner, src);
    const id = await duplicate(owner, src);
    const [row] = await as(db, owner, () => q('select key from experiments where id = $1', [id]));
    expect(row).toEqual({ key: 'hero-copy-2' });
  });

  it('does not copy experiments from another workspace', async () => {
    const src = await newExperiment('private');
    await expect(duplicate(outsider, src)).rejects.toThrow('Experiment not found.');
  });
});

describe('test page', () => {
  it('is copied by duplicate, and must be an http(s) URL', async () => {
    const src = await newExperiment('paged');
    await as(db, owner, () =>
      q(`update experiments set preview_url = 'https://p.dev/trips/oslo' where id = $1`, [src]),
    );
    const id = await duplicate(owner, src);
    const [row] = await as(db, owner, () =>
      q('select preview_url from experiments where id = $1', [id]),
    );
    expect(row).toEqual({ preview_url: 'https://p.dev/trips/oslo' });
    await expect(
      as(db, owner, () =>
        q(`update experiments set preview_url = 'javascript:alert(1)' where id = $1`, [src]),
      ),
    ).rejects.toThrow(/preview_url_check/);
  });
});

describe('archiving', () => {
  it('works for stopped experiments and blocks going live', async () => {
    const id = await newExperiment('arch', 'ended');
    await as(db, member, () => q('update experiments set archived_at = now() where id = $1', [id]));
    await expect(
      as(db, member, () => q(`update experiments set status = 'live' where id = $1`, [id])),
    ).rejects.toThrow(/experiments_archived_not_live/);
  });

  it('is refused while live', async () => {
    const id = await newExperiment('arch-live', 'live');
    await expect(
      as(db, owner, () => q('update experiments set archived_at = now() where id = $1', [id])),
    ).rejects.toThrow(/experiments_archived_not_live/);
  });
});

describe('deleting experiments', () => {
  const exists = async (id: string) =>
    (await as(db, owner, () => q('select id from experiments where id = $1', [id]))).length === 1;

  it('is refused for members and allowed for admins and owners', async () => {
    const a = await newExperiment('del-a');
    const b = await newExperiment('del-b', 'ended');
    await as(db, member, () => q('delete from experiments where id = $1', [a]));
    expect(await exists(a)).toBe(true);
    await as(db, admin, () => q('delete from experiments where id = $1', [a]));
    await as(db, owner, () => q('delete from experiments where id = $1', [b]));
    expect(await exists(a)).toBe(false);
    expect(await exists(b)).toBe(false);
  });

  it('is refused while live', async () => {
    const id = await newExperiment('del-live', 'live');
    await as(db, owner, () => q('delete from experiments where id = $1', [id]));
    expect(await exists(id)).toBe(true);
  });

  it('still lets members create and edit experiments', async () => {
    const [e] = await as(db, member, () =>
      q<{ id: string }>(
        `insert into experiments (project_id, key, name) values ($1, 'by-member', 'Mine') returning id`,
        [project],
      ),
    );
    await as(db, member, () => q(`update experiments set name = 'Renamed' where id = $1`, [e!.id]));
    const [row] = await as(db, member, () =>
      q('select name from experiments where id = $1', [e!.id]),
    );
    expect(row).toEqual({ name: 'Renamed' });
  });
});
