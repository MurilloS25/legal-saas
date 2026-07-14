-- Totales por moneda de las cuentas por cobrar, calculados en el servidor
-- sobre TODOS los resultados que cumplen los filtros (no solo la página).
--
-- Nunca se suman monedas distintas: el resultado viene agrupado por moneda.
-- La función es SECURITY INVOKER: consulta la vista receivable_entries, cuya
-- RLS (security_invoker) ya restringe a las filas del propio usuario. Los
-- mismos filtros del listado se aplican aquí para que los totales coincidan
-- exactamente con lo que se ve.

create or replace function public.receivables_summary(
  p_search text default null,
  p_status text default null,
  p_client uuid default null,
  p_document uuid default null,
  p_doc_presence text default null,
  p_currency text default null,
  p_issued_from date default null,
  p_issued_to date default null,
  p_due_from date default null,
  p_due_to date default null
)
returns table (
  currency text,
  count bigint,
  total numeric,
  paid numeric,
  balance numeric
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    e.currency,
    count(*)::bigint,
    coalesce(sum(e.amount_total), 0)::numeric(14, 2),
    coalesce(sum(e.paid_amount), 0)::numeric(14, 2),
    coalesce(sum(e.balance_due), 0)::numeric(14, 2)
  from public.receivable_entries e
  where e.owner_id = auth.uid()
    and (p_status is null or e.status = p_status)
    and (p_client is null or e.client_id = p_client)
    and (p_document is null or e.document_id = p_document)
    and (p_currency is null or e.currency = p_currency)
    and (
      p_doc_presence is null
      or (p_doc_presence = 'with' and e.document_id is not null)
      or (p_doc_presence = 'without' and e.document_id is null)
    )
    and (p_issued_from is null or e.issued_at >= p_issued_from)
    and (p_issued_to is null or e.issued_at <= p_issued_to)
    and (p_due_from is null or e.due_at >= p_due_from)
    and (p_due_to is null or e.due_at <= p_due_to)
    and (
      p_search is null
      or e.concept ilike '%' || p_search || '%'
      or e.client_name ilike '%' || p_search || '%'
      or coalesce(e.document_title, '') ilike '%' || p_search || '%'
    )
  group by e.currency
  order by e.currency;
$$;

comment on function public.receivables_summary is
  'Totales por moneda (cantidad, total, pagado, saldo) de las cuentas por cobrar del usuario que cumplen los filtros. Nunca mezcla monedas.';

revoke all on function public.receivables_summary(
  text, text, uuid, uuid, text, text, date, date, date, date
) from public, anon;
grant execute on function public.receivables_summary(
  text, text, uuid, uuid, text, text, date, date, date, date
) to authenticated;
