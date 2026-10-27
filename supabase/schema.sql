-- Shared saved lists for Skilldeck. Run this once in your Supabase project's SQL editor.
--
-- A list is a random code that only travels inside the share link. The table is closed to the
-- public key (row level security with no policies), so the three functions below are the only
-- way in, and each of them needs the code.

create table if not exists public.saves (
  list text not null check (length(list) between 16 and 64),
  repo_id text not null,
  repo jsonb not null check (pg_column_size(repo) < 8192),
  saved_at timestamptz not null default now(),
  primary key (list, repo_id)
);

alter table public.saves enable row level security;

create or replace function public.list_saves(code text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(repo order by saved_at desc), '[]'::jsonb)
  from public.saves
  where list = code;
$$;

create or replace function public.add_saves(code text, repos jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.saves (list, repo_id, repo, saved_at)
  select code, r ->> 'id', r, coalesce(to_timestamp((r ->> 'savedAt')::float8 / 1000), now())
  from jsonb_array_elements(repos) as r
  where r ->> 'id' is not null
  on conflict (list, repo_id) do nothing;
$$;

create or replace function public.remove_save(code text, id text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.saves where list = code and repo_id = id;
$$;

grant execute on function public.list_saves(text), public.add_saves(text, jsonb), public.remove_save(text, text) to anon;

notify pgrst, 'reload schema';
