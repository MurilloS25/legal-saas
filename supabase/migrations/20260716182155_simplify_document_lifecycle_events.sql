-- Preserve the semantic reopen event when the simplified lifecycle moves a
-- finalized document directly back to draft. The ready case remains for
-- historical compatibility.
create or replace function public.record_document_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id, old.owner_id);
  v_prev_client_name text;
  v_new_client_name text;
begin
  if (tg_op = 'INSERT') then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values
      (new.id, new.owner_id, v_actor, 'document_created', 'Escritura creada',
       '{}'::jsonb);
    return new;
  end if;

  if (new.status is distinct from old.status) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor,
      case
        when new.status = 'final' then 'document_finalized'
        when old.status = 'final' and new.status in ('draft', 'ready')
          then 'document_reopened'
        else 'document_status_changed'
      end,
      'Estado actualizado',
      jsonb_build_object('previousStatus', old.status, 'newStatus', new.status)
    );
  end if;

  if (new.client_id is distinct from old.client_id) then
    select full_name into v_prev_client_name
      from public.clients where id = old.client_id;
    select full_name into v_new_client_name
      from public.clients where id = new.client_id;

    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor,
      case
        when old.client_id is null then 'document_client_assigned'
        when new.client_id is null then 'document_client_removed'
        else 'document_client_changed'
      end,
      'Cliente actualizado',
      jsonb_strip_nulls(jsonb_build_object(
        'previousClientId', old.client_id,
        'previousClientName', v_prev_client_name,
        'newClientId', new.client_id,
        'newClientName', v_new_client_name
      ))
    );
  end if;

  if (new.title is distinct from old.title) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, 'document_title_changed',
      'Título actualizado',
      jsonb_build_object('previousTitle', old.title, 'newTitle', new.title)
    );
  end if;

  if (new.field_values is distinct from old.field_values
      or new.rendered_content is distinct from old.rendered_content) then
    insert into public.document_activity
      (document_id, owner_id, actor_user_id, event_type, summary, metadata)
    values (
      new.id, new.owner_id, v_actor, 'document_content_updated',
      'Contenido de la escritura actualizado', '{}'::jsonb
    );
  end if;

  return new;
end;
$$;
