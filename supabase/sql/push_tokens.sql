-- Tabla de tokens de push (FCM) por mesero.
-- La app guarda acá el token del dispositivo al loguearse; la Edge Function
-- notify-llamado los usa para enviar el push.
--
-- Corré esto en Supabase -> SQL Editor.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  mesero_id uuid not null references public.meseros(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_tokens_mesero_id_idx on public.push_tokens(mesero_id);

alter table public.push_tokens enable row level security;

-- La app usa la anon key (sin Supabase Auth), así que permitimos a `anon`
-- registrar y actualizar su token. La lectura queda solo para service_role
-- (la Edge Function), no para anon.
drop policy if exists "anon inserta push token" on public.push_tokens;
create policy "anon inserta push token"
  on public.push_tokens for insert to anon
  with check (true);

drop policy if exists "anon actualiza push token" on public.push_tokens;
create policy "anon actualiza push token"
  on public.push_tokens for update to anon
  using (true) with check (true);
