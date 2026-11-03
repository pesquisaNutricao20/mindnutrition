-- Mind Nutrition — Artigos, storage de fotos e colunas de auditoria
-- Rode no SQL Editor do Supabase.

-- ============ ARTIGOS ============

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'Leitura',
  summary text not null default '',
  content jsonb not null default '[]'::jsonb,
  image text,
  source_label text,
  source_url text,
  duration text not null default '4 min',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.articles enable row level security;

drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read" on public.articles
  for select to anon, authenticated
  using (published = true);

-- Escritas de artigos são feitas apenas pelo servidor com service role,
-- que ignora RLS. Nenhuma policy de escrita é criada para o cliente.

create index if not exists articles_published_created_idx
  on public.articles (published, created_at desc);

-- ============ AUDITORIA ============

alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.meals add column if not exists updated_at timestamptz not null default now();

create index if not exists meals_user_updated_idx
  on public.meals (user_id, updated_at desc);

-- ============ STORAGE: FOTOS DE REFEIÇÕES ============
-- Bucket privado; o cliente usa URLs assinadas para exibir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada pessoa só acessa a própria pasta: meal-photos/<uid>/<arquivo>

drop policy if exists "meal_photos_select_own" on storage.objects;
create policy "meal_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "meal_photos_insert_own" on storage.objects;
create policy "meal_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "meal_photos_update_own" on storage.objects;
create policy "meal_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "meal_photos_delete_own" on storage.objects;
create policy "meal_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
