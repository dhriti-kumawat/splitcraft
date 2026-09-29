// Fill an experiment with simulated traffic for demos, or remove it again.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run simulate -w tools/simulator -- \
//     --project prj_… --experiment sticky-book-now-bar --goal book_click \
//     --rates control=0.05,b=0.055 --visitors 20000 --days 14
//
//   … -- --project prj_… --delete        removes every simulated event of the project
//
// Uses the service role key, so run it only on your own machine and never commit the key.
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { parseRates, plan } from './plan';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    experiment: { type: 'string' },
    goal: { type: 'string' },
    rates: { type: 'string' },
    visitors: { type: 'string', default: '20000' },
    days: { type: 'string', default: '14' },
    seed: { type: 'string', default: '1' },
    'dry-run': { type: 'boolean', default: false },
    delete: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell (never in a committed file).');
if (!values.project) fail('Pass --project prj_… (the project public key).');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: project, error: projectError } = await supabase
  .from('projects')
  .select('id, main_domain')
  .eq('public_key', values.project)
  .maybeSingle();
if (projectError) fail(projectError.message);
if (!project) fail(`No project with public key ${values.project}.`);

if (values.delete) {
  const { error, count } = await supabase
    .from('events')
    .delete({ count: 'exact' })
    .eq('project_id', project.id)
    .eq('props->>simulated', 'true');
  if (error) fail(error.message);
  console.log(`Deleted ${count ?? 0} simulated events.`);
  process.exit(0);
}

if (!values.experiment || !values.goal || !values.rates) {
  fail('Pass --experiment <key>, --goal <event key> and --rates control=0.05,b=0.055.');
}
const { data: experiment, error: expError } = await supabase
  .from('experiments')
  .select('id, key, traffic_pct, variants (key, weight)')
  .eq('project_id', project.id)
  .eq('key', values.experiment)
  .maybeSingle();
if (expError) fail(expError.message);
if (!experiment) fail(`No experiment "${values.experiment}" in this project.`);

const rates = parseRates(values.rates);
const variants = (experiment.variants as Array<{ key: string; weight: number }>)
  .map((v) => ({
    key: v.key,
    weight: Number(v.weight),
    rate: rates[v.key] ?? fail(`No rate for variant "${v.key}".`),
  }))
  // Same order as the SDK config, so buckets match real traffic.
  .sort((a, b) => a.key.localeCompare(b.key));

const events = plan({
  projectId: project.id,
  experimentId: experiment.id,
  experimentKey: experiment.key,
  goalKey: values.goal,
  variants,
  visitors: Number(values.visitors),
  days: Number(values.days),
  seed: Number(values.seed),
  trafficPct: Number(experiment.traffic_pct),
  url: `https://${project.main_domain}/`,
});
const exposures = events.filter((e) => e.type === 'exposure').length;
console.log(
  `${exposures} exposures and ${events.length - exposures} goal events over ${values.days} days.`,
);
if (values['dry-run']) process.exit(0);

for (let i = 0; i < events.length; i += 500) {
  const { error } = await supabase.from('events').insert(events.slice(i, i + 500));
  if (error) fail(`Stopped after ${i} events: ${error.message}`);
}
console.log('Done. Every event has props.simulated = true; remove them with --delete.');
