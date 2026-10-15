-- Help requests, feedback and problem reports sent from inside the dashboard ("Help and
-- feedback" in the sidebar). Like contact_messages, nobody reads them through the API: the
-- owner reads them in the Supabase dashboard and replies to the sender's account email.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Copied from the account when sent, so a reply goes to the address used then.
  email text not null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  kind text not null check (kind in ('help', 'feedback', 'problem')),
  message text not null check (char_length(message) between 1 and 4000),
  -- The dashboard page it was sent from (path only), to help reproduce problems.
  page text check (char_length(page) <= 500),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
-- No policies: written only by send_feedback(), read only by the owner in Supabase.

create index feedback_user_idx on public.feedback (user_id, created_at);

-- Store a message from the signed-in user. Returns 1, or -1 after 10 in the last hour.
-- The workspace is kept only when the sender belongs to it.
create function public.send_feedback(
  p_kind text,
  p_message text,
  p_page text default null,
  p_workspace uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Log in to send feedback.';
  end if;
  if (select count(*) from public.feedback
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    return -1;
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.feedback (user_id, email, workspace_id, kind, message, page)
  values (
    auth.uid(),
    coalesce(v_email, ''),
    case when p_workspace is not null and public.is_workspace_member(p_workspace)
      then p_workspace end,
    p_kind,
    btrim(p_message),
    nullif(btrim(coalesce(p_page, '')), '')
  );
  return 1;
end;
$$;

revoke all on function public.send_feedback(text, text, text, uuid) from public, anon;
grant execute on function public.send_feedback(text, text, text, uuid) to authenticated;
