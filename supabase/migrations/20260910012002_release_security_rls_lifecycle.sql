-- Release A. Authorization is workspace/role based; owner_id remains provenance.
begin;

create function public.enforce_workspace_row_provenance()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.workspace_id is distinct from old.workspace_id then
    raise exception 'row owner and workspace cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
alter function public.enforce_workspace_row_provenance() owner to postgres;
revoke all on function public.enforce_workspace_row_provenance() from public, anon, authenticated;

create trigger clients_preserve_provenance before update on public.clients
for each row execute function public.enforce_workspace_row_provenance();

alter policy clients_update_workspace on public.clients
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
);

create trigger templates_preserve_provenance before update on public.templates
for each row execute function public.enforce_workspace_row_provenance();

alter policy templates_update_workspace on public.templates
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
);

create trigger template_fields_preserve_provenance before update on public.template_fields
for each row execute function public.enforce_workspace_row_provenance();

alter policy template_fields_update_workspace on public.template_fields
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
  and exists (select 1 from public.templates t where t.id = template_fields.template_id and t.workspace_id = template_fields.workspace_id)
);

create trigger template_index_configurations_preserve_provenance before update on public.template_index_configurations
for each row execute function public.enforce_workspace_row_provenance();

alter policy template_index_config_update_workspace on public.template_index_configurations
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
  and exists (select 1 from public.templates t where t.id = template_index_configurations.template_id and t.workspace_id = template_index_configurations.workspace_id)
);

create trigger template_index_configuration_fields_preserve_provenance before update on public.template_index_configuration_fields
for each row execute function public.enforce_workspace_row_provenance();

alter policy template_index_fields_update_workspace on public.template_index_configuration_fields
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
  and exists (select 1 from public.template_index_configurations c where c.id = template_index_configuration_fields.configuration_id and c.template_id = template_index_configuration_fields.template_id and c.workspace_id = template_index_configuration_fields.workspace_id)
  and exists (select 1 from public.template_fields f where f.id = template_index_configuration_fields.template_field_id and f.template_id = template_index_configuration_fields.template_id and f.workspace_id = template_index_configuration_fields.workspace_id)
);

create trigger documents_preserve_provenance before update on public.documents
for each row execute function public.enforce_workspace_row_provenance();

alter policy documents_update_workspace on public.documents
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
  and exists (select 1 from public.templates t where t.id = documents.template_id and t.workspace_id = documents.workspace_id)
);

create trigger document_notarial_metadata_preserve_provenance before update on public.document_notarial_metadata
for each row execute function public.enforce_workspace_row_provenance();

alter policy dnm_update_workspace on public.document_notarial_metadata
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
  and exists (select 1 from public.documents d where d.id = document_notarial_metadata.document_id and d.workspace_id = document_notarial_metadata.workspace_id)
);

create trigger receivables_preserve_provenance before update on public.receivables
for each row execute function public.enforce_workspace_row_provenance();

alter policy receivables_update_workspace on public.receivables
using (public.is_workspace_member(workspace_id, array['propietario','administrador','asistente']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador','asistente'])
  and (client_id is null or exists (select 1 from public.clients c where c.id = receivables.client_id and c.workspace_id = receivables.workspace_id))
  and (document_id is null or exists (select 1 from public.documents d where d.id = receivables.document_id and d.workspace_id = receivables.workspace_id))
);

create trigger lawyer_profiles_preserve_provenance before update on public.lawyer_profiles
for each row execute function public.enforce_workspace_row_provenance();

alter policy lawyer_profiles_update_workspace on public.lawyer_profiles
using (public.is_workspace_member(workspace_id, array['propietario','administrador']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador'])
);

create trigger document_settings_preserve_provenance before update on public.document_settings
for each row execute function public.enforce_workspace_row_provenance();

alter policy document_settings_update_workspace on public.document_settings
using (public.is_workspace_member(workspace_id, array['propietario','administrador']))
with check (
  public.is_workspace_member(workspace_id, array['propietario','administrador'])
);

-- Mutating memberships is an RPC-only contract. Existing SELECT policies stay.
drop policy workspace_members_manage_admin on public.workspace_members;
revoke insert, update, delete, truncate, references, trigger
on public.workspace_members from public, anon, authenticated;

-- Internal helper: privileged audit triggers/RPCs still execute as their owner.
revoke all on function public.resolve_actor_snapshot(uuid, uuid) from public, anon, authenticated;

-- Keep existing role checks and notarial activity triggers intact. This independent
-- invariant applies to every caller, including inserts and combined reopen+edit.
create function public.enforce_document_content_lifecycle()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'documents must be created as draft' using errcode = 'check_violation';
    end if;
  elsif old.status = 'final' then
    if (new.template_id, new.title, new.client_id, new.field_values,
        new.option_selections, new.rendered_content)
       is distinct from
       (old.template_id, old.title, old.client_id, old.field_values,
        old.option_selections, old.rendered_content) then
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
alter function public.enforce_document_content_lifecycle() owner to postgres;
revoke all on function public.enforce_document_content_lifecycle() from public, anon, authenticated;
create trigger documents_enforce_content_lifecycle before insert or update on public.documents
for each row execute function public.enforce_document_content_lifecycle();

commit;
