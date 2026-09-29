import type { ExperimentConfig, ProjectConfig } from '../../packages/sdk/src/runtime';
import type { Targeting } from '../../packages/sdk/src/targeting';

// The config must match the SDK's ProjectConfig field for field. Only the rule contents
// (conditions, URL rules) are stored JSON passed through untouched, so they are not
// type-checked here; the runtime tests below check their values.
type SdkShape = Omit<ProjectConfig, 'experiments'> & {
  experiments: Array<
    Omit<ExperimentConfig, 'targeting'> & { targeting: { [K in keyof Targeting]?: unknown } }
  >;
};
import { toSdkConfig } from '../functions/_shared/config.ts';
import type { ConfigSource } from '../functions/_shared/types.ts';
import { as, createDb, createUser, type Db } from './db';

const OWNER = '00000000-0000-0000-0000-0000000000aa';
const service = { role: 'service_role' } as const;
const owner = { role: 'authenticated', userId: OWNER } as const;
const anon = { role: 'anon' } as const;

let db: Db;
let projectId: string;
let publicKey: string;
let experimentId: string;

// Typed as non-empty so tests can destructure the first row; an empty result makes the
// destructuring throw, which fails the test just as clearly.
async function rows<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<[T, ...T[]]> {
  return (await db.query<T>(sql, params)).rows as [T, ...T[]];
}

async function configSource(key: string): Promise<ConfigSource | null> {
  const [row] = await as(db, service, () =>
    rows<{ c: ConfigSource | null }>('select public.sdk_config_source($1) as c', [key]),
  );
  return row!.c;
}

async function ingest(host: string, events: unknown[], key = publicKey): Promise<number> {
  const [row] = await as(db, service, () =>
    rows<{ n: number }>('select public.ingest_events($1, $2, $3) as n', [
      key,
      host,
      JSON.stringify(events),
    ]),
  );
  return row!.n;
}

beforeAll(async () => {
  db = await createDb();
  await createUser(db, OWNER);
  await as(db, owner, async () => {
    const [{ id: ws }] = await rows<{ id: string }>(
      `insert into workspaces (name) values ('W') returning id`,
    );
    [{ id: projectId, public_key: publicKey }] = await rows<{ id: string; public_key: string }>(
      `insert into projects (workspace_id, name, main_domain, allowed_domains)
       values ($1, 'Trip Demo', 'mytrips.dev', '{staging.mytrips.dev,*.preview.mytrips.dev,localhost}')
       returning id, public_key`,
      [ws],
    );
    const [{ id: segment }] = await rows<{ id: string }>(
      `insert into segments (project_id, name, rules) values ($1, 'Returning',
        '{"mode":"all","items":[{"type":"visitor_type","value":"returning"}]}') returning id`,
      [projectId],
    );
    const [{ id: bookClick }] = await rows<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, source_config)
       values ($1, 'Book click', 'book_click', 'click', '{"selector":".book","firstPerPage":true,"views":true,"timing":true}') returning id`,
      [projectId],
    );
    const [{ id: confirmation }] = await rows<{ id: string }>(
      `insert into metrics (project_id, name, event_key, source, source_config)
       values ($1, 'Confirmation', 'purchase_page', 'pageview', '{"url":{"op":"is","value":"/checkout/done"}}') returning id`,
      [projectId],
    );
    await rows(
      `insert into metrics (project_id, name, event_key, source, source_config)
       values ($1, 'Unused', 'unused_click', 'click', '{"selector":".secret-internal-button"}')`,
      [projectId],
    );
    [{ id: experimentId }] = await rows<{ id: string }>(
      `insert into experiments (project_id, key, name, status, traffic_pct, primary_metric_id, targeting)
       values ($1, 'trust', 'Trust badges', 'live', 80, $2, $3) returning id`,
      [
        projectId,
        bookClick,
        JSON.stringify({
          who: { mode: 'all', segmentIds: [segment] },
          where: { include: [{ op: 'matches', value: '/trips/*' }] },
          when: { mode: 'every_load' },
        }),
      ],
    );
    await rows(
      `insert into experiment_metrics (experiment_id, metric_id, role) values ($1, $2, 'secondary')`,
      [experimentId, confirmation],
    );
    await rows(
      `insert into variants (experiment_id, key, name, weight, js, css) values
       ($1, 'control', 'Control', 50, '', ''),
       ($1, 'b', 'B', 50, 'document.body.dataset.b = "1"', '.badges{display:block}')`,
      [experimentId],
    );
    await rows(
      `insert into experiments (project_id, key, name, status) values ($1, 'draft-one', 'Draft', 'draft')`,
      [projectId],
    );
  });
});

afterAll(async () => {
  await db.close();
});

describe('sdk_config_source + toSdkConfig', () => {
  it('builds the SDK config for live experiments only', async () => {
    const source = await configSource(publicKey);
    const config: SdkShape = toSdkConfig(
      source!,
      publicKey,
      'https://x.supabase.co/functions/v1/events',
    );

    expect(config.experiments.map((e) => e.key)).toEqual(['trust']);
    const [trust] = config.experiments;
    expect(trust).toMatchObject({ key: 'trust', name: 'Trust badges', trafficPct: 80 });
    expect(trust!.variants).toEqual([
      {
        key: 'b',
        name: 'B',
        weight: 50,
        js: 'document.body.dataset.b = "1"',
        css: '.badges{display:block}',
      },
      { key: 'control', name: 'Control', weight: 50 },
    ]);
    expect(trust!.targeting).toEqual({
      who: [{ mode: 'all', items: [{ type: 'visitor_type', value: 'returning' }] }],
      where: { include: [{ op: 'matches', value: '/trips/*' }] },
      when: { mode: 'every_load' },
    });
  });

  it('includes only goals that live experiments use', async () => {
    const config = toSdkConfig((await configSource(publicKey))!, publicKey, '/e');
    expect(config.goals).toEqual({
      clicks: [
        { key: 'book_click', selector: '.book', firstPerPage: true, views: true, timing: true },
      ],
      pageviews: [{ key: 'purchase_page', url: { op: 'is', value: '/checkout/done' } }],
      custom: [],
      datalayer: [],
      transactions: [],
    });
    expect(JSON.stringify(config)).not.toContain('secret-internal-button');
  });

  it('passes on only the switches a project turned off', async () => {
    expect(toSdkConfig((await configSource(publicKey))!, publicKey, '/e')).not.toHaveProperty(
      'options',
    );
    await as(db, owner, () =>
      rows(
        `update projects set settings = '{"spa": false, "ga4": false, "antiFlicker": false}' where id = $1 returning id`,
        [projectId],
      ),
    );
    expect(toSdkConfig((await configSource(publicKey))!, publicKey, '/e').options).toEqual({
      spa: false,
      ga4: false,
    });
    await as(db, owner, () =>
      rows(`update projects set settings = '{}' where id = $1 returning id`, [projectId]),
    );
  });

  it('returns null for an unknown public key', async () => {
    expect(await configSource('prj_00000000000000000000000000000000')).toBeNull();
  });
});

describe('ingest_events', () => {
  const exposure = {
    type: 'exposure',
    experimentKey: 'trust',
    variantKey: 'b',
    visitorId: 'v_0123456789abcdef01234567',
    url: 'https://mytrips.dev/trips/norway',
  };
  const goal = {
    type: 'goal',
    key: 'purchase',
    value: 120,
    props: { currency: 'INR' },
    visitorId: 'v_0123456789abcdef01234567',
    url: 'https://mytrips.dev/checkout/done',
  };

  it('stores events, links exposures to the experiment and marks the project installed', async () => {
    expect(await ingest('mytrips.dev', [exposure, goal])).toBe(2);
    const events = await as(db, owner, () =>
      rows(
        'select type, experiment_id, variant_key, key, value::float as value, props from events order by id',
      ),
    );
    expect(events).toEqual([
      {
        type: 'exposure',
        experiment_id: experimentId,
        variant_key: 'b',
        key: null,
        value: null,
        props: null,
      },
      {
        type: 'goal',
        experiment_id: null,
        variant_key: null,
        key: 'purchase',
        value: 120,
        props: { currency: 'INR' },
      },
    ]);
    const [project] = await as(db, owner, () =>
      rows<{ installed_at: Date | null }>('select installed_at from projects'),
    );
    expect(project!.installed_at).not.toBeNull();
  });

  it('accepts www., allowed domains and wildcard subdomains', async () => {
    for (const host of [
      'www.mytrips.dev',
      'staging.mytrips.dev',
      'pr-12.preview.mytrips.dev',
      'localhost',
    ]) {
      expect(await ingest(host, [goal]), host).toBe(1);
    }
  });

  it('rejects other hosts and a missing Origin', async () => {
    for (const host of ['evil.dev', 'mytrips.dev.evil.dev', 'preview.mytrips.dev', '']) {
      expect(await ingest(host, [goal]), host || '(empty)').toBe(-2);
    }
  });

  it('rejects an unknown project', async () => {
    expect(await ingest('mytrips.dev', [goal], 'prj_00000000000000000000000000000000')).toBe(-1);
  });

  it('drops exposures for unknown experiments', async () => {
    expect(await ingest('mytrips.dev', [{ ...exposure, experimentKey: 'nope' }, goal])).toBe(1);
  });
});

describe('function permissions', () => {
  it('only the service role can call the SDK functions', async () => {
    for (const who of [anon, owner]) {
      await expect(
        as(db, who, () => rows('select public.sdk_config_source($1)', [publicKey])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(db, who, () =>
          rows(`select public.ingest_events($1, 'mytrips.dev', '[]')`, [publicKey]),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
