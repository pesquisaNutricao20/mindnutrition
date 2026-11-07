-- Mind Nutrition — Conversa com a nutricionista, agenda de consultas e bloqueios
-- Rode no SQL Editor do Supabase, depois das migrations 001, 002 e 003.

-- ============ MENSAGENS (chat nutricionista <-> paciente) ============

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'nutritionist')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at asc);

create index if not exists messages_unread_idx
  on public.messages (user_id, sender) where read_at is null;

alter table public.messages enable row level security;

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Escritas de conversa passam somente pelo servidor (service role), onde há
-- validação de tamanho, remetente e origem. O paciente só lê a própria conversa.

-- Marcar como lida é feito pelo servidor (service role) e por esta função segura.
create or replace function public.mark_conversation_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages
     set read_at = now()
   where user_id = auth.uid()
     and sender = 'nutritionist'
     and read_at is null;
end;
$$;

grant execute on function public.mark_conversation_read() to authenticated;
revoke execute on function public.mark_conversation_read() from anon;

revoke all on public.messages from anon;
grant select on public.messages to authenticated;

-- ============ AGENDA DE CONSULTAS ============

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  slot time not null,
  scheduled_at timestamptz not null,
  mode text not null default 'online' check (mode in ('online', 'presencial')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  notes text not null default '' check (char_length(notes) <= 800),
  nutritionist_note text not null default '' check (char_length(nutritionist_note) <= 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Um horário só pode ter uma consulta pendente ou confirmada por vez.
create unique index if not exists appointments_active_slot_idx
  on public.appointments (day, slot)
  where status in ('pending', 'confirmed');

create index if not exists appointments_user_day_idx
  on public.appointments (user_id, day desc);

create index if not exists appointments_status_day_idx
  on public.appointments (status, day asc);

alter table public.appointments enable row level security;

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own" on public.appointments
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Marcação, aceite e bloqueio de dias passam somente pelo servidor, que valida
-- horários, dias bloqueados e conflitos. Assim ninguém contorna a agenda
-- inserindo direto pela API pública do Supabase.

revoke all on public.appointments from anon;
grant select on public.appointments to authenticated;

create or replace function public.touch_appointment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_appointment_updated_at();

-- ============ DIAS BLOQUEADOS PELA NUTRICIONISTA ============

create table if not exists public.appointment_blocks (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists appointment_blocks_day_idx
  on public.appointment_blocks (day);

alter table public.appointment_blocks enable row level security;

revoke all on public.appointment_blocks from anon;
revoke all on public.appointment_blocks from authenticated;
-- Sem policies: apenas o servidor (service role) lê e grava os bloqueios.

-- ============ AJUSTE NO ENCERRAMENTO DA CONTA ============
-- Garante que apagar a conta também limpa conversa e agenda.

create or replace function public.delete_current_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.messages where user_id = auth.uid();
  delete from public.appointments where user_id = auth.uid();
  delete from public.meals where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

grant execute on function public.delete_current_user_data() to authenticated;
revoke execute on function public.delete_current_user_data() from anon;

-- ============ ARTIGOS COM EDITOR RICO ============
-- Mantém `content` (array de parágrafos) para compatibilidade e adiciona o HTML
-- produzido pelo editor Tiptap no painel da nutricionista.

alter table public.articles add column if not exists content_html text not null default '';
