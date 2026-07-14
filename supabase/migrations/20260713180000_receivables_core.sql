-- Cuentas por cobrar (receivables) — modelo principal.
--
-- El esquema inicial creó una tabla `receivables` de andamiaje, nunca usada
-- por el código, con un modelo distinto (status almacenado,
-- document_metadata_id). Se reemplaza por el modelo operativo de esta
-- iteración. Al no existir referencias, el reemplazo es seguro; se documenta
-- como decisión explícita.
--
-- Reglas:
-- * client_id obligatorio; document_id opcional; ambos del mismo owner.
-- * Varias cuentas por Escritura (sin UNIQUE(document_id)).
-- * amount_total numeric(14,2) > 0; moneda CRC/USD (sin conversión).
-- * issued_at date; due_at opcional y no anterior a issued_at.
-- * El estado (pending/partial/paid/overdue) se DERIVA en la vista, nunca se
--   almacena ni se acepta del cliente.
-- * notes internas (no exportables por defecto).

drop table if exists public.receivables cascade;

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  document_id uuid,
  concept text not null,
  currency text not null,
  amount_total numeric(14, 2) not null,
  issued_at date not null default (now() at time zone 'America/Costa_Rica')::date,
  due_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivables_client_owner_fk
    foreign key (client_id, owner_id)
    references public.clients(id, owner_id),
  constraint receivables_document_owner_fk
    foreign key (document_id, owner_id)
    references public.documents(id, owner_id)
    on delete set null (document_id),
  constraint receivables_id_owner_id_key unique (id, owner_id),
  constraint receivables_amount_positive check (amount_total > 0),
  constraint receivables_currency_check check (currency in ('CRC', 'USD')),
  constraint receivables_concept_not_blank check (btrim(concept) <> ''),
  constraint receivables_due_after_issued check (
    due_at is null or due_at >= issued_at
  )
);

comment on table public.receivables is
  'Cuentas por cobrar del abogado. Estado y saldo se derivan (vista receivable_entries); no son una factura fiscal.';

create index receivables_owner_id_idx on public.receivables (owner_id);
create index receivables_client_id_idx on public.receivables (client_id);
create index receivables_document_id_idx on public.receivables (document_id);
create index receivables_owner_created_idx
  on public.receivables (owner_id, created_at desc);

create trigger receivables_set_updated_at
before update on public.receivables
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ activity

create table public.receivable_activity (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint ra_receivable_owner_fk
    foreign key (receivable_id, owner_id)
    references public.receivables(id, owner_id)
    on delete cascade,
  constraint ra_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint ra_event_type_not_blank check (btrim(event_type) <> '')
);

comment on table public.receivable_activity is
  'Historial operativo inmutable de una cuenta por cobrar. Escrito solo por trigger/RPC SECURITY DEFINER; sin UPDATE/DELETE.';

create index ra_receivable_created_idx
  on public.receivable_activity (receivable_id, created_at desc, id desc);
create index ra_owner_created_idx
  on public.receivable_activity (owner_id, created_at desc);

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

  -- Cambio de cliente.
  if (new.client_id is distinct from old.client_id) then
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

-- Solo el trigger (dueño de la función) la ejecuta; nadie la invoca directo.
revoke all on function public.record_receivable_activity()
  from public, anon, authenticated;

create trigger receivables_record_activity
after insert or update on public.receivables
for each row execute function public.record_receivable_activity();

-- ------------------------------------------------------------------ view

-- Modelo de lectura con saldo y estado derivados. En esta rama no existen
-- pagos, así que paid_amount = 0; la rama de pagos reemplaza la definición.
-- security_invoker = on: respeta la RLS del usuario que consulta.
create view public.receivable_entries
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
  c.full_name as client_name,
  d.title as document_title,
  0::numeric(14, 2) as paid_amount,
  r.amount_total as balance_due,
  case
    when 0 >= r.amount_total then 'paid'
    when r.due_at is not null
      and r.due_at < (now() at time zone 'America/Costa_Rica')::date
      and r.amount_total > 0 then 'overdue'
    else 'pending'
  end as status
from public.receivables r
join public.clients c on c.id = r.client_id and c.owner_id = r.owner_id
left join public.documents d on d.id = r.document_id and d.owner_id = r.owner_id;

comment on view public.receivable_entries is
  'Cuentas por cobrar con saldo y estado derivados (paid > overdue > partial > pending). security_invoker respeta RLS.';

-- ------------------------------------------------------------------ rls

alter table public.receivables enable row level security;

create policy "receivables_select_own"
on public.receivables for select to authenticated
using (owner_id = auth.uid());

create policy "receivables_insert_own"
on public.receivables for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.clients
     where clients.id = receivables.client_id and clients.owner_id = auth.uid()
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents
       where documents.id = receivables.document_id and documents.owner_id = auth.uid()
    )
  )
);

create policy "receivables_update_own"
on public.receivables for update to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.clients
     where clients.id = receivables.client_id and clients.owner_id = auth.uid()
  )
  and (
    document_id is null
    or exists (
      select 1 from public.documents
       where documents.id = receivables.document_id and documents.owner_id = auth.uid()
    )
  )
);

create policy "receivables_delete_own"
on public.receivables for delete to authenticated
using (owner_id = auth.uid());

alter table public.receivable_activity enable row level security;

create policy "ra_select_own"
on public.receivable_activity for select to authenticated
using (owner_id = auth.uid());
-- Sin INSERT/UPDATE/DELETE: escritura solo vía trigger/RPC SECURITY DEFINER.
