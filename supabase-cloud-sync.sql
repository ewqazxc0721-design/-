-- Gain Tracker cloud-sync schema for Supabase.
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create table if not exists public.app_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  form_json jsonb not null default '{}'::jsonb,
  history_json jsonb not null default '[]'::jsonb,
  daily_logs_json jsonb not null default '{}'::jsonb,
  plan_checks_json jsonb not null default '{}'::jsonb,
  plan_template_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state
  add column if not exists user_id uuid,
  add column if not exists form_json jsonb not null default '{}'::jsonb,
  add column if not exists history_json jsonb not null default '[]'::jsonb,
  add column if not exists daily_logs_json jsonb not null default '{}'::jsonb,
  add column if not exists plan_checks_json jsonb not null default '{}'::jsonb,
  add column if not exists plan_template_json jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists app_state_user_id_idx
  on public.app_state (user_id);

alter table public.app_state enable row level security;

drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own"
  on public.app_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "app_state_insert_own" on public.app_state;
create policy "app_state_insert_own"
  on public.app_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own"
  on public.app_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "app_state_delete_own" on public.app_state;
create policy "app_state_delete_own"
  on public.app_state
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.app_state to authenticated;
revoke all on public.app_state from anon;

notify pgrst, 'reload schema';
