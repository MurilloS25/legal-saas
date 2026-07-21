-- Strengthen the existing 1:1 notarial metadata model. No generated files or
-- full escritura text are stored.

drop view public.notarial_index_entries;

do $$
begin
  if exists (
    select 1
    from public.document_notarial_metadata
    where instrument_number is not null
      and btrim(instrument_number) <> ''
      and btrim(instrument_number) !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'non-numeric legacy instrument_number values must be corrected before migration';
  end if;
end;
$$;

alter table public.document_notarial_metadata
  drop constraint dnm_instrument_number_length_check,
  drop constraint dnm_act_type_length_check,
  drop constraint dnm_book_reference_length_check,
  drop constraint dnm_folio_reference_length_check,
  drop constraint dnm_appearing_parties_summary_length_check;

alter table public.document_notarial_metadata
  alter column instrument_number type integer
    using nullif(btrim(instrument_number), '')::integer;

alter table public.document_notarial_metadata
  rename column book_reference to protocol_book;

alter table public.document_notarial_metadata
  rename column folio_reference to initial_folio;

alter table public.document_notarial_metadata
  add column final_folio text,
  add column act_name_snapshot text,
  add column act_name_override text,
  add column generated_parties text,
  add column parties_override text,
  add column version integer not null default 1;

update public.document_notarial_metadata
set final_folio = initial_folio,
    act_name_override = nullif(btrim(act_type), ''),
    parties_override = nullif(btrim(appearing_parties_summary), '');

update public.document_notarial_metadata m
set act_name_snapshot = t.name
from public.documents d
join public.templates t
  on t.id = d.template_id and t.owner_id = d.owner_id
where d.id = m.document_id
  and d.owner_id = m.owner_id
  and m.act_name_snapshot is null;

alter table public.document_notarial_metadata
  drop column act_type,
  drop column appearing_parties_summary,
  add constraint dnm_instrument_number_positive_check
    check (instrument_number is null or instrument_number > 0),
  add constraint dnm_protocol_book_length_check
    check (protocol_book is null or (char_length(btrim(protocol_book)) between 1 and 120)),
  add constraint dnm_initial_folio_length_check
    check (initial_folio is null or (char_length(btrim(initial_folio)) between 1 and 120)),
  add constraint dnm_final_folio_length_check
    check (final_folio is null or (char_length(btrim(final_folio)) between 1 and 120)),
  add constraint dnm_act_name_snapshot_length_check
    check (act_name_snapshot is null or (char_length(btrim(act_name_snapshot)) between 1 and 200)),
  add constraint dnm_act_name_override_length_check
    check (act_name_override is null or (char_length(btrim(act_name_override)) between 1 and 200)),
  add constraint dnm_generated_parties_length_check
    check (generated_parties is null or (char_length(btrim(generated_parties)) between 1 and 2000)),
  add constraint dnm_parties_override_length_check
    check (parties_override is null or (char_length(btrim(parties_override)) between 1 and 2000)),
  add constraint dnm_version_positive_check check (version > 0);

create unique index dnm_owner_year_instrument_key
on public.document_notarial_metadata (
  owner_id,
  extract(year from (authorized_at at time zone 'America/Costa_Rica')),
  instrument_number
)
where authorized_at is not null and instrument_number is not null;

create index dnm_owner_authorized_idx
on public.document_notarial_metadata (owner_id, authorized_at);

create or replace function public.enforce_notarial_metadata_editable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
    and (
      new.document_id is distinct from old.document_id
      or new.owner_id is distinct from old.owner_id
    )
  then
    raise exception 'notarial metadata ownership and document link cannot be changed'
      using errcode = 'check_violation';
  end if;

  if auth.uid() is null or auth.uid() <> new.owner_id then
    raise exception 'notarial metadata owner must match authenticated user'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.owner_id = auth.uid()
  ) then
    raise exception 'document does not belong to authenticated user'
      using errcode = 'foreign_key_violation';
  end if;

  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notarial_metadata_editable()
  from public, anon, authenticated;

create or replace function public.record_notarial_metadata_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_changed text[] := array[]::text[];
  v_was_complete boolean;
  v_is_complete boolean;
begin
  if v_actor is null or v_actor <> new.owner_id then
    raise exception 'authenticated actor required'
      using errcode = 'insufficient_privilege';
  end if;

  v_is_complete :=
    new.instrument_number is not null
    and new.authorized_at is not null
    and coalesce(btrim(new.protocol_book), '') <> ''
    and coalesce(btrim(new.initial_folio), '') <> ''
    and coalesce(btrim(new.final_folio), '') <> ''
    and coalesce(btrim(coalesce(new.act_name_override, new.act_name_snapshot)), '') <> ''
    and coalesce(btrim(coalesce(new.parties_override, new.generated_parties)), '') <> '';

  if tg_op = 'INSERT' then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, v_actor, 'notarial_metadata_created',
            'Datos para índice creados', '{}'::jsonb);
    if v_is_complete then
      insert into public.document_activity
        (document_id, owner_id, actor_user_id, event_type, summary, metadata)
      values (new.document_id, new.owner_id, v_actor,
              'notarial_metadata_completed', 'Datos para índice completos', '{}'::jsonb);
    end if;
    return new;
  end if;

  if new.instrument_number is distinct from old.instrument_number then v_changed := array_append(v_changed, 'instrument_number'); end if;
  if new.authorized_at is distinct from old.authorized_at then v_changed := array_append(v_changed, 'authorized_at'); end if;
  if new.protocol_book is distinct from old.protocol_book then v_changed := array_append(v_changed, 'protocol_book'); end if;
  if new.initial_folio is distinct from old.initial_folio then v_changed := array_append(v_changed, 'initial_folio'); end if;
  if new.final_folio is distinct from old.final_folio then v_changed := array_append(v_changed, 'final_folio'); end if;
  if new.act_name_snapshot is distinct from old.act_name_snapshot then v_changed := array_append(v_changed, 'act_name_snapshot'); end if;
  if new.act_name_override is distinct from old.act_name_override then v_changed := array_append(v_changed, 'act_name_override'); end if;
  if new.generated_parties is distinct from old.generated_parties then v_changed := array_append(v_changed, 'generated_parties'); end if;
  if new.parties_override is distinct from old.parties_override then v_changed := array_append(v_changed, 'parties_override'); end if;
  if new.notes is distinct from old.notes then v_changed := array_append(v_changed, 'notes'); end if;
  if array_length(v_changed, 1) is null then return new; end if;

  insert into public.document_activity
    (document_id, owner_id, actor_user_id, event_type, summary, metadata)
  values (new.document_id, new.owner_id, v_actor, 'notarial_metadata_updated',
          'Datos para índice actualizados',
          pg_catalog.jsonb_build_object('changedFields', pg_catalog.to_jsonb(v_changed)));

  v_was_complete :=
    old.instrument_number is not null
    and old.authorized_at is not null
    and coalesce(btrim(old.protocol_book), '') <> ''
    and coalesce(btrim(old.initial_folio), '') <> ''
    and coalesce(btrim(old.final_folio), '') <> ''
    and coalesce(btrim(coalesce(old.act_name_override, old.act_name_snapshot)), '') <> ''
    and coalesce(btrim(coalesce(old.parties_override, old.generated_parties)), '') <> '';

  if v_is_complete and not v_was_complete then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, v_actor,
            'notarial_metadata_completed', 'Datos para índice completos', '{}'::jsonb);
  elsif v_was_complete and not v_is_complete then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, v_actor,
            'notarial_metadata_marked_incomplete',
            'Datos para índice marcados como incompletos', '{}'::jsonb);
  end if;

  return new;
end;
$$;

revoke all on function public.record_notarial_metadata_activity()
  from public, anon, authenticated;

create view public.notarial_index_entries
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
  coalesce(nullif(btrim(m.act_name_override), ''), m.act_name_snapshot) as act_name,
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
    and coalesce(btrim(coalesce(m.act_name_override, m.act_name_snapshot)), '') <> ''
    and coalesce(btrim(coalesce(m.parties_override, m.generated_parties)), '') <> ''
  ) as is_complete
from public.documents d
left join public.document_notarial_metadata m
  on m.document_id = d.id and m.owner_id = d.owner_id
left join public.clients c
  on c.id = d.client_id and c.owner_id = d.owner_id
where d.status = 'final';

comment on view public.notarial_index_entries is
  'Owner-scoped finalized escrituras with structured notarial metadata, snapshots, overrides, fortnight and derived completeness.';

comment on index public.dnm_owner_year_instrument_key is
  'Prevents duplicate positive instrument numbers for one lawyer in the same Costa Rica calendar year.';
