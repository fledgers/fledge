create table if not exists public.study_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (
    format in ('summary', 'quiz', 'mock_exam')
  ),
  title text not null check (
    char_length(btrim(title)) between 1 and 200
  ),
  source_label text not null check (
    char_length(btrim(source_label)) between 1 and 300
  ),
  settings jsonb not null default '{}'::jsonb check (
    jsonb_typeof(settings) = 'object'
  ),
  output text not null check (char_length(btrim(output)) > 0),
  input_character_count integer not null check (
    input_character_count >= 30
  ),
  created_at timestamptz not null default now()
);

alter table public.study_generations enable row level security;

drop policy if exists "Users can view their own study generations"
on public.study_generations;

create policy "Users can view their own study generations"
on public.study_generations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can save their own study generations"
on public.study_generations;

create policy "Users can save their own study generations"
on public.study_generations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own study generations"
on public.study_generations;

create policy "Users can delete their own study generations"
on public.study_generations
for delete
to authenticated
using (auth.uid() = user_id);

revoke all on public.study_generations from anon;
grant select, insert, delete on public.study_generations to authenticated;

create index if not exists study_generations_user_created_at_idx
on public.study_generations(user_id, created_at desc);

notify pgrst, 'reload schema';
