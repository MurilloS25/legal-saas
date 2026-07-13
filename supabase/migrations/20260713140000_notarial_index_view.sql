-- Vista de lectura del índice notarial interno.
--
-- Une las Escrituras FINALIZADAS con su metadata notarial (left join, para no
-- ocultar las finales sin metadata) y deriva la completitud. Es solo un modelo
-- de lectura para el workspace; no altera datos.
--
-- security_invoker = on (PG15+): la vista se ejecuta con los permisos y RLS del
-- usuario que consulta, así que cada quien solo ve sus propias Escrituras. SIN
-- esta opción la vista correría como su dueño y filtraría datos ajenos.

create view public.notarial_index_entries
with (security_invoker = on)
as
select
  d.id as document_id,
  d.owner_id,
  d.title,
  d.updated_at,
  c.full_name as client_name,
  m.instrument_number,
  m.authorized_at,
  m.act_type,
  m.book_reference,
  m.folio_reference,
  m.appearing_parties_summary,
  (m.document_id is not null) as has_metadata,
  (
    coalesce(btrim(m.instrument_number), '') <> ''
    and m.authorized_at is not null
    and coalesce(btrim(m.act_type), '') <> ''
  ) as is_complete
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.owner_id = d.owner_id
left join public.clients c
  on c.id = d.client_id and c.owner_id = d.owner_id
where d.status = 'final';

comment on view public.notarial_index_entries is
  'Modelo de lectura del índice notarial interno: Escrituras finalizadas con su metadata y completitud derivada. Vista interna de organización; no es el índice oficial.';
