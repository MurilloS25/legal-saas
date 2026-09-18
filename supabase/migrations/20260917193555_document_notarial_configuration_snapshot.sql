-- New Escrituras store the notarial configuration inside the existing,
-- immutable `documents.template_snapshot` envelope (version 2). The view must
-- prefer that historical Machote name before consulting the mutable template
-- row. Version-1/legacy documents retain the previous fallback because no
-- exact historical notarial configuration exists for them.

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
  coalesce(
    nullif(btrim(m.act_name_override), ''),
    m.act_name_snapshot,
    nullif(btrim(d.template_snapshot #>> '{notarial,templateName}'), ''),
    t.name
  ) as act_name,
  m.generated_parties,
  m.parties_override,
  coalesce(nullif(btrim(m.parties_override), ''), m.generated_parties) as parties,
  m.version,
  extract(year from (coalesce(m.authorized_at, d.created_at) at time zone 'America/Costa_Rica'))::integer as period_year,
  extract(month from (coalesce(m.authorized_at, d.created_at) at time zone 'America/Costa_Rica'))::integer as period_month,
  case
    when extract(day from (coalesce(m.authorized_at, d.created_at) at time zone 'America/Costa_Rica')) between 1 and 15 then 'FIRST_HALF'
    else 'SECOND_HALF'
  end as period_half,
  (m.document_id is not null) as has_metadata,
  (
    m.instrument_number is not null
    and m.authorized_at is not null
    and coalesce(btrim(m.protocol_book), '') <> ''
    and coalesce(btrim(m.initial_folio), '') <> ''
    and coalesce(btrim(m.final_folio), '') <> ''
    and coalesce(btrim(coalesce(
      m.act_name_override,
      m.act_name_snapshot,
      d.template_snapshot #>> '{notarial,templateName}',
      t.name
    )), '') <> ''
    and coalesce(btrim(coalesce(m.parties_override, m.generated_parties)), '') <> ''
  ) as is_complete,
  d.workspace_id,
  coalesce(m.authorized_at, d.created_at) as effective_index_date,
  m.notarial_confirmed_at,
  m.notarial_review_required
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.workspace_id = d.workspace_id
left join public.clients c
  on c.id = d.client_id and c.workspace_id = d.workspace_id
left join public.templates t
  on t.id = d.template_id and t.workspace_id = d.workspace_id
where d.status = 'final' and d.include_in_notarial_index = true;

comment on view public.notarial_index_entries is
  'Finalized included Escrituras. Act name prefers the immutable document notarial snapshot for version-2 documents; legacy rows fall back to the current template only when no historical value exists. security_invoker preserves RLS.';
