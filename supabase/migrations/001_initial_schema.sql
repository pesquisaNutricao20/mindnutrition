-- Mind Nutrition — Schema inicial
-- Rode este script no SQL Editor do Supabase (https://app.supabase.com → SQL Editor → New query)

-- ============ TABELAS ============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text default '',
  photo text default '',
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists meals_user_id_created_at_idx
  on public.meals (user_id, created_at desc);

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.meals enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own" on public.meals
  for select using (auth.uid() = user_id);

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own" on public.meals
  for insert with check (auth.uid() = user_id);

drop policy if exists "meals_delete_own" on public.meals;
create policy "meals_delete_own" on public.meals
  for delete using (auth.uid() = user_id);

-- ============ RPC: delete_current_user_data ============

create or replace function public.delete_current_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.meals where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

grant execute on function public.delete_current_user_data() to authenticated;
