-- Inmutabilidad financiera de Cuentas por cobrar.
--
-- Una vez que existe CUALQUIER pago histórico (activo o anulado) para una
-- cuenta, el monto, la moneda, el Cliente (registrado o nombre libre) y la
-- Escritura relacionada quedan bloqueados de forma permanente. Un pago
-- anulado NO libera el bloqueo: el pago existió y afectó la operación real,
-- así que la cuenta ya no puede tratarse como si nunca hubiera tenido
-- movimiento financiero. Solo vencimiento, concepto y notas siguen editables.
--
-- Esto reemplaza los dos chequeos puntuales que ya vivían en este mismo
-- trigger (moneda bloqueada tras CUALQUIER pago; monto no podía bajar del
-- pagado activo) por una regla unificada y más estricta: ahora el monto
-- también queda completamente bloqueado tras cualquier pago, no solo por
-- debajo de lo pagado activo.

create or replace function public.enforce_receivable_payment_consistency()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment_count bigint;
begin
  if (tg_op = 'DELETE') then
    select count(*) into v_payment_count
      from public.receivable_payments
     where receivable_id = old.id
       and status = 'active';

    if v_payment_count > 0 then
      raise exception 'receivable with active payments cannot be deleted'
        using errcode = '23514';
    end if;

    return old;
  end if;

  select count(*) into v_payment_count
    from public.receivable_payments
   where receivable_id = new.id;

  if v_payment_count > 0 then
    if new.amount_total is distinct from old.amount_total then
      raise exception 'receivable amount cannot change once payment history exists'
        using errcode = '23514';
    end if;

    if new.currency is distinct from old.currency then
      raise exception 'receivable currency cannot change once payment history exists'
        using errcode = '23514';
    end if;

    if new.client_id is distinct from old.client_id then
      raise exception 'receivable client cannot change once payment history exists'
        using errcode = '23514';
    end if;

    -- Nombre libre (client_id nulo en ambos lados): el texto visible
    -- también cuenta como "Cliente" para efectos de esta regla. Cuando
    -- client_id no es nulo, el snapshot lo sincroniza siempre
    -- `sync_receivable_client_name_snapshot` desde el nombre vigente del
    -- Cliente — no se compara aquí para no bloquear un guardado legítimo
    -- solo porque el nombre del Cliente cambió en otro lugar.
    if new.client_id is null
      and new.client_name_snapshot is distinct from old.client_name_snapshot then
      raise exception 'receivable client cannot change once payment history exists'
        using errcode = '23514';
    end if;

    if new.document_id is distinct from old.document_id then
      raise exception 'receivable document cannot change once payment history exists'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_receivable_payment_consistency()
  from public, anon, authenticated;
