create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  photo text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_id_created_at_idx
  on public.meals (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can upsert their own profile" on public.profiles;
create policy "Users can upsert their own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete
  using ((select auth.uid()) = id);

drop policy if exists "Users can read their own meals" on public.meals;
create policy "Users can read their own meals"
  on public.meals for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own meals" on public.meals;
create policy "Users can insert their own meals"
  on public.meals for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own meals" on public.meals;
create policy "Users can delete their own meals"
  on public.meals for delete
  using ((select auth.uid()) = user_id);

create or replace function public.delete_current_user_data()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.meals where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

grant execute on function public.delete_current_user_data() to authenticated;
revoke execute on function public.delete_current_user_data() from anon;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, photo, data, updated_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'display_name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.profiles.name, excluded.name),
        photo = coalesce(public.profiles.photo, excluded.photo),
        data = public.profiles.data || excluded.data,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

insert into public.profiles (id, email, name, photo, data, updated_at)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    users.raw_user_meta_data->>'full_name',
    users.raw_user_meta_data->>'name',
    users.raw_user_meta_data->>'display_name'
  ),
  coalesce(
    users.raw_user_meta_data->>'avatar_url',
    users.raw_user_meta_data->>'picture'
  ),
  coalesce(users.raw_user_meta_data, '{}'::jsonb),
  now()
from auth.users
on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.profiles.name, excluded.name),
      photo = coalesce(public.profiles.photo, excluded.photo),
      data = public.profiles.data || excluded.data,
      updated_at = now();
