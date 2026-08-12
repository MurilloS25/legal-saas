-- list_workspace_members: la UI "Mi equipo" necesita mostrar email (y
-- nombre, si el miembro ya configuró su lawyer_profile) de cada miembro del
-- Workspace — datos que viven en auth.users, no accesible directamente vía
-- PostgREST para el rol authenticated. SECURITY DEFINER expone solo lo
-- necesario, y solo para miembros ACTIVOS del mismo Workspace del llamante
-- (is_workspace_member ya lo exige antes de devolver cualquier fila).
create or replace function public.list_workspace_members()
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  status text,
  invited_by uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    m.id,
    m.user_id,
    u.email,
    lp.full_name,
    m.role,
    m.status,
    m.invited_by,
    m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.lawyer_profiles lp on lp.owner_id = m.user_id
  where m.workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
  order by
    case m.role when 'propietario' then 0 when 'administrador' then 1 when 'asistente' then 2 else 3 end,
    m.created_at asc;
$$;

revoke all on function public.list_workspace_members() from public, anon;
grant execute on function public.list_workspace_members() to authenticated;
