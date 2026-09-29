-- New accounts no longer get a workspace named after the person ("Dhriti's Workspace").
-- A work email names it after the company ("jo@acme.co.uk" → "Acme"); a personal email
-- (Gmail, Outlook…) gets "My workspace". The dashboard then asks the owner to name it.

create or replace function public.default_workspace_name(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v_label is null or v_domain = any (array[
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
      'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me',
      'protonmail.com', 'pm.me', 'gmx.com', 'gmx.de', 'mail.com', 'zoho.com', 'yandex.com',
      'hey.com', 'fastmail.com', 'rediffmail.com', 'qq.com', '163.com'
    ]) then 'My workspace'
    else upper(left(v_label, 1)) || substr(v_label, 2)
  end
  from (
    select
      lower(split_part(p_email, '@', 2)) as v_domain,
      nullif(regexp_replace(split_part(lower(split_part(p_email, '@', 2)), '.', 1), '[^a-z0-9-]', '', 'g'), '') as v_label
  ) d;
$$;

create or replace function public.create_workspace_for(p_user uuid, p_email text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
begin
  insert into public.workspaces (name, created_by)
  values (left(public.default_workspace_name(p_email), 100), p_user)
  returning id into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace, p_user, 'owner');
  return v_workspace;
end;
$$;

revoke all on function public.default_workspace_name(text) from public, anon;
