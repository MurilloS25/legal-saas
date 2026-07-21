-- Metadata interna del índice notarial, uno-a-uno con cada Escritura.
--
-- Decisiones:
-- * Tabla separada (no columnas en documents): el índice es un módulo aparte
--   y no todas las escrituras tienen metadata.
-- * FK compuesta (document_id, owner_id) -> documents; UNIQUE(document_id)
--   fuerza la relación uno-a-uno.
-- * `instrument_number` es texto (puede llevar prefijos/guiones); no se asume
--   numérico. `authorized_at` es timestamptz (se muestra en America/Costa_Rica).
-- * `act_type` es texto libre: NO se inventa un catálogo legal.
-- * `notes` es interno y no se exporta por defecto.
-- * La completitud NO se almacena: se deriva (instrument_number + authorized_at
--   + act_type). "Completo" significa completo según los campos internos del
--   sistema, no validado legalmente.
-- * Edición bloqueada server-side y por trigger cuando la Escritura está
--   'final' (para corregir, reabrir la Escritura).
-- * La actividad se registra en document_activity vía trigger SECURITY DEFINER
--   (atómico), como el resto de eventos.

create table public.document_notarial_metadata (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  instrument_number text,
  authorized_at timestamptz,
  act_type text,
  book_reference text,
  folio_reference text,
  appearing_parties_summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dnm_document_owner_fk
    foreign key (document_id, owner_id)
    references public.documents(id, owner_id)
    on delete cascade,
  constraint dnm_document_id_key unique (document_id),
  constraint dnm_id_owner_id_key unique (id, owner_id),
  constraint dnm_instrument_number_length_check
    check (instrument_number is null or char_length(btrim(instrument_number)) <= 120),
  constraint dnm_act_type_length_check
    check (act_type is null or char_length(btrim(act_type)) <= 200),
  constraint dnm_book_reference_length_check
    check (book_reference is null or char_length(btrim(book_reference)) <= 120),
  constraint dnm_folio_reference_length_check
    check (folio_reference is null or char_length(btrim(folio_reference)) <= 120),
  constraint dnm_appearing_parties_summary_length_check
    check (appearing_parties_summary is null or char_length(btrim(appearing_parties_summary)) <= 2000),
  constraint dnm_notes_length_check
    check (notes is null or char_length(btrim(notes)) <= 2000)
);

comment on table public.document_notarial_metadata is
  'Metadata interna del índice notarial (1:1 con documents). Vista interna de organización; no es el índice oficial ni implica validez legal.';

create index dnm_owner_id_idx on public.document_notarial_metadata (owner_id);

create trigger dnm_set_updated_at
before update on public.document_notarial_metadata
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ block when final

create or replace function public.enforce_notarial_metadata_editable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
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

  select status into v_status
    from public.documents
   where id = new.document_id and owner_id = new.owner_id;

  if v_status = 'final' then
    raise exception 'notarial metadata is locked while the document is final'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notarial_metadata_editable()
  from public, anon, authenticated;

create trigger dnm_enforce_editable
before insert or update on public.document_notarial_metadata
for each row execute function public.enforce_notarial_metadata_editable();

-- ------------------------------------------------------------------ activity

create or replace function public.record_notarial_metadata_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id);
  v_changed text[] := array[]::text[];
  v_was_complete boolean;
  v_is_complete boolean;
begin
  v_is_complete :=
    coalesce(btrim(new.instrument_number), '') <> ''
    and new.authorized_at is not null
    and coalesce(btrim(new.act_type), '') <> '';

  if (tg_op = 'INSERT') then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, v_actor, 'notarial_metadata_created',
            'Datos para índice creados', '{}'::jsonb);

    if v_is_complete then
      insert into public.document_activity
        (document_id, owner_id, actor_user_id, event_type, summary, metadata)
      values (new.document_id, new.owner_id, v_actor,
              'notarial_metadata_completed', 'Datos para índice completos',
              '{}'::jsonb);
    end if;
    return new;
  end if;

  -- UPDATE: lista de campos que cambiaron.
  if (new.instrument_number is distinct from old.instrument_number)
    then v_changed := array_append(v_changed, 'instrument_number'); end if;
  if (new.authorized_at is distinct from old.authorized_at)
    then v_changed := array_append(v_changed, 'authorized_at'); end if;
  if (new.act_type is distinct from old.act_type)
    then v_changed := array_append(v_changed, 'act_type'); end if;
  if (new.book_reference is distinct from old.book_reference)
    then v_changed := array_append(v_changed, 'book_reference'); end if;
  if (new.folio_reference is distinct from old.folio_reference)
    then v_changed := array_append(v_changed, 'folio_reference'); end if;
  if (new.appearing_parties_summary is distinct from old.appearing_parties_summary)
    then v_changed := array_append(v_changed, 'appearing_parties_summary'); end if;
  if (new.notes is distinct from old.notes)
    then v_changed := array_append(v_changed, 'notes'); end if;

  if array_length(v_changed, 1) is null then
    return new; -- sin cambios reales: no se registra evento
  end if;

  insert into public.document_activity
    (document_id, owner_id, actor_user_id, event_type, summary, metadata)
  values (new.document_id, new.owner_id, v_actor, 'notarial_metadata_updated',
          'Datos para índice actualizados',
          jsonb_build_object('changedFields', to_jsonb(v_changed)));

  v_was_complete :=
    coalesce(btrim(old.instrument_number), '') <> ''
    and old.authorized_at is not null
    and coalesce(btrim(old.act_type), '') <> '';

  if v_is_complete and not v_was_complete then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (new.document_id, new.owner_id, v_actor,
            'notarial_metadata_completed', 'Datos para índice completos',
            '{}'::jsonb);
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

create trigger dnm_record_activity
after insert or update on public.document_notarial_metadata
for each row execute function public.record_notarial_metadata_activity();

-- ------------------------------------------------------------------ rls

alter table public.document_notarial_metadata enable row level security;

create policy "dnm_select_own"
on public.document_notarial_metadata
for select to authenticated
using (owner_id = auth.uid());

create policy "dnm_insert_own"
on public.document_notarial_metadata
for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.documents
     where documents.id = document_notarial_metadata.document_id
       and documents.owner_id = auth.uid()
  )
);

create policy "dnm_update_own"
on public.document_notarial_metadata
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "dnm_delete_own"
on public.document_notarial_metadata
for delete to authenticated
using (owner_id = auth.uid());
