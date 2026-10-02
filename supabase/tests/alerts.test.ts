import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000f1';
const STRANGER = '00000000-0000-0000-0000-0000000000f2';
const owner = { role: 'authenticated', userId: OWNER } as const;
const stranger = { role: 'authenticated', userId: STRANGER } as const;

let db: Db;
let project: string;
let purchase: string;

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

/** A live experiment with `n` visitors per arm, some converting on the primary goal. */
async function experiment(
  key: string,
  conversions: { control: number; b: number },
  opts: { n?: number; planned?: number | null } = {},
) {
  const { n = 1000, planned = 1000 } = opts;
  const [{ id }] = (await as(db, owner, () =>
    q<{ id: string }>(
      `insert into experiments (project_id, key, name, status, primary_metric_id, planned_sample)
       values ($1, $2, $2, 'live', $3, $4) returning id`,
      [project, key, purchase, planned],
    ),
  )) as [{ id: string }];
  await as(db, owner, () =>
    q(
      `insert into variants (experiment_id, key, name) values ($1, 'control', 'Control'), ($1, 'b', 'B')`,
      [id],
    ),
  );
  await q(
    `insert into events (project_id, visitor_id, experiment_id, type, variant_key, created_at)
     select $1::uuid, $2 || '-' || arm || '-' || i, $3::uuid, 'exposure', arm, now() - interval '2 days'
     from unnest(array['control', 'b']) as arm, generate_series(1, $4::int) as i`,
    [project, key, id, n],
  );
  await q(
    `insert into events (project_id, visitor_id, type, key, created_at)
     select $1::uuid, $2 || '-control-' || i, 'goal', 'purchase', now() - interval '1 day' from generate_series(1, $3::int) as i
     union all
     select $1::uuid, $2 || '-b-' || i, 'goal', 'purchase', now() - interval '1 day' from generate_series(1, $4::int) as i`,
    [project, key, conversions.control, conversions.b],
  );
  return id;
}

const pending = () =>
  q<{ experiment_id: string; event: string; message: string }>(
    'select experiment_id, event, message from pending_alerts() order by event',
  );

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
  await createUser(db, STRANGER);
  await as(db, owner, async () => {
    const [{ id: ws }] = (await q<{ id: string }>('select id from workspaces')) as [{ id: string }];
    [{ id: project }] = (await q<{ id: string }>(
      `insert into projects (workspace_id, name, main_domain) values ($1, 'P', 'p.dev') returning id`,
      [ws],
    )) as [{ id: string }];
    [{ id: purchase }] = (await q<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source) values ($1, 'Purchase', 'purchase', 'custom_js') returning id`,
      [project],
    )) as [{ id: string }];
  });
});

afterAll(async () => {
  await db.close();
});

describe('alert settings', () => {
  it('lets members add Slack and webhook alerts, and checks the URL and events', async () => {
    await as(db, owner, () =>
      q(
        `insert into project_alerts (project_id, kind, url) values ($1, 'slack', 'https://hooks.slack.com/services/T/B/x')`,
        [project],
      ),
    );
    await expect(
      as(db, owner, () =>
        q(
          `insert into project_alerts (project_id, kind, url) values ($1, 'webhook', 'http://insecure.dev/x')`,
          [project],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      as(db, owner, () =>
        q(
          `insert into project_alerts (project_id, kind, url, events) values ($1, 'webhook', 'https://a.dev/x', '{nope}')`,
          [project],
        ),
      ),
    ).rejects.toThrow();
  });

  it('hides alerts and the test send from other workspaces', async () => {
    expect(await as(db, stranger, () => q('select * from project_alerts'))).toEqual([]);
    const { id } = (await q<{ id: string }>('select id from project_alerts limit 1'))[0]!;
    await expect(as(db, stranger, () => q('select send_test_alert($1)', [id]))).rejects.toThrow(
      'Alert not found',
    );
    await as(db, owner, () => q('select send_test_alert($1)', [id]));
    await expect(as(db, owner, () => q('select send_alerts()'))).rejects.toThrow();
  });
});

describe('pending alerts', () => {
  it('reports a clear winner once the planned sample is reached, then never again', async () => {
    const id = await experiment('winner', { control: 100, b: 160 });
    expect((await pending()).filter((p) => p.experiment_id === id)).toEqual([
      expect.objectContaining({ event: 'sample_reached' }),
      expect.objectContaining({
        event: 'winner_found',
        message: '"winner" has a winner: b beats the original on the primary goal.',
      }),
    ]);
    expect(await q('select send_alerts() as n')).toEqual([{ n: 2 }]);
    expect((await pending()).filter((p) => p.experiment_id === id)).toEqual([]);
  });

  it('waits for the planned sample and needs a clear difference', async () => {
    const early = await experiment('early', { control: 10, b: 40 }, { n: 200, planned: 1000 });
    const flat = await experiment('flat', { control: 100, b: 104 });
    const noPlan = await experiment('no-plan', { control: 100, b: 160 }, { planned: null });
    const rows = await pending();
    expect(rows.filter((p) => p.experiment_id === early)).toEqual([]);
    expect(rows.filter((p) => p.experiment_id === flat).map((p) => p.event)).toEqual([
      'sample_reached',
    ]);
    expect(rows.filter((p) => p.experiment_id === noPlan)).toEqual([]);
  });

  it('reports an automatic guardrail pause', async () => {
    const id = await experiment('paused', { control: 100, b: 100 }, { planned: null });
    await q(
      `update experiments set status = 'paused', auto_paused = '{"metricId": null}' where id = $1`,
      [id],
    );
    expect((await pending()).filter((p) => p.experiment_id === id)).toEqual([
      expect.objectContaining({
        event: 'guardrail_paused',
        message: 'Paused "paused": a guardrail was crossed.',
      }),
    ]);
  });

  it('only sends the events an alert asked for', async () => {
    await q(`update project_alerts set events = '{guardrail_paused}'`);
    expect(new Set((await pending()).map((p) => p.event))).toEqual(new Set(['guardrail_paused']));
    await q(`update project_alerts set events = '{guardrail_paused,sample_reached,winner_found}'`);
  });

  it('formats Slack and webhook bodies', async () => {
    const { id } = (await q<{ id: string }>(`select id from experiments where key = 'winner'`))[0]!;
    const { slack, hook } = (
      await q<{
        slack: unknown;
        hook: { event: string; experiment: { key: string } };
      }>(
        `select alert_body('slack', 'winner_found', $1, 'Hi') as slack, alert_body('webhook', 'winner_found', $1, 'Hi') as hook`,
        [id],
      )
    )[0]!;
    expect(slack).toEqual({ text: 'Splitcraft: Hi' });
    expect(hook).toMatchObject({
      event: 'winner_found',
      text: 'Hi',
      experiment: { key: 'winner' },
    });
  });
});
