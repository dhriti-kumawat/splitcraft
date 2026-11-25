---
title: Backend
description: Supabase schema, security, SQL functions, Edge Functions, limits and scheduled jobs.
---

# Backend

Everything lives in `supabase/`: migrations, two Edge Functions, and tests that run the real
migrations on PGlite (`npm run test -w supabase`, no Docker).

## Tables

`workspaces`, `workspace_members`, `workspace_invites`, `projects` (with `settings` for the SDK
switches), `experiments`, `variants`, `variant_versions`, `experiment_metrics` (secondary and
guardrail goals), `metrics`, `segments`, `triggers`, `page_sets`, `events`, `rate_limits` and
`contact_messages` (questions from the site's contact form).

**Row Level Security is on for every table.** Users see workspaces they belong to and everything
inside them. Deleting projects and experiments is limited to owners and admins; `events` can only be
read by members and only written by the events function (service role). `contact_messages` has no
policies at all: only the contact function writes it, and you read it in the Supabase dashboard.

## SQL functions

| Function                         | For                                                     |
| -------------------------------- | ------------------------------------------------------- |
| `experiment_results`, `experiment_daily` | Results page and cumulative chart               |
| `experiment_stats`               | Per-variant counts for the experiments list             |
| `guardrail_status`, `auto_pause_guardrails` | Guardrail checks and the 15-minute auto pause (pg_cron) |
| `project_overview`, `workspace_events_this_month` | Project cards and the usage meter      |
| `workspace_activity`             | Recent activity                                         |
| `pending_alerts`, `send_alerts`, `send_test_alert` | Slack and webhook alerts (pg_cron every 15 minutes, posted with pg_net); `alert_deliveries` keeps each alert to one send per test |
| `project_session_sample`         | Reach estimates                                         |
| `duplicate_experiment`           | Duplicate                                               |
| `workspace_people`, `invite_details`, `accept_invite` | Team and invites                   |
| `send_feedback`                  | Help and feedback from the dashboard into `feedback` (read in the Supabase dashboard; 10 an hour per account) |
| `move_project`                   | Move a project to another workspace (owner or admin of both); a trigger blocks any other change to `projects.workspace_id` |
| `sdk_config_source`, `ingest_events` | The two Edge Functions (service role only)          |

Most are `security invoker`, so RLS applies to them too.

## Edge Functions

**`GET /functions/v1/config/<public key>.json`**: the config the SDK fetches on every page: live
experiments with variants and resolved targeting (segments inlined), the goals they use, and project
switches that are off. Cached for 60 seconds (`public`, or `private` when it contains a country).

**`POST /functions/v1/events`**: batches from the SDK (`text/plain` JSON). Each event is validated
and trimmed; only pages on the project's domains are accepted.

| Response | Meaning                                                         |
| -------- | --------------------------------------------------------------- |
| 204      | Stored                                                          |
| 400 / 413 | Malformed batch / body over 64 KB                              |
| 403      | Page not on the project's domains                               |
| 404      | Unknown project key                                             |
| 429      | Monthly event limit reached, or rate limited (`Retry-After: 60`) |

Limits: the free plan stores 100,000 events a month per workspace (after that the config serves no
experiments, so visitors see the original site); at most 3,000 events a minute per project and 300
per visitor.

**`POST /functions/v1/contact`**: the marketing site's "Ask us anything" form (`{ email, message }`
as JSON). It validates both and stores them with `submit_contact_message`. A hidden `website` field
and forms sent within 2 seconds of loading are treated as spam and silently dropped. Each sender
(an HMAC of their IP, which is not stored) can send 5 messages an hour, and the form as a whole 200.
Read messages in the Supabase dashboard's table editor under `contact_messages`.

The /request-access/ form posts to the same endpoint with `kind: "access"`. After a message is
stored, the function sends email through [Resend](https://resend.com) when these secrets are set:

| Secret           | What it does                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` | Turns email on. Without it nothing is sent.                                                        |
| `NOTIFY_EMAIL`   | Every question and access request is emailed here. Reply to the email to answer the sender.      |
| `MAIL_FROM`      | Sender on a domain verified in Resend. Turns on the confirmation sent to people who ask for access (once a day per address). Without it, notices go from Resend's test sender, which can only mail the Resend account's own address. |

```sh
npx supabase secrets set RESEND_API_KEY=re_... NOTIFY_EMAIL=you@example.com
npx supabase secrets set MAIL_FROM="Splitcraft <hello@your-domain.com>"
npx supabase functions deploy contact --use-api
```

A failed email never fails the form: the message is already stored, and the error goes to the
function's logs.

**`POST /functions/v1/suggest`**: experiment ideas for the Experiments page (`{ projectId }`, signed
in). It reads the project with the caller's token, so Row Level Security decides access, then fetches
the main domain's home page, `sitemap.xml` and up to five more pages (pricing, sign-up and checkout
pages first). Each page gives its heading, calls to action, forms, prices, reviews and endpoints
(form actions and `/api`-style links). Only public host names are scanned: IP addresses, `localhost`
and single-label hosts are refused, and redirects are checked the same way. When the
`ANTHROPIC_API_KEY` secret is set, Claude (`claude-opus-5-5`) picks up to six tests from the variant
templates; its answer is checked against the scanned pages and template ids. Without the secret, or
if the call fails, built-in rules do the same. The response says which one ran (`source`).

## Migrations

Files in `supabase/migrations/` run in name order. Add a new file for every change (never edit an
applied one), and a test in `supabase/tests/`. Apply with `npx supabase db push` from an up-to-date
`main`, and redeploy a function after changing its code:

```sh
npx supabase functions deploy config --use-api
npx supabase functions deploy events --use-api
npx supabase functions deploy contact --use-api
npx supabase functions deploy suggest --use-api
```

## Invite-only accounts

New accounts (email, magic link, GitHub or Google) are created only for emails in
`public.allowed_emails`; a trigger on `auth.users` refuses the rest, and the dashboard shows
"Splitcraft is invite-only". The list has no API access and isn't in the repository. To let
someone in, add their email in the production database:

```sql
insert into public.allowed_emails (email) values ('someone@example.com');
```

To open sign-up again, drop the trigger `auth_users_invite_only` and set `INVITE_ONLY` to false in
`apps/dashboard/src/pages/auth/AuthPage.tsx`.

