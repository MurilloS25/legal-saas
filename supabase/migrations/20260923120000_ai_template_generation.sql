-- AI-assisted template generation ("Crear con IA").
--
-- Persistencia mínima y sin contenido documental:
--
-- * ai_template_generations: libro de generaciones (una fila por generación
--   solicitada por el usuario; el retry técnico interno NO crea otra fila).
--   Sirve a la vez para cuota diaria, guardia de concurrencia, trazabilidad
--   (proveedor/modelo/versión de schema) y log operativo. Nunca guarda el
--   documento, el texto extraído, el prompt ni la respuesta del modelo:
--   `review_summary` solo admite claves de variables y códigos de
--   advertencia cerrados, validados en la aplicación.
-- * workspace_ai_settings: override opcional de cuota por Workspace. Sin
--   políticas para `authenticated`: solo se cambia por SQL administrativo o
--   service role (no hay UI de billing). Un propietario no puede subirse su
--   propia cuota.
--
-- Escrituras: exclusivamente por las RPCs begin/finish de esta migración,
-- ejecutables solo por `service_role`. La aplicación las invoca desde el
-- servidor DESPUÉS de autenticar al usuario y verificar su permiso, y las
-- RPCs vuelven a verificar la membresía activa con rol de escritura. Así el
-- usuario no puede alterar su propio contador de cuota ni marcar una
-- generación como "no cobrable" desde el Data API.
--
-- El Machote generado se crea con la RPC existente save_template_workspace
-- usando la sesión del usuario (RLS y permisos actuales), siempre como
-- 'draft'. finish_ai_template_generation exige además que el template
-- exitoso sea un borrador del mismo Workspace.

-- =================================================== ai_template_generations

create table public.ai_template_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.templates(id) on delete set null,
  status text not null default 'running',
  source_type text not null,
  provider text not null,
  model text not null,
  schema_version text not null,
  input_chars integer not null,
  input_tokens integer,
  output_tokens integer,
  attempts smallint not null default 0,
  error_code text,
  counts_toward_quota boolean not null default true,
  review_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  duration_ms integer,
  constraint ai_template_generations_status_valid
    check (status in ('running', 'succeeded', 'failed')),
  constraint ai_template_generations_source_type_valid
    check (source_type in ('text', 'docx', 'pdf')),
  constraint ai_template_generations_provider_valid
    check (provider ~ '^[a-z0-9_-]{1,40}$'),
  constraint ai_template_generations_model_valid
    check (char_length(model) between 1 and 120),
  constraint ai_template_generations_schema_version_valid
    check (char_length(schema_version) between 1 and 60),
  constraint ai_template_generations_input_chars_valid
    check (input_chars between 0 and 1000000),
  constraint ai_template_generations_tokens_valid
    check (coalesce(input_tokens, 0) >= 0 and coalesce(output_tokens, 0) >= 0),
  constraint ai_template_generations_attempts_valid
    check (attempts between 0 and 2),
  constraint ai_template_generations_error_code_valid
    check (error_code is null or error_code ~ '^[a-z_]{1,60}$'),
  constraint ai_template_generations_review_summary_valid
    check (
      jsonb_typeof(review_summary) = 'object'
      and octet_length(review_summary::text) <= 20000
    ),
  constraint ai_template_generations_duration_valid
    check (duration_ms is null or duration_ms >= 0),
  constraint ai_template_generations_finished_consistency
    check ((status = 'running') = (finished_at is null))
);

comment on table public.ai_template_generations is
  'Metadata operativa de "Crear con IA": cuota, concurrencia, trazabilidad (proveedor/modelo/schema) y resultado. Nunca contiene el documento, texto extraído, prompts ni respuestas del modelo. Escrita solo por begin/finish_ai_template_generation (service_role).';

-- Una sola generación activa por usuario (segunda guardia además del lock
-- de begin_ai_template_generation).
create unique index ai_template_generations_one_running_per_user
  on public.ai_template_generations (actor_user_id)
  where status = 'running';

create index ai_template_generations_actor_started_idx
  on public.ai_template_generations (actor_user_id, started_at desc);

create index ai_template_generations_workspace_started_idx
  on public.ai_template_generations (workspace_id, started_at desc);

create index ai_template_generations_template_idx
  on public.ai_template_generations (template_id)
  where template_id is not null;

alter table public.ai_template_generations enable row level security;

-- Lectura para miembros del Workspace: permite mostrar en el Machote que
-- fue generado con IA (proveedor/modelo/fecha). No hay contenido sensible.
create policy "ai_template_generations_select_member"
on public.ai_template_generations for select to authenticated
using (public.is_workspace_member(workspace_id));

revoke all on table public.ai_template_generations from anon, authenticated;
grant select on table public.ai_template_generations to authenticated;

-- ===================================================== workspace_ai_settings

create table public.workspace_ai_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  ai_template_daily_limit_per_user integer,
  updated_at timestamptz not null default now(),
  constraint workspace_ai_settings_daily_limit_valid
    check (
      ai_template_daily_limit_per_user is null
      or ai_template_daily_limit_per_user between 0 and 1000
    )
);

comment on table public.workspace_ai_settings is
  'Override técnico/administrativo de la cuota diaria de "Crear con IA" por usuario de un Workspace. NULL o sin fila = default de la aplicación (AI_TEMPLATE_DAILY_LIMIT). Sin acceso para anon/authenticated: se administra por SQL o service role.';

alter table public.workspace_ai_settings enable row level security;
revoke all on table public.workspace_ai_settings from anon, authenticated;

-- ============================================ begin_ai_template_generation

create or replace function public.begin_ai_template_generation(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_source_type text,
  p_input_chars integer,
  p_provider text,
  p_model text,
  p_schema_version text,
  p_default_daily_limit integer,
  p_stale_after_seconds integer
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_limit integer;
  v_used integer;
  v_day_start timestamptz;
  v_id uuid;
begin
  if p_workspace_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'invalid_generation_actor';
  end if;
  if p_default_daily_limit is null or p_default_daily_limit not between 0 and 1000 then
    raise exception using errcode = '22023', message = 'invalid_daily_limit';
  end if;
  if p_stale_after_seconds is null or p_stale_after_seconds not between 60 and 3600 then
    raise exception using errcode = '22023', message = 'invalid_stale_after';
  end if;

  -- Defensa en profundidad: la app ya verificó el permiso con la sesión
  -- del usuario; aquí se exige de nuevo una membresía activa con rol que
  -- puede crear Machotes en ESE Workspace.
  if not exists (
    select 1
      from public.workspace_members m
     where m.workspace_id = p_workspace_id
       and m.user_id = p_actor_user_id
       and m.status = 'active'
       and m.role in ('propietario', 'administrador', 'asistente')
  ) then
    raise exception using errcode = '42501', message = 'workspace_membership_required';
  end if;

  -- Serializa begin concurrentes del mismo usuario (varias pestañas).
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai_template_generation:' || p_actor_user_id::text, 0)
  );

  -- Una generación "running" huérfana (proceso caído) no bloquea para
  -- siempre: se cierra como abandonada y sigue contando para la cuota.
  update public.ai_template_generations
     set status = 'failed',
         error_code = 'abandoned',
         finished_at = clock_timestamp()
   where actor_user_id = p_actor_user_id
     and status = 'running'
     and started_at < clock_timestamp() - make_interval(secs => p_stale_after_seconds);

  if exists (
    select 1 from public.ai_template_generations
     where actor_user_id = p_actor_user_id and status = 'running'
  ) then
    raise exception using errcode = 'P0001', message = 'ai_generation_in_progress';
  end if;

  select coalesce(s.ai_template_daily_limit_per_user, p_default_daily_limit)
    into v_limit
    from (select 1) as one
    left join public.workspace_ai_settings s on s.workspace_id = p_workspace_id;

  -- Día calendario de Costa Rica.
  v_day_start :=
    (date_trunc('day', clock_timestamp() at time zone 'America/Costa_Rica'))
      at time zone 'America/Costa_Rica';

  select count(*) into v_used
    from public.ai_template_generations
   where actor_user_id = p_actor_user_id
     and counts_toward_quota
     and started_at >= v_day_start;

  if v_used >= v_limit then
    raise exception using errcode = 'P0001', message = 'ai_quota_exceeded';
  end if;

  insert into public.ai_template_generations (
    workspace_id, actor_user_id, status, source_type, provider, model,
    schema_version, input_chars
  ) values (
    p_workspace_id, p_actor_user_id, 'running', p_source_type, p_provider,
    p_model, p_schema_version, p_input_chars
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.begin_ai_template_generation(
  uuid, uuid, text, integer, text, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.begin_ai_template_generation(
  uuid, uuid, text, integer, text, text, text, integer, integer
) to service_role;

-- =========================================== finish_ai_template_generation

create or replace function public.finish_ai_template_generation(
  p_generation_id uuid,
  p_status text,
  p_error_code text,
  p_template_id uuid,
  p_attempts integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_duration_ms integer,
  p_review_summary jsonb,
  p_counts_toward_quota boolean
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.ai_template_generations%rowtype;
  v_actor_name text;
  v_actor_role text;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception using errcode = '22023', message = 'invalid_generation_status';
  end if;
  if p_status = 'succeeded' and p_template_id is null then
    raise exception using errcode = '22023', message = 'template_required';
  end if;
  if p_status = 'failed' and p_template_id is not null then
    raise exception using errcode = '22023', message = 'unexpected_template';
  end if;

  select * into v_row
    from public.ai_template_generations
   where id = p_generation_id
   for update;

  if not found or v_row.status <> 'running' then
    raise exception using errcode = 'P0002', message = 'generation_not_running';
  end if;

  -- Invariante de producto: la IA solo produce borradores del Workspace
  -- del actor. Publicar sigue siendo una acción humana del flujo normal.
  if p_template_id is not null and not exists (
    select 1 from public.templates t
     where t.id = p_template_id
       and t.workspace_id = v_row.workspace_id
       and t.status = 'draft'
  ) then
    raise exception using errcode = '42501', message = 'template_not_draft_in_workspace';
  end if;

  update public.ai_template_generations
     set status = p_status,
         error_code = case when p_status = 'failed' then p_error_code else null end,
         template_id = p_template_id,
         attempts = coalesce(p_attempts, 0),
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         duration_ms = p_duration_ms,
         review_summary = coalesce(p_review_summary, '{}'::jsonb),
         counts_toward_quota = coalesce(p_counts_toward_quota, true),
         finished_at = clock_timestamp()
   where id = p_generation_id;

  if p_status = 'succeeded' then
    select actor_name, actor_role into v_actor_name, v_actor_role
      from public.resolve_actor_snapshot(v_row.workspace_id, v_row.actor_user_id);

    insert into public.workspace_activity (
      workspace_id, actor_user_id, actor_name_snapshot, actor_role_snapshot,
      event_type, metadata
    ) values (
      v_row.workspace_id, v_row.actor_user_id, v_actor_name, v_actor_role,
      'template_ai_generated',
      pg_catalog.jsonb_build_object(
        'templateId', p_template_id,
        'generationId', v_row.id,
        'provider', v_row.provider,
        'model', v_row.model,
        'schemaVersion', v_row.schema_version,
        'success', true
      )
    );
  end if;
end;
$$;

revoke all on function public.finish_ai_template_generation(
  uuid, text, text, uuid, integer, integer, integer, integer, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.finish_ai_template_generation(
  uuid, text, text, uuid, integer, integer, integer, integer, jsonb, boolean
) to service_role;
