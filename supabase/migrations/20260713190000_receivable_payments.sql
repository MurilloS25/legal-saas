-- Pagos de cuentas por cobrar (receivable_payments) + RPCs atómicos.
--
-- Un pago abona a una cuenta por cobrar en su misma moneda (sin conversión).
-- El registro y la anulación de pagos ocurren SOLO vía funciones
-- SECURITY DEFINER que bloquean la cuenta (FOR UPDATE), validan propiedad,
-- monto y sobrepago, y registran actividad en la misma transacción. No hay
-- INSERT/UPDATE/DELETE directos desde el navegador: así se evitan carreras de
-- concurrencia, sobrepagos y dobles anulaciones.
--
-- saldo y estado siguen derivándose en la vista receivable_entries, ahora
-- sumando los pagos activos.

create table public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null,
  paid_at date not null default (now() at time zone 'America/Costa_Rica')::date,
  method text not null,
  reference text,
  status text not null default 'active',
  voided_at timestamptz,
  void_reason text,
  voided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rp_receivable_owner_fk
    foreign key (receivable_id, owner_id)
    references public.receivables(id, owner_id)
    on delete cascade,
  constraint rp_amount_positive check (amount > 0),
  constraint rp_currency_check check (currency in ('CRC', 'USD')),
  constraint rp_method_check
    check (method in ('cash', 'bank_transfer', 'sinpe', 'card', 'other')),
  constraint rp_status_check check (status in ('active', 'voided')),
  -- Coherencia de los campos de anulación con el estado.
  constraint rp_void_fields_consistent check (
    (status = 'active'
       and voided_at is null and void_reason is null and voided_by is null)
    or
    (status = 'voided'
       and voided_at is not null and btrim(void_reason) <> '' and voided_by is not null)
  )
);

comment on table public.receivable_payments is
  'Pagos aplicados a una cuenta por cobrar (misma moneda). Escritos solo vía RPC SECURITY DEFINER; la anulación conserva la fila (status=voided).';

create index rp_receivable_idx on public.receivable_payments (receivable_id);
create index rp_receivable_active_idx
  on public.receivable_payments (receivable_id) where status = 'active';
create index rp_owner_created_idx
  on public.receivable_payments (owner_id, created_at desc);

create trigger receivable_payments_set_updated_at
before update on public.receivable_payments
for each row execute function public.set_updated_at();

alter table public.receivable_payments enable row level security;

-- Solo lectura de los propios pagos. Sin INSERT/UPDATE/DELETE: la escritura
-- ocurre únicamente vía las RPC definer de más abajo.
create policy "rp_select_own"
on public.receivable_payments for select to authenticated
using (owner_id = auth.uid());

-- ------------------------------------------------------------------ view

-- Se redefine la vista para sumar los pagos activos. Mantiene exactamente las
-- mismas columnas y tipos que la rama anterior (la capa TS no cambia).
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
  c.full_name as client_name,
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
join public.clients c on c.id = r.client_id and c.owner_id = r.owner_id
left join public.documents d on d.id = r.document_id and d.owner_id = r.owner_id
left join (
  select receivable_id, sum(amount) as paid
  from public.receivable_payments
  where status = 'active'
  group by receivable_id
) pay on pay.receivable_id = r.id;

comment on view public.receivable_entries is
  'Cuentas por cobrar con saldo y estado derivados (paid > overdue > partial > pending), sumando pagos activos. security_invoker respeta RLS.';

-- ------------------------------------------------------- register payment RPC

create or replace function public.register_receivable_payment(
  p_receivable_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_method text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_rec public.receivables%rowtype;
  v_paid numeric(14, 2);
  v_amount numeric(14, 2);
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Bloquea la cuenta para serializar registros/anulaciones concurrentes.
  select * into v_rec
    from public.receivables
   where id = p_receivable_id and owner_id = v_uid
   for update;

  if not found then
    raise exception 'receivable not found' using errcode = 'P0002';
  end if;

  v_amount := round(p_amount, 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22003';
  end if;
  if p_method is null
     or p_method not in ('cash', 'bank_transfer', 'sinpe', 'card', 'other') then
    raise exception 'invalid method' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from public.receivable_payments
   where receivable_id = p_receivable_id and status = 'active';

  if v_paid + v_amount > v_rec.amount_total then
    raise exception 'payment exceeds balance' using errcode = '23514';
  end if;

  insert into public.receivable_payments
    (receivable_id, owner_id, amount, currency, paid_at, method, reference)
  values (
    p_receivable_id, v_uid, v_amount, v_rec.currency,
    coalesce(p_paid_at, (now() at time zone 'America/Costa_Rica')::date),
    p_method, nullif(btrim(p_reference), '')
  )
  returning id into v_payment_id;

  insert into public.receivable_activity
    (receivable_id, owner_id, actor_user_id, event_type, metadata)
  values (p_receivable_id, v_uid, v_uid, 'payment_registered',
    jsonb_build_object('amount', v_amount, 'payment_id', v_payment_id));

  -- Si el pago salda la cuenta, se registra el hito.
  if v_paid + v_amount >= v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (p_receivable_id, v_uid, v_uid, 'receivable_paid', '{}'::jsonb);
  end if;

  return v_payment_id;
end;
$$;

revoke all on function
  public.register_receivable_payment(uuid, numeric, date, text, text)
  from public, anon, authenticated;
grant execute on function
  public.register_receivable_payment(uuid, numeric, date, text, text)
  to authenticated;

-- ---------------------------------------------------------- void payment RPC

create or replace function public.void_receivable_payment(
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_rec public.receivables%rowtype;
  v_payment public.receivable_payments%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_was_paid boolean;
  v_paid_after numeric(14, 2);
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_reason is null then
    raise exception 'void reason is required' using errcode = '22023';
  end if;

  -- Ubica el pago del propio usuario.
  select * into v_payment
    from public.receivable_payments
   where id = p_payment_id and owner_id = v_uid;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  -- Bloquea la cuenta (serializa con register y con otras anulaciones).
  select * into v_rec
    from public.receivables
   where id = v_payment.receivable_id and owner_id = v_uid
   for update;

  -- Re-lee el pago ya con el lock de la cuenta para evitar doble anulación.
  select * into v_payment
    from public.receivable_payments
   where id = p_payment_id and owner_id = v_uid
   for update;

  if v_payment.status = 'voided' then
    raise exception 'payment already voided' using errcode = '23514';
  end if;

  -- ¿La cuenta estaba saldada antes de anular este pago?
  select coalesce(sum(amount), 0) >= v_rec.amount_total into v_was_paid
    from public.receivable_payments
   where receivable_id = v_rec.id and status = 'active';

  update public.receivable_payments
     set status = 'voided',
         voided_at = now(),
         void_reason = v_reason,
         voided_by = v_uid
   where id = p_payment_id;

  insert into public.receivable_activity
    (receivable_id, owner_id, actor_user_id, event_type, metadata)
  values (v_rec.id, v_uid, v_uid, 'payment_voided',
    jsonb_build_object('amount', v_payment.amount, 'payment_id', p_payment_id));

  select coalesce(sum(amount), 0) into v_paid_after
    from public.receivable_payments
   where receivable_id = v_rec.id and status = 'active';

  -- Si la cuenta estaba saldada y la anulación la deja con saldo, se reabre.
  if v_was_paid and v_paid_after < v_rec.amount_total then
    insert into public.receivable_activity
      (receivable_id, owner_id, actor_user_id, event_type, metadata)
    values (v_rec.id, v_uid, v_uid, 'receivable_reopened_after_void', '{}'::jsonb);
  end if;
end;
$$;

revoke all on function public.void_receivable_payment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.void_receivable_payment(uuid, text) to authenticated;
