-- ---------------------------------------------------------------- contexto
--
-- `default_workspace_id_from_actor()` (introducida en
-- 20260804210000_workspace_roles_and_invitations.sql) rellena workspace_id
-- en un INSERT con `... limit 1` sin desambiguar, cuando el actor
-- pertenece a más de un Workspace. Todo usuario recibe automáticamente su
-- propio Workspace de arranque como "propietario"
-- (bootstrap_workspace_for_new_user(), workspace_id = su propio user id) —
-- si además fue invitado a otro Workspace ("asistente"/"administrador"/
-- "solo_lectura" con workspace_id distinto), el actor tiene dos filas
-- activas en workspace_members y el `limit 1` sin `order by` puede resolver
-- a cualquiera de las dos, sin preferencia.
--
-- Esto se manifestó como una violación de FK real en un test E2E: un
-- asistente crea una cuenta por cobrar (workspace_id correcto, el
-- compartido) vía `createReceivableRow`; el trigger
-- `receivables_record_activity` inserta la fila de auditoría en
-- `receivable_activity`, cuyo propio trigger BEFORE INSERT (esta función)
-- resolvió el workspace_id equivocado — el Workspace de arranque del
-- asistente en vez del compartido — rompiendo `ra_receivable_workspace_fk`.
--
-- Investigado a fondo: en producción, el único camino para que una
-- membresía quede "active" es `accept_workspace_invitation()`, que ya
-- ELIMINA el Workspace de arranque del invitado al aceptar (ver esa
-- función) — así que un usuario real, tras aceptar una invitación, nunca
-- tiene dos filas activas en `workspace_members`. El caso que rompió esta
-- función fue un fixture de prueba (`deep-permission-gating-authenticated
-- .spec.ts`) que crea la membresía del asistente con un INSERT directo
-- (service role) a `status: 'active'`, saltándose esa RPC y su limpieza —
-- algo que ningún flujo de la aplicación real hace hoy.
--
-- Aun así, esta función es SECURITY DEFINER y queda expuesta a cualquier
-- fila insertada por cualquier medio (fixtures, scripts, futuras vías de
-- alta directa) — no debería depender silenciosamente de que
-- `accept_workspace_invitation()` sea el único camino posible. Esta
-- migración la hace robusta por sí misma, replicando la misma prioridad
-- que ya usa `getWorkspaceAccess()` (src/lib/server/auth.ts) a nivel de
-- aplicación: preferir una membresía "genuina" (no de arranque,
-- workspace_id <> el propio user id) sobre la de arranque, en vez de asumir
-- que nunca coexisten.
--
-- Nota: si un actor está invitado a más de un Workspace genuino a la vez,
-- la elección entre esos dos sigue siendo ambigua (mismo límite que ya
-- tiene `getWorkspaceAccess()`, que también toma el primero que encuentra)
-- — fuera de alcance de este fix, que solo iguala la prioridad
-- bootstrap-vs-genuino entre ambas capas.

create or replace function public.default_workspace_id_from_actor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.owner_id);
begin
  if new.workspace_id is null then
    select workspace_id into new.workspace_id
      from public.workspace_members
     where user_id = v_actor and status = 'active'
     order by (workspace_id = v_actor) asc
     limit 1;
  end if;
  return new;
end;
$$;
