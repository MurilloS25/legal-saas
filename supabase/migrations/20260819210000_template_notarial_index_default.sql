-- =============================================== template notarial index default
--
-- La pertenencia al Índice Notarial deja de decidirse (o re-decidirse) cada
-- vez que se finaliza una Escritura. El Machote define el valor normal;
-- cada Escritura toma un snapshot de ese valor al crearse.
--
-- Representación: booleano en `templates`, no una tabla nueva — es una
-- preferencia del Machote, del mismo tipo que ya vive directamente en esa
-- tabla (status, category). `documents.include_in_notarial_index` (ya
-- existente desde 20260818130000) sigue siendo la ÚNICA fuente real por
-- Escritura — este campo del Machote solo determina el valor INICIAL en el
-- momento del INSERT; cambiar el Machote después nunca toca Escrituras ya
-- creadas (el snapshot ocurre una sola vez, en application code — ver
-- createDocumentDraftAction).
--
-- Default `true` para Machotes existentes: preserva el comportamiento
-- previo a este cambio (toda Escritura finalizada entraba al Índice salvo
-- decisión explícita) para quien no toca la configuración.
alter table public.templates
  add column include_in_notarial_index_by_default boolean not null default true;

comment on column public.templates.include_in_notarial_index_by_default is
  'Valor que toman las nuevas Escrituras creadas desde este Machote en documents.include_in_notarial_index (snapshot al crear, no vínculo permanente). Cambiar este valor no afecta Escrituras ya existentes.';

-- ------------------------------------------------------------------ rpc
--
-- Mismo patrón que save_template_workspace / save_template_index_configuration
-- / save_template_index_mapping_with_block_source: SECURITY DEFINER + chequeo
-- de membresía de Workspace (templates.write), no la restricción histórica
-- owner_id = auth.uid() de la RLS de `templates` — un administrador debe
-- poder cambiar esta preferencia en un Machote de otro miembro del mismo
-- Workspace. Se mantiene como RPC propia en vez de sumar un parámetro más a
-- `save_template_workspace` (que ya cubre name/description/status/content/
-- fields, un concepto no relacionado) — mismo razonamiento que ya separó
-- `save_template_index_configuration` de ese RPC.
create or replace function public.set_template_notarial_index_default(
  p_template_id uuid,
  p_include_by_default boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_include_by_default is null then
    raise exception using errcode = '22023', message = 'invalid_include_by_default';
  end if;

  select workspace_id into v_workspace_id from public.templates where id = p_template_id;
  if v_workspace_id is null
    or not public.is_workspace_member(v_workspace_id, array['propietario', 'administrador', 'asistente']) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;

  update public.templates
     set include_in_notarial_index_by_default = p_include_by_default
   where id = p_template_id and workspace_id = v_workspace_id;
end;
$$;

revoke all on function public.set_template_notarial_index_default(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_template_notarial_index_default(uuid, boolean)
  to authenticated;
