-- Questions sent from the marketing site's contact form. Nobody reads or writes this table
-- through the API: only the contact Edge Function (service role) inserts, and the owner
-- reads messages in the Supabase dashboard.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  message text not null check (char_length(message) between 1 and 2000),
  -- HMAC of the sender's IP, for rate limiting only; the IP itself is never stored.
  sender_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
-- No policies: anon and signed-in users can neither read nor write.

create index contact_messages_sender_idx on public.contact_messages (sender_hash, created_at);

-- Store a message. Returns 1, or -1 when this sender sent 5 in the last hour, or -2 when the
-- form received 200 in the last hour (a flood).
create function public.submit_contact_message(p_email text, p_message text, p_sender text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.contact_messages
      where sender_hash = p_sender and created_at > now() - interval '1 hour') >= 5 then
    return -1;
  end if;
  if (select count(*) from public.contact_messages
      where created_at > now() - interval '1 hour') >= 200 then
    return -2;
  end if;
  insert into public.contact_messages (email, message, sender_hash)
  values (lower(btrim(p_email)), btrim(p_message), p_sender);
  return 1;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text) to service_role;
