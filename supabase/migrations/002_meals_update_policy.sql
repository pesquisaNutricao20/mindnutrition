-- Permite que cada pessoa sincronize edições de suas próprias refeições.
alter table public.meals enable row level security;

drop policy if exists "meals_update_own" on public.meals;
create policy "meals_update_own" on public.meals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own meals" on public.meals;
create policy "Users can update their own meals"
  on public.meals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
