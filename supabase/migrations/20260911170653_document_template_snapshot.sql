-- P1-03: una Escritura conserva la estructura y configuración explícita del
-- Machote con que se creó. Las filas existentes quedan en null: su única
-- fuente histórica fiel es rendered_content y la aplicación las abre en
-- modo de compatibilidad plano, sin reconstruirlas desde el Machote actual.

alter table public.documents
  add column template_snapshot jsonb;

alter table public.documents
  add constraint documents_template_snapshot_is_object check (
    template_snapshot is null
    or jsonb_typeof(template_snapshot) = 'object'
  );

comment on column public.documents.template_snapshot is
  'Versioned structured template document and configured field catalog captured when the document is created; null identifies pre-snapshot rows.';

-- El snapshot forma parte del contenido de la Escritura y queda inmutable
-- mientras la fila está finalizada, igual que valores, selecciones y texto.
create or replace function public.enforce_document_content_lifecycle()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'documents must be created as draft' using errcode = 'check_violation';
    end if;
  elsif new.template_snapshot is distinct from old.template_snapshot then
    raise exception 'document template snapshot is immutable'
      using errcode = 'check_violation';
  elsif old.status = 'final' then
    if (new.template_id, new.title, new.client_id, new.field_values,
        new.option_selections, new.rendered_content, new.template_snapshot)
       is distinct from
       (old.template_id, old.title, old.client_id, old.field_values,
        old.option_selections, old.rendered_content, old.template_snapshot) then
      raise exception 'final document content is immutable; reopen before editing'
        using errcode = 'check_violation';
    end if;
    if new.status not in ('final', 'draft') then
      raise exception 'final documents can only reopen to draft'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
