-- Contact form (Dani 2026-11-10: no public email address). Submissions show in the admin portal.
-- Service role only (RLS on, no policies).
create table public.contact_messages (
  id           bigint generated always as identity primary key,
  topic        text not null check (topic in ('question', 'data', 'delete', 'bug', 'other')),
  message      text not null check (char_length(message) between 5 and 2000),
  reply_email  text check (reply_email is null or char_length(reply_email) <= 254),
  player_id    uuid,               -- set when the sender has a session (to find their games)
  status       text not null default 'new' check (status in ('new', 'done')),
  created_at   timestamptz not null default now(),
  handled_at   timestamptz
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
