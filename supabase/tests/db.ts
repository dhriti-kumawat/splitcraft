import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migrationsDir = new URL('../migrations/', import.meta.url);

/**
 * The parts of a Supabase database the migrations rely on: the `auth` schema with
 * `auth.uid()`, the `anon` / `authenticated` / `service_role` roles, and Supabase's
 * default grants. Real Supabase provides these; PGlite needs a stand-in.
 */
export const SUPABASE_STUB = `
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type Db = PGlite;

/** A fresh database with every migration applied. */
export async function createDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) await db.exec(readFileSync(new URL(file, migrationsDir), 'utf8'));
  return db;
}

/**
 * An account that has set up its first workspace ("My workspace", as owner), the state most
 * tests start from. Sign-up itself no longer creates one (new-user.test.ts).
 */
export async function createUser(db: Db, id: string): Promise<string> {
  await db.query('insert into auth.users (id) values ($1)', [id]);
  await db.query('select public.create_workspace_for($1, null, null)', [id]);
  return id;
}

type Role = { role: 'authenticated'; userId: string } | { role: 'anon' } | { role: 'service_role' };

/** Run `fn` as a Supabase role, like a request with that JWT would. */
export async function as<T>(db: Db, who: Role, fn: () => Promise<T>): Promise<T> {
  const sub = who.role === 'authenticated' ? who.userId : '';
  await db.exec(`set role ${who.role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}
