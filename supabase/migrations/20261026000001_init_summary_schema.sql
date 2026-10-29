-- Supabase migration: `summary` database schema (region ap-south-1, Mumbai)

create table if not exists public.summaries (
    id uuid primary key default gen_random_uuid(),
    session_id text not null default 'anonymous',
    title text not null,
    source_type text not null check (source_type in ('paste', 'pdf', 'docx', 'txt', 'md', 'csv', 'rtf', 'json')),
    source_filename text,
    source_content text not null,
    source_word_count integer not null check (source_word_count >= 0),
    length_mode text not null check (length_mode in ('custom', 'ai_auto')),
    requested_words integer,
    ai_decided_words integer not null,
    actual_word_count integer not null,
    summary_style text not null default 'executive',
    summary_content text not null,
    key_takeaways jsonb not null default '[]'::jsonb,
    keywords jsonb not null default '[]'::jsonb,
    ai_rationale text,
    compression_ratio numeric(5,2) not null default 0.00,
    model_used text not null default 'openai/gpt-oss-120b',
    latency_ms integer,
    created_at timestamptz not null default now()
);

create index if not exists idx_summaries_session_created
    on public.summaries (session_id, created_at desc);

alter table public.summaries enable row level security;

grant select, insert, update, delete on public.summaries to anon, authenticated;

-- The app has no sign-in: each browser generates a random session id and sends it as the
-- x-session-id header, and a row is only visible and writable to the session that created it.
-- (The spec's original policy, using (true), let anyone holding the public anon key read and
-- delete every summary.) The Edge Function writes with the service role, which bypasses RLS.
create policy "Rows belong to the calling browser session"
    on public.summaries
    for all
    to anon, authenticated
    using (session_id = (select current_setting('request.headers', true)::json ->> 'x-session-id'))
    with check (session_id = (select current_setting('request.headers', true)::json ->> 'x-session-id'));
