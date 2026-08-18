-- Corrige una inconsistencia real entre las tres superficies del Índice
-- Notarial (listado, export Word, paso Índice de la Escritura): cuando una
-- Escritura finalizada nunca tuvo su metadata notarial guardada ni una sola
-- vez, `document_notarial_metadata` no tiene fila y `act_name_snapshot`
-- queda NULL para siempre en la vista — mostrando "Sin configurar" en el
-- listado y en el export, aunque el nombre del machote (`templates.name`)
-- es una fuente ya establecida y usada consistentemente en otros dos
-- lugares del producto:
--   - `saveNotarialMetadataAction` (metadata-actions.ts) ya usa
--     `document.templates?.name` como fallback al persistir
--     `act_name_snapshot` la primera vez que se guarda el paso Índice.
--   - El paso Índice en el cliente (`resolveNotarialMetadataPrefill`,
--     prefill.ts) ya muestra `actNamePreview = template.name` como
--     "Acto o contrato" antes de cualquier guardado, y ya lo cuenta como
--     "Configurado" en su resumen de completitud.
-- Esta migración no inventa una regla nueva: extiende al listado/export la
-- misma regla que el guardado y el paso Índice ya aplican, agregando el
-- fallback al nombre del machote también en `is_complete` para que las tres
-- superficies compartan la misma semántica de "Acto o contrato configurado".
create or replace view public.notarial_index_entries
with (security_invoker = on)
as
select
  d.id as document_id,
  d.owner_id,
  d.title,
  d.updated_at,
  d.template_id,
  c.full_name as client_name,
  m.instrument_number,
  m.authorized_at,
  m.protocol_book,
  m.initial_folio,
  m.final_folio,
  m.act_name_snapshot,
  m.act_name_override,
  coalesce(nullif(btrim(m.act_name_override), ''), m.act_name_snapshot, t.name) as act_name,
  m.generated_parties,
  m.parties_override,
  coalesce(nullif(btrim(m.parties_override), ''), m.generated_parties) as parties,
  m.version,
  extract(year from (m.authorized_at at time zone 'America/Costa_Rica'))::integer as period_year,
  extract(month from (m.authorized_at at time zone 'America/Costa_Rica'))::integer as period_month,
  case
    when extract(day from (m.authorized_at at time zone 'America/Costa_Rica')) between 1 and 15 then 'FIRST_HALF'
    when m.authorized_at is not null then 'SECOND_HALF'
    else null
  end as period_half,
  (m.document_id is not null) as has_metadata,
  (
    m.instrument_number is not null
    and m.authorized_at is not null
    and coalesce(btrim(m.protocol_book), '') <> ''
    and coalesce(btrim(m.initial_folio), '') <> ''
    and coalesce(btrim(m.final_folio), '') <> ''
    and coalesce(btrim(coalesce(m.act_name_override, m.act_name_snapshot, t.name)), '') <> ''
    and coalesce(btrim(coalesce(m.parties_override, m.generated_parties)), '') <> ''
  ) as is_complete,
  d.workspace_id
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.workspace_id = d.workspace_id
left join public.clients c
  on c.id = d.client_id and c.workspace_id = d.workspace_id
left join public.templates t
  on t.id = d.template_id and t.workspace_id = d.workspace_id
where d.status = 'final';

comment on view public.notarial_index_entries is
  'Escrituras finalizadas con su metadata notarial (LEFT JOIN: nunca excluye por falta de metadata). act_name cae al nombre del machote cuando nunca se guardó el paso Índice, igual que ya hacen el guardado inicial y el prefill del cliente — is_complete considera ese fallback también "configurado". security_invoker respeta RLS.';
