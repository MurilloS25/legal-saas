-- Auditoría de exportaciones del índice notarial interno.
--
-- Una exportación abarca varias Escrituras, así que no encaja en
-- document_activity (que es por documento). Se registra en su propia tabla,
-- de solo lectura para el dueño, escrita solo por una función SECURITY
-- DEFINER (sin INSERT directo desde el navegador). No guarda datos sensibles:
-- solo formato, rango de fechas y cantidad de filas.

create table public.notarial_index_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  format text not null,
  from_date date,
  to_date date,
  row_count integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  constraint nie_format_check check (format in ('csv')),
  constraint nie_row_count_non_negative check (row_count >= 0)
);

create index nie_owner_created_idx
  on public.notarial_index_exports (owner_id, created_at desc);

alter table public.notarial_index_exports enable row level security;

create policy "nie_select_own"
on public.notarial_index_exports
for select to authenticated
using (owner_id = auth.uid());
-- Sin políticas INSERT/UPDATE/DELETE: la escritura ocurre vía RPC definer.

create or replace function public.log_notarial_index_export(
  p_format text,
  p_from date,
  p_to date,
  p_row_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_format is null or p_format not in ('csv') then
    return;
  end if;

  insert into public.notarial_index_exports
    (owner_id, format, from_date, to_date, row_count)
  values (auth.uid(), p_format, p_from, p_to, greatest(coalesce(p_row_count, 0), 0));
end;
$$;

revoke all on function public.log_notarial_index_export(text, date, date, integer) from public;
grant execute on function public.log_notarial_index_export(text, date, date, integer) to authenticated;
