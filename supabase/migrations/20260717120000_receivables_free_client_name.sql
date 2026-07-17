-- Cuentas por cobrar: Cliente registrado o nombre libre.
--
-- Hasta ahora `client_id` era obligatorio: toda cuenta exigía un Cliente
-- formal. Se permite ahora una cuenta sin Cliente registrado, siempre con
-- un nombre visible obligatorio (`client_name_snapshot`).
--
-- Reglas:
-- * client_id nullable; cuando existe, sigue restringido al mismo owner
--   (la FK compuesta ya cubre esto — un componente NULL simplemente no se
--   valida contra clients, comportamiento estándar de FK multi-columna).
-- * client_name_snapshot siempre obligatorio y no vacío: es el nombre
--   visible efectivo, tanto para Cliente registrado como para nombre libre.
-- * Para un Cliente registrado, el snapshot NUNCA se confía al cliente: un
--   trigger BEFORE INSERT/UPDATE lo sincroniza siempre desde el nombre
--   vigente de `clients` en el momento de la escritura — no se puede
--   falsificar vía RPC/SQL directo. Para nombre libre, el snapshot es el
--   texto que decide el usuario (validado no vacío por CHECK).
-- * No se crean Clientes automáticamente; document_id sigue siendo opcional
--   en ambos modos.

-- ------------------------------------------------------------------ column

alter table public.receivables
  add column client_name_snapshot text;

-- Backfill: todas las filas existentes tienen client_id (era NOT NULL),
-- así que se rellenan desde el nombre vigente del Cliente.
update public.receivables r
   set client_name_snapshot = c.full_name
  from public.clients c
 where c.id = r.client_id
   and c.owner_id = r.owner_id
   and r.client_name_snapshot is null;

alter table public.receivables
  alter column client_name_snapshot set not null;

alter table public.receivables
  add constraint receivables_client_name_snapshot_not_blank
  check (btrim(client_name_snapshot) <> '');

alter table public.receivables
  add constraint receivables_client_name_snapshot_length_check
  check (char_length(btrim(client_name_snapshot)) <= 200);

alter table public.receivables
  alter column client_id drop not null;

-- ------------------------------------------------------------- name sync

-- Para una cuenta con Cliente registrado, el snapshot siempre refleja el
-- nombre vigente del Cliente al momento de esta escritura — nunca el valor
-- que haya podido enviar el formulario. Para nombre libre (client_id nulo)
-- no se toca: el CHECK de arriba ya exige que no llegue vacío.
create or replace function public.sync_receivable_client_name_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.client_id is not null then
    select full_name into new.client_name_snapshot
      from public.clients
     where id = new.client_id and owner_id = new.owner_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_receivable_client_name_snapshot()
  from public, anon, authenticated;

create trigger receivables_sync_client_name_snapshot
before insert or update on public.receivables
for each row execute function public.sync_receivable_client_name_snapshot();

-- ------------------------------------------------------------------- rls

drop policy "receivables_insert_own" on public.receivables;
create policy "receivables_insert_own"
on public.receivables for insert to authenticated
with check (
  owner_id = auth.uid()
  and (
    client_id is null
    or exists (
      select 1 from public.clients
       where clients.id = receivables.client_id and clients.owner_id = auth.uid()
    )
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents
       where documents.id = receivables.document_id and documents.owner_id = auth.uid()
    )
  )
);

drop policy "receivables_update_own" on public.receivables;
create policy "receivables_update_own"
on public.receivables for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and (
    client_id is null
    or exists (
      select 1 from public.clients
       where clients.id = receivables.client_id and clients.owner_id = auth.uid()
    )
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents
       where documents.id = receivables.document_id and documents.owner_id = auth.uid()
    )
  )
);

-- ------------------------------------------------------------- activity

-- "Cliente cambiado" también debe registrarse cuando cambia el nombre libre
-- (client_id sigue nulo, pero el nombre visible es otro), no solo cuando
-- cambia client_id.
create or replace function public.record_receivable_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id);
begin
  if (tg_op = 'INSERT') then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (new.id, new.owner_id, v_actor, 'receivable_created', '{}'::jsonb);
    return new;
  end if;

  -- Cambio de cliente (registrado o nombre libre).
  if (new.client_id is distinct from old.client_id
      or new.client_name_snapshot is distinct from old.client_name_snapshot) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (new.id, new.owner_id, v_actor, 'receivable_client_changed', '{}'::jsonb);
  end if;

  -- Enlace / desenlace de Escritura.
  if (new.document_id is distinct from old.document_id) then
    if (old.document_id is null) then
      insert into public.receivable_activity
        (receivable_id, owner_id, actor_user_id, event_type, metadata)
      values (new.id, new.owner_id, v_actor, 'receivable_document_linked', '{}'::jsonb);
    elsif (new.document_id is null) then
      insert into public.receivable_activity
        (receivable_id, owner_id, actor_user_id, event_type, metadata)
      values (new.id, new.owner_id, v_actor, 'receivable_document_unlinked', '{}'::jsonb);
    else
      insert into public.receivable_activity
        (receivable_id, owner_id, actor_user_id, event_type, metadata)
      values (new.id, new.owner_id, v_actor, 'receivable_document_linked', '{}'::jsonb);
    end if;
  end if;

  -- Cambio de monto.
  if (new.amount_total is distinct from old.amount_total) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (new.id, new.owner_id, v_actor, 'receivable_amount_changed',
      jsonb_build_object('previous', old.amount_total, 'new', new.amount_total));
  end if;

  -- Cambio de vencimiento.
  if (new.due_at is distinct from old.due_at) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (new.id, new.owner_id, v_actor, 'receivable_due_date_changed', '{}'::jsonb);
  end if;

  -- Otros cambios editables (concepto/notas): un único evento genérico.
  if (new.concept is distinct from old.concept
      or new.notes is distinct from old.notes
      or new.currency is distinct from old.currency
      or new.issued_at is distinct from old.issued_at) then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (new.id, new.owner_id, v_actor, 'receivable_updated', '{}'::jsonb);
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------ view

-- El nombre visible ya no requiere unir con clients: viene siempre del
-- snapshot (registrado o libre), así que la vista deja de exigir un
-- Cliente. client_id se conserva solo para navegación cuando existe.
--
-- `create or replace view` no admite reordenar ni renombrar columnas de
-- salida existentes (solo agregar al final), así que se conserva
-- exactamente el mismo orden que la definición anterior.
create or replace view public.receivable_entries
with (security_invoker = on)
as
select
  r.id,
  r.owner_id,
  r.client_id,
  r.document_id,
  r.concept,
  r.currency,
  r.amount_total,
  r.issued_at,
  r.due_at,
  r.created_at,
  r.updated_at,
  r.client_name_snapshot as client_name,
  d.title as document_title,
  coalesce(pay.paid, 0)::numeric(14, 2) as paid_amount,
  greatest(r.amount_total - coalesce(pay.paid, 0), 0)::numeric(14, 2) as balance_due,
  case
    when coalesce(pay.paid, 0) >= r.amount_total then 'paid'
    when r.due_at is not null
      and r.due_at < (now() at time zone 'America/Costa_Rica')::date
      and r.amount_total > coalesce(pay.paid, 0) then 'overdue'
    when coalesce(pay.paid, 0) > 0 then 'partial'
    else 'pending'
  end as status
from public.receivables r
left join public.documents d on d.id = r.document_id and d.owner_id = r.owner_id
left join (
  select receivable_id, sum(amount) as paid
  from public.receivable_payments
  where status = 'active'
  group by receivable_id
) pay on pay.receivable_id = r.id;

comment on view public.receivable_entries is
  'Cuentas por cobrar con saldo y estado derivados (paid > overdue > partial > pending), sumando pagos activos. El nombre del cliente viene siempre del snapshot (registrado o libre). security_invoker respeta RLS.';
