# Diseño — Workspaces notariales multiusuario

## Estado

Este documento describía originalmente **solo diagnóstico y diseño**
(Iteración 3, `03_AUDITORIA_Y_DISENO_WORKSPACES_MULTIUSUARIO.md`) — sin
migraciones, RLS, invitaciones ni UI.

Este documento es un **ADR histórico/evolutivo**, no la fuente normativa del
estado actual. Las Iteraciones 4, 5 y 6 están implementadas; §§11–13 registran
qué se entregó y cómo cambió el diseño original. El producto actual tiene
Workspaces, invitaciones y cuatro roles fijos (`propietario`, `administrador`,
`asistente`, `solo_lectura`), además de identidad profesional separada de la
identidad del actor. Para el modelo vigente usar `docs/DATABASE.md`; para reglas
de autorización usar `docs/SECURITY.md` y el código/migrations versionados.

## Objetivo

Diseñar la evolución desde el modelo actual `owner_id = auth.uid()`
(un usuario autenticado = un propietario = todos sus datos) hacia una
**Oficina / Workspace notarial** con varios usuarios: el Notario como
propietario, asistentes con cuentas propias trabajando dentro de la misma
oficina, roles y permisos, auditoría con actor real, y un Índice Notarial
que usa la identidad profesional del Notario — no la del usuario que
ejecutó la acción.

---

## 1. Auditoría del estado actual

Resumen de la auditoría completa del código (migraciones, RLS, RPCs,
triggers, vistas, Server Actions). El detalle línea por línea vive en el
historial de esta tarea; aquí se documentan solo los hallazgos que
determinan el diseño.

### 1.1 Todas las tablas usan `owner_id` de forma idéntica

17 tablas (`supabase/migrations/*.sql`), todas con
`owner_id uuid not null references auth.users(id) on delete cascade`,
todas con las mismas 4 políticas RLS (`select_own`/`insert_own`/
`update_own`/`delete_own`, `owner_id = auth.uid()`, revalidado con `exists`
en tablas hijas). Dos tablas de la migración inicial
(`document_metadata`, `notarial_records`) son andamiaje sin uso real —
confirmado que no las referencia ningún código de `src/`.

Tablas activas por módulo: `lawyer_profiles`, `document_settings`,
`clients`, `templates`, `template_fields`,
`template_index_configurations`, `template_index_configuration_fields`,
`documents`, `document_activity`, `document_notarial_metadata`,
`notarial_index_exports`, `receivables`, `receivable_activity`,
`receivable_payments`.

### 1.2 `owner_id` está sobrecargado con dos significados distintos

Hoy `owner_id` responde simultáneamente a dos preguntas que el modelo
objetivo separa explícitamente:

1. **¿Quién puede ver/escribir esta fila?** (control de acceso — RLS)
2. **¿A qué identidad profesional pertenece legalmente este dato?**
   (numeración de protocolo, nombre en la escritura, Índice Notarial)

El caso más claro es `document_notarial_metadata`: su restricción de
unicidad `unique (owner_id, extract(year from authorized_at),
instrument_number)` ata la secuencia de numeración de instrumentos **al
propietario de la cuenta**, no a un notario. Si dos usuarios (notario +
asistente) compartieran una oficina hoy, cada uno tendría su propia
secuencia de numeración — legalmente incorrecto, un instrumento
pertenece al notario responsable sin importar quién lo escribió.

### 1.3 Ya existe precedente real de "actor distinto del dueño de los datos"

`document_activity` y `receivable_activity` **ya tienen** una columna
`actor_user_id uuid not null references auth.users(id)` separada de
`owner_id`. Hoy su valor siempre es `coalesce(auth.uid(), owner_id)` —
matemáticamente igual a `owner_id`, porque no existen asistentes — pero la
columna y el patrón ya están ahí. El código TypeScript incluso tiene una
rama sin alcanzar: `src/features/documents/server/activity-queries.ts`
resuelve el nombre del actor con
`row.actor_user_id === user.id ? ownName : "Otro usuario"` — un gancho ya
preparado para múltiples actores.

Este es el patrón más importante a **generalizar**, no a inventar de cero.

### 1.4 Inconsistencia de defensa en profundidad ya detectada

Ya documentada en `docs/SUPABASE_PRODUCTION.md`: los triggers
`record_document_activity`, `record_receivable_activity`,
`sync_receivable_client_name_snapshot` y
`enforce_receivable_payment_consistency` confían en el RLS de la tabla
base y no revalidan `auth.uid()` dentro de la función, a diferencia de
`enforce_notarial_metadata_editable`/`record_notarial_metadata_activity`
(versión fortalecida), que sí hacen `raise exception` si
`auth.uid() <> owner_id`. El rediseño de Workspaces es la oportunidad
natural para unificar todos los triggers al patrón defensivo, ya que de
todas formas hay que tocarlos para pasar de "propietario único" a
"miembro de un workspace con rol".

### 1.5 Identidad profesional (`lawyer_profiles`) ya está separada del resto de los datos, pero no del usuario autenticado

`lawyer_profiles`/`document_settings` son 1 fila por `owner_id` (`unique
(owner_id)`). El nombre usado en el Índice Notarial y en el pie de la
Escritura sale exclusivamente de `lawyer_profiles.full_name` filtrado por
`owner_id = auth.uid()` — es decir, hoy "el notario" y "quien inició
sesión" son literalmente la misma fila. No existe ningún punto del código
que ya distinga "identidad profesional responsable" de "usuario actuando".
Este es exactamente el vacío que el modelo `notary_profile` vs
`actor_user` debe llenar.

### 1.6 RPCs `SECURITY DEFINER` ya validan `auth.uid()` de forma centralizada

Todas las mutaciones complejas (`register_receivable_payment`,
`void_receivable_payment`, `save_template_workspace`,
`save_template_index_configuration`, `save_template_index_mapping*`)
validan `auth.uid()` dentro de la función y localizan filas por
`owner_id = v_uid`. Este patrón — un único punto de validación por
operación, no repetido en cada componente — es el que se debe extender a
"validar membresía + rol en el workspace" en vez de reescribirlo desde
cero por feature.

### 1.7 Vistas dependen de `security_invoker = on`

`notarial_index_entries` y `receivable_entries` ya usan
`security_invoker = on`, por lo que el RLS del usuario que consulta se
aplica a las tablas subyacentes automáticamente. Esto se preserva sin
cambios: basta con que las políticas RLS de las tablas base pasen de
"dueño" a "miembro del workspace" para que las vistas hereden el
comportamiento correcto sin tocarlas.

---

## 2. Modelo de datos propuesto

### 2.1 Entidades nuevas

```sql
-- La Oficina notarial. Una fila por oficina.
workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
)

-- Identidad profesional responsable (el Notario). Reemplaza el uso actual
-- de lawyer_profiles como "identidad = usuario autenticado".
notary_profiles (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  full_name          text not null,
  professional_code  text,
  email              text,
  phone              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id)  -- MVP: un notario responsable por oficina
)

-- Membresía: qué usuario pertenece a qué workspace, con qué rol.
workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('propietario', 'administrador', 'asistente', 'solo_lectura')),
  status        text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  invited_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
)
```

`notary_profiles` es deliberadamente **su propia tabla**, no una columna
en `workspaces`, para permitir sin romper el modelo que en el futuro una
oficina tenga más de un notario asociado (fuera de alcance MVP, pero no
se cierra la puerta con una columna embebida).

### 2.2 Tablas existentes: `owner_id` → `workspace_id`

Cada una de las 14 tablas de negocio activas (§1.1, excluyendo las 2
vestigiales) agrega `workspace_id uuid not null references workspaces(id)`
y **conserva** `actor_user_id`/columnas de auditoría equivalentes donde ya
existen, generalizando el patrón a las tablas que hoy no lo tienen
(`documents`, `clients`, `templates`, `template_fields`, `receivables`,
`receivable_payments`, `document_notarial_metadata`,
`notarial_index_exports`, `template_index_configurations`,
`template_index_configuration_fields`, `lawyer_profiles`→eliminada en
favor de `notary_profiles`, `document_settings`).

`document_settings` se queda como está conceptualmente (preferencias de
formato), pero pasa a ser 1 fila por `workspace_id` en vez de por
`owner_id` — el formato del documento es una preferencia de la oficina,
no de cada usuario individual.

`created_by`/`actor_user_id` (según la tabla) queda como
`uuid not null references auth.users(id)` **sin** `on delete cascade` —
si un asistente se elimina de Supabase Auth, su rastro de auditoría debe
sobrevivir (ver §6). Esto ya es así hoy en `document_activity`/
`receivable_activity`; se generaliza al resto.

### 2.3 `document_notarial_metadata`: la corrección legal más importante

La restricción de unicidad de numeración pasa de:

```sql
unique (owner_id, extract(year from authorized_at), instrument_number)
```

a:

```sql
unique (notary_profile_id, extract(year from authorized_at), instrument_number)
```

`notary_profile_id references notary_profiles(id)`, resuelto en el
momento de guardar/exportar a partir del `workspace_id` de la Escritura
(join `documents.workspace_id → notary_profiles.workspace_id`) — nunca
del `auth.uid()` de quien ejecuta la acción. Esto es lo que garantiza que
el Índice Notarial y la numeración de protocolo pertenezcan al Notario
responsable de la oficina, sin importar qué asistente redactó la
Escritura.

### 2.4 Diagrama de relaciones

```text
auth.users (Supabase Auth)
  └─ workspace_members (user_id, role, status)
        └─ workspaces
              ├─ notary_profiles (1:1 en MVP)
              ├─ document_settings (1:1)
              ├─ clients
              ├─ templates
              │   ├─ template_fields
              │   └─ template_index_configurations
              │         └─ template_index_configuration_fields
              ├─ documents
              │   ├─ document_activity (actor_user_id → auth.users)
              │   └─ document_notarial_metadata (→ notary_profiles vía workspace)
              ├─ notarial_index_exports
              └─ receivables
                    ├─ receivable_activity (actor_user_id → auth.users)
                    └─ receivable_payments (voided_by → auth.users)
```

---

## 3. Estrategia de migración de usuarios actuales a Workspaces

Objetivo: cero pérdida de datos, cero downtime funcional, reversible en
cada paso.

1. **Crear la tabla `workspaces` y `notary_profiles`, `workspace_members`**
   vacías (migración aditiva, no toca tablas existentes).
2. **Backfill 1:1**: para cada `auth.users` que ya tiene datos (identificado
   por tener al menos una fila en cualquier tabla `owner_id`-scoped),
   crear:
   - un `workspaces` (un nombre por defecto, p. ej. el `full_name` de su
     `lawyer_profiles` o el email si no existe perfil),
   - un `workspace_members` con `role = 'propietario'`, `status = 'active'`,
   - un `notary_profiles` copiando la fila existente de `lawyer_profiles`.
   Este paso es un script SQL determinista dentro de la migración misma
   (no requiere lógica de aplicación), ejecutado una sola vez.
3. **Agregar `workspace_id` nullable** a cada tabla de negocio existente,
   backfillear con el `workspaces.id` recién creado para su `owner_id`
   correspondiente (join 1:1 vía `workspace_members`), luego marcar
   `not null`. `owner_id` **se conserva** en esta fase (no se borra
   todavía) — es la red de seguridad para el rollback.
4. **Migrar RLS** de `owner_id = auth.uid()` a la función de membresía
   (§5) — ver plan de corte por tabla en §5.4. Este es el único paso que
   cambia comportamiento observable; los anteriores son puramente
   aditivos.
5. **Punto de no retorno, solo tras validación completa en producción**:
   eliminar `owner_id` de las tablas de negocio y `lawyer_profiles` en
   favor de `notary_profiles`. No se ejecuta en la misma iteración que el
   paso 4 — requiere un período de observación primero.

Ningún usuario actual necesita "aceptar" nada ni pasar por un flujo de
invitación: su cuenta existente se convierte automáticamente en el
propietario de su propia oficina de un solo miembro, con exactamente los
mismos datos visibles que tenía antes. La invitación de asistentes es un
paso posterior, opcional, decidido por el propio notario.

---

## 4. Roles iniciales

| Rol | Quién | Puede ser removido/degradado | Notas |
|---|---|---|---|
| `propietario` | El Notario dueño de la Oficina | No por otro miembro; solo transfiriendo propiedad explícitamente | Control total, incluida gestión de miembros y eliminación del workspace |
| `administrador` | Delegado de confianza del notario (opcional) | Sí, por `propietario` | Gestiona miembros y configuración, pero no puede eliminar el workspace ni degradar al `propietario` |
| `asistente` | Personal operativo con cuenta propia | Sí, por `propietario`/`administrador` | Trabajo día a día: clientes, machotes, escrituras, cuentas por cobrar, según permisos granulares (§5) |
| `solo_lectura` | Consulta sin edición (p. ej. contador, revisor externo) | Sí, por `propietario`/`administrador` | Ve datos de la oficina, no puede crear ni modificar nada |

Un `workspace_members` con `status = 'revoked'` pierde acceso
inmediatamente (mismo mecanismo de revocación real ya construido en la
Iteración 2 — ver `docs/AUTH_SECURITY.md` — el chequeo de membresía activa
en cada RLS/RPC hace que un miembro revocado deje de calificar sin
depender de invalidar tokens).

---

## 5. Permisos granulares y matriz completa

### 5.1 Permisos (del spec, sin cambios)

```text
clients.read          clients.write
templates.read        templates.write
documents.create      documents.edit          documents.finalize
notarial_index.generate
receivables.manage    payments.register        payments.void
members.manage        settings.manage
```

### 5.2 Matriz de permisos por rol

| Permiso | `propietario` | `administrador` | `asistente` | `solo_lectura` |
|---|---|---|---|---|
| `clients.read` | ✅ | ✅ | ✅ | ✅ |
| `clients.write` | ✅ | ✅ | ✅ | ❌ |
| `templates.read` | ✅ | ✅ | ✅ | ✅ |
| `templates.write` | ✅ | ✅ | ✅ | ❌ |
| `documents.create` | ✅ | ✅ | ✅ | ❌ |
| `documents.edit` | ✅ | ✅ | ✅ | ❌ |
| `documents.finalize` | ✅ | ✅ | ⚠️ configurable | ❌ |
| `notarial_index.generate` | ✅ | ✅ | ⚠️ configurable | ❌ |
| `receivables.manage` | ✅ | ✅ | ✅ | ❌ |
| `payments.register` | ✅ | ✅ | ✅ | ❌ |
| `payments.void` | ✅ | ✅ | ❌ | ❌ |
| `members.manage` | ✅ | ✅ | ❌ | ❌ |
| `settings.manage` | ✅ | ✅ | ❌ | ❌ |

Notas de diseño:

- `documents.finalize` y `notarial_index.generate` quedan marcados
  **configurables por workspace** para `asistente` porque ambos tocan la
  responsabilidad legal directa del notario (finalizar una escritura y
  generar el índice protocolar) — algunas oficinas querrán que el
  asistente prepare pero el notario finalice; otras confiarán eso al
  asistente. Se modela como un flag en `workspace_members` (p. ej.
  `can_finalize_documents boolean default false`,
  `can_generate_notarial_index boolean default false`) en vez de
  hardcodearlo, evitando forzar una única política operativa. **No se
  implementa en esta iteración** — queda documentado como decisión de
  diseño para la iteración de implementación.
- `payments.void` se reserva a `administrador`+ porque anular un pago es
  una operación financiera con implicación de auditoría/immutabilidad ya
  reforzada en la Iteración 1 (`docs/PRODUCT_RULES.md`/receivables
  financial immutability) — un asistente no debería poder revertir dinero
  ya registrado sin supervisión.
- `members.manage`/`settings.manage` se reservan a `administrador`+ para
  que un `asistente` nunca pueda escalar su propio rol ni el de otros.

### 5.3 Enforcement en tres capas (defensa en profundidad)

1. **UI**: ocultar/deshabilitar acciones no permitidas según el rol del
   miembro actual (obtenido junto con la sesión, cacheado por request
   igual que `requireUser()` hoy).
2. **Server Actions/RPCs**: cada acción reemplaza su chequeo actual
   `owner_id = user.id` por "¿`user.id` es miembro activo del
   `workspace_id` objetivo, con un rol que incluye el permiso requerido?"
   — un único helper compartido (ver `requireWorkspaceMember(workspaceId,
   permission)` en §7), igual de centralizado que `requireUser()` hoy.
3. **RLS**: la última línea de defensa, igual de obligatoria que hoy —
   ver §5.4. La UI y los Server Actions nunca son la única autorización.

### 5.4 Plan de RLS

Reemplazar el predicado repetido `owner_id = auth.uid()` por una función
`STABLE SECURITY DEFINER` reutilizable:

```sql
create or replace function is_workspace_member(
  p_workspace_id uuid,
  p_min_roles text[] default array['propietario','administrador','asistente','solo_lectura']
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(p_min_roles)
  );
$$;
```

Políticas de ejemplo (reemplazando el patrón actual `owner_id =
auth.uid()`):

```sql
-- Lectura: cualquier miembro activo, incluido solo_lectura
create policy select_workspace on clients for select to authenticated
  using (is_workspace_member(workspace_id));

-- Escritura: excluye solo_lectura
create policy write_workspace on clients for insert to authenticated
  with check (is_workspace_member(workspace_id, array['propietario','administrador','asistente']));
```

Se evalúan explícitamente y se descartan los **JWT custom claims** para
guardar el rol (riesgo de quedar desactualizados tras un cambio de rol
hasta el próximo refresh de token — el mismo problema de "revocación no
inmediata" ya encontrado y corregido en la Iteración 2 para baneos). En su
lugar, `workspace_members` se consulta en vivo en cada request, igual que
`getUser()` ya se llama en cada request en `proxy.ts` por el mismo
motivo. El costo de una consulta adicional por policy es aceptable a la
escala de 10-20 oficinas del MVP; se puede revisar más adelante con
`auth_rls_initplan` (`(select auth.uid())`) si el Advisor de Supabase lo
señala.

Permisos granulares por acción (p. ej. `payments.void` solo para
`administrador`+) se aplican en el **RPC** correspondiente
(`void_receivable_payment` ya es `SECURITY DEFINER` y ya centraliza la
validación — se le agrega el chequeo de rol junto al de membresía), no en
la política RLS de la tabla base, porque RLS no distingue "qué RPC llamó
esto" — mismo patrón que ya usa el código para `register_receivable_payment`
hoy.

### 5.5 Orden de corte por tabla (para minimizar riesgo)

1. Tablas de solo lectura ampliada primero (`clients`, `templates`) —
   bajo riesgo, fáciles de revertir.
2. `documents`, `document_activity`, `document_notarial_metadata`.
3. `receivables`, `receivable_activity`, `receivable_payments` (las de
   mayor sensibilidad financiera, cortadas al final con más
   observación).
4. `notary_profiles`, `document_settings`, `workspace_members` (gestión
   de la oficina misma).

Cada tabla se corta en su propio PR pequeño, siguiendo la regla ya
existente en `docs/ARCHITECTURE.md` ("un motivo principal de cambio por
PR", "máximo tres ramas apiladas").

---

## 6. Modelo de auditoría con actor

Generalizar el patrón que ya existe en `document_activity`/
`receivable_activity` a **todas** las tablas mutables, no solo a las dos
que ya lo tienen:

- Cada trigger de auditoría escribe `workspace_id` (de quién son los
  datos) + `actor_user_id` (quién ejecutó la acción, `auth.uid()`
  **validado explícitamente**, no `coalesce` silencioso — corrigiendo la
  inconsistencia de §1.4).
- `actor_user_id` nunca tiene `on delete cascade` hacia `auth.users` — si
  un asistente se elimina de Auth, su historial de auditoría permanece
  (con el nombre resuelto en el momento de la consulta vía `left join`
  best-effort, mostrando "Usuario eliminado" si ya no existe, en vez de
  perder la fila de auditoría).
- El campo `metadata jsonb` existente se mantiene igual — sigue sin poder
  contener texto de escritura completo ni datos sensibles, mismas reglas
  de `docs/SECURITY.md`.
- Los eventos ya cubiertos (creación/cambio de estado, generación de
  Word, pagos, exportación de índice) no cambian de forma; solo dejan de
  asumir que `actor_user_id == owner_id`.

### 6.1 `document_notarial_metadata` y su propio historial

Sigue vinculado a `document_activity` (vía `document_id`) para su
auditoría de cambios — no necesita una tabla de actividad separada, ya
que hereda el `actor_user_id` de los eventos que ya dispara
`record_notarial_metadata_activity`.

---

## 7. Separación entre `actor_user` y `notary_profile`

Este es el cambio conceptual central del diseño, ya anticipado por el
modelo objetivo del spec:

```text
workspace_id   = propietario de los datos (alcance/RLS)
actor_user_id  = quién ejecutó la acción (auditoría)
notary_profile = identidad profesional responsable (Índice Notarial, membrete)
```

**Regla de resolución**: cualquier código que hoy resuelve la identidad
profesional a partir de `lawyer_profiles` filtrado por `user.id` (los 4
puntos encontrados en la auditoría: `export-actions.ts` de Documents y de
Notarial Index, `activity-queries.ts`, `dashboard/page.tsx`) pasa a
resolverla a partir de `notary_profiles` filtrado por el `workspace_id`
del recurso que se está exportando/mostrando — **nunca** por
`auth.uid()`. Un asistente que genera una Escritura o exporta el Índice
Notarial produce un documento con el nombre y código profesional del
notario de la oficina, no el suyo propio.

Un helper server-side reemplaza el patrón repetido:

```ts
// hoy, repetido en cada export-actions.ts:
const { data: profile } = await supabase
  .from("lawyer_profiles")
  .select("full_name, professional_code")
  .eq("owner_id", user.id)
  .single();

// propuesto:
async function resolveNotaryProfile(supabase, workspaceId: string) {
  const { data } = await supabase
    .from("notary_profiles")
    .select("full_name, professional_code")
    .eq("workspace_id", workspaceId)
    .single();
  return data;
}
```

`document_settings` (formato del documento) sigue el mismo cambio de
alcance (`owner_id` → `workspace_id`), consolidando en un único lugar
(`settings-loader.ts`, ya el único punto de lectura hoy) el paso de
"¿de qué oficina son estas preferencias?" en vez de "¿de qué usuario?".

---

## 8. Plan de RLS, rollout y rollback

### 8.1 Rollout (por fases, cada una su propio PR/branch)

1. **Fase A — aditiva, sin riesgo de comportamiento**: crear
   `workspaces`, `notary_profiles`, `workspace_members`; backfill;
   agregar `workspace_id` nullable→not null a todas las tablas
   existentes sin tocar RLS todavía. `owner_id` se mantiene funcionando
   exactamente igual que hoy durante toda esta fase.
2. **Fase B — cambio de RLS, tabla por tabla**, siguiendo el orden de
   §5.5. Cada corte es reversible de forma aislada (ver rollback abajo).
   Durante esta fase el código de aplicación sigue leyendo/escribiendo
   por `owner_id` para las tablas aún no cortadas y por `workspace_id`
   para las ya cortadas — es decir, la migración de código TypeScript
   ocurre en el mismo PR que corta cada tabla, no antes ni después.
3. **Fase C — invitaciones y gestión de miembros** (UI +
   `workspace_members` CRUD + email de invitación reusando el patrón ya
   construido en `docs/AUTH_SECURITY.md` para recuperación de
   contraseña) — solo después de que Fase B esté completa y validada.
4. **Fase D — limpieza**: eliminar `owner_id` de las tablas de negocio y
   `lawyer_profiles`, solo tras un período de observación en producción
   sin incidentes (mínimo unas semanas de uso real con al menos una
   oficina multiusuario activa).

### 8.2 Rollback

- **Durante Fase A**: trivial — son tablas nuevas y columnas nullable
  sin consumidores todavía; se puede revertir la migración sin efecto en
  producción.
- **Durante Fase B (por tabla)**: cada corte de RLS se acompaña de un
  script de reversión que restaura la política `owner_id = auth.uid()`
  para esa tabla específica — posible porque `owner_id` todavía existe y
  sigue poblado correctamente (no se dejó de mantener). El código
  TypeScript de esa tabla también revierte en el mismo rollback (mismo
  PR revertido).
- **Después de Fase D**: no reversible sin restaurar desde backup —
  exactamente igual de irreversible que cualquier `drop column` hoy. Por
  eso Fase D se pospone deliberadamente y no es parte de esta iteración
  de diseño ni de la primera de implementación.

### 8.3 Qué NO cambia con este diseño

- RLS sigue siendo la autorización real, no la UI ni los Server Actions
  (mismo principio ya establecido en `docs/SECURITY.md`).
- Ningún dato nuevo de los prohibidos en `docs/DATABASE.md`/`AGENTS.md`
  se introduce (sin storage de Word/PDF, sin texto completo de
  escritura, etc.).
- Los `SECURITY DEFINER` RPCs existentes conservan su forma — se les
  agrega el chequeo de rol/membresía en el mismo lugar donde ya validan
  `auth.uid()`, no se reescriben desde cero.
- Las vistas (`notarial_index_entries`, `receivable_entries`) no
  requieren cambios propios gracias a `security_invoker = on` — heredan
  el nuevo RLS automáticamente.

---

## 9. Explícitamente fuera de alcance de esta iteración

Por instrucción directa del spec:

- No se escribió SQL, migraciones, ni políticas RLS reales.
- No se implementó ningún flujo de invitación.
- No se tocó Supabase Cloud.
- No se cambió ninguna UI.
- No se definieron los flags `can_finalize_documents`/
  `can_generate_notarial_index` a nivel de esquema — quedan documentados
  como decisión de diseño para cuando se implemente.

## 10. Siguiente paso

Este documento requiere aprobación explícita del usuario antes de que
cualquier iteración de implementación (4, 5 o 6, según
`00_ORDEN_DE_TRABAJO.md`) pueda comenzar.

## 11. Iteración 4 — estado real de la implementación

Migración: `supabase/migrations/20260804200000_workspace_foundation.sql`.
Test: `supabase/tests/rls_workspace_foundation.test.sql` (18 aserciones —
propietario, miembro activo, externo, suspendido, manipulación de IDs).

### 11.1 Simplificación clave frente al diseño de la Iteración 3

El diseño original (§2.2) proponía `workspace_id` como columna
independiente, poblada explícitamente por cada Server Action/RPC. La
implementación real usa un atajo mucho más seguro, posible exactamente
porque esta iteración solo tiene un rol funcional (`propietario`):

- El `workspaces.id` de cada Workspace "bootstrap" (uno por cada usuario
  existente, y uno automático para cada usuario futuro vía un trigger en
  `auth.users`) es **el mismo uuid** que el `auth.users.id` de su
  propietario.
- `workspace_id` en las 14 tablas de negocio es
  `generated always as (owner_id) stored` — una función determinista de
  `owner_id`, no una columna independiente.

Esto significa que, mientras el sistema tenga un único rol funcional:

- **Cero cambios de TypeScript fueron necesarios** — ningún Server Action
  ni RPC necesitó empezar a pasar `workspace_id`; se calcula solo. Verificado
  end-to-end (no solo en pgTAP): los 757 tests unitarios, el build, y la
  suite completa de E2E autenticado (Clientes, Machotes, Escrituras, Índice,
  Cuentas por cobrar, Pagos, Configuración, DOCX, historial) pasan sin
  ninguna modificación al código de aplicación.
- **La manipulación de IDs es estructuralmente imposible**, no solo
  bloqueada por RLS: Postgres rechaza cualquier INSERT/UPDATE que intente
  fijar un valor explícito en una columna generada
  (`cannot insert a non-DEFAULT value into column ... generated column`).
- **Limitación real y documentada**: un miembro no-propietario (p. ej. un
  "asistente" agregado directamente a `workspace_members` por SQL, ya que
  todavía no existe UI de invitación) puede ver los datos del Workspace del
  que es miembro, pero **no puede escribir "dentro" de él** — cualquier fila
  que inserte con su propio `owner_id` cae automáticamente en su propio
  Workspace (generado desde su propio `owner_id`), nunca en el Workspace
  ajeno. Verificado explícitamente en
  `rls_workspace_foundation.test.sql`. Esto se resuelve en la iteración que
  implemente invitaciones reales, convirtiendo `workspace_id` en columna
  independiente (`alter table ... alter column workspace_id drop expression`)
  y actualizando los Server Actions/RPCs para que un asistente pueda escribir
  explícitamente en el Workspace del que es miembro — trabajo real, no
  cubierto por esta iteración.
- `notary_profiles` **no se creó** — no estaba en el alcance de la
  Iteración 4 (`Crear o adaptar: workspaces, workspace_members`
  únicamente). `lawyer_profiles`/`document_settings` ganaron `workspace_id`
  (misma columna generada) pero conservan su forma; la separación
  `notary_profile` vs `actor_user` (§7) sigue pendiente.
- La corrección legal de numeración de protocolo (§2.3, mover
  `dnm_owner_year_instrument_key` de `owner_id` a `notary_profile_id`)
  **tampoco se hizo** — sigue escrita sobre `owner_id`, correcto hoy porque
  solo existe el rol propietario (sin riesgo real de colisión entre
  notario y asistente todavía), pero queda pendiente para cuando
  `notary_profiles` exista.

### 11.2 RLS: qué cambió realmente

Cada tabla reemplazó su condición externa `owner_id = auth.uid()` por
`is_workspace_member(workspace_id, ...)` (lectura: cualquier miembro
activo; escritura: solo rol `propietario`, el único que existe hoy). Los
`exists(...)` anidados que validan relaciones padre/hijo (p. ej. "el
machote de este campo es mío") se dejaron con su forma original
`owner_id = auth.uid()` — siguen siendo correctos porque `workspace_id` es
una función determinista de `owner_id` en esta iteración; quedan marcados
en el propio archivo de migración como el punto que la iteración de
asistentes reales sí tendrá que revisar.

Las funciones `SECURITY DEFINER` invocadas directamente por Server Actions
(`register_receivable_payment`, `void_receivable_payment`,
`save_template_workspace`, `save_template_index_configuration`,
`save_template_index_mapping`, `save_template_index_mapping_with_block_source`,
`log_document_word_generated`, `log_notarial_index_export`) reciben el
mismo chequeo `is_workspace_member` — son la única puerta que RLS no cierra
por sí sola, porque por definición evitan RLS. Los triggers que solo se
disparan como efecto secundario de una mutación ya autorizada por esa
misma RLS (`record_document_activity`, `record_receivable_activity`,
`enforce_receivable_payment_consistency`,
`sync_receivable_client_name_snapshot`,
`mark_template_index_configuration_incomplete`,
`enforce_notarial_metadata_editable`, `record_notarial_metadata_activity`)
no se tocaron — heredan la protección de la tabla que los dispara.

### 11.3 Runbook de rollback

Cada paso es reversible de forma aislada porque `owner_id` se conservó sin
tocar en las 14 tablas (nunca se eliminó ni se dejó de mantener):

1. **Revertir solo el corte de RLS** (si `workspace_id`/`workspaces` deben
   quedarse pero el comportamiento de acceso debe volver a como era):
   recrear las 4 políticas `<tabla>_*_own` originales
   (`owner_id = auth.uid()`, con los mismos `exists(...)` anidados —
   texto exacto disponible en el historial de git de cada migración
   anterior a `20260804200000_workspace_foundation.sql`) y hacer
   `drop policy` de las `_workspace` nuevas. Cero riesgo de pérdida de
   datos: `owner_id` sigue siendo la fuente de verdad subyacente.
2. **Revertir también las columnas `workspace_id`**: `alter table <tabla>
   drop column workspace_id` en las 14 tablas (Postgres permite eliminar
   una columna generada como cualquier otra). `workspaces`/
   `workspace_members` pueden eliminarse (`drop table`) o dejarse huérfanas
   sin ningún efecto, ya que ninguna tabla de negocio las referenciaría
   después de este paso.
3. **Revertir el bootstrap automático**: `drop trigger
   auth_users_bootstrap_workspace on auth.users` y `drop function
   public.bootstrap_workspace_for_new_user()` — usuarios nuevos dejan de
   recibir un Workspace (vuelve al comportamiento anterior a esta
   iteración, donde el concepto no existía).
4. **No reversible sin restaurar desde backup**: si en algún momento
   posterior se elimina la columna `owner_id` de alguna tabla (Fase D del
   diseño original, explícitamente NO parte de esta iteración) — por eso
   esa fase se sigue posponiendo.

Ningún paso de este runbook requiere tocar Supabase Cloud, porque esta
migración **no se desplegó a Cloud** en esta iteración (restricción
explícita del spec: "No desplegar a Supabase Cloud antes de CI, pgTAP,
prueba local y revisión manual del plan" — CI/pgTAP/local ya están verdes;
la revisión manual y el despliegue a Cloud quedan como paso separado,
explícito, a decidir por el usuario).

## 12. Iteración 5 — Roles, invitaciones y permisos: estado real de la implementación

Migraciones:
`supabase/migrations/20260804210000_workspace_roles_and_invitations.sql`
(el grueso), `20260804220000_pending_workspace_invitation_lookup.sql`
(`get_pending_workspace_invitation()`) y
`20260804230000_list_workspace_members.sql`
(`list_workspace_members()`). Tests:
`rls_workspace_roles_and_invitations.test.sql` (30 aserciones),
`rls_pending_workspace_invitation.test.sql` (5),
`rls_list_workspace_members.test.sql` (4), más el ajuste de una aserción
en `rls_workspace_foundation.test.sql` (ver 12.2). E2E:
`e2e/team-management-authenticated.spec.ts` (proyecto autocontenido
`chromium-team-management`, sin `storageState` compartido). Unit:
`src/lib/server/permissions.test.ts`.

### 12.1 `workspace_id` deja de ser una columna generada

La simplificación de la Iteración 4 (§11.1) — `workspace_id` como
`generated always as (owner_id) stored` — dependía de que solo existiera
un rol funcional. En cuanto un asistente necesita escribir dentro del
Workspace de su propietario (un `owner_id` distinto del suyo), esa
columna generada se vuelve la limitación exacta que §11.1 ya anticipaba.
Esta iteración la revierte:

- `alter table <14 tablas> alter column workspace_id drop expression` —
  ahora es una columna normal, escribible.
- Un nuevo trigger BEFORE INSERT, `default_workspace_id_from_actor()`
  (nombrado `<tabla>_default_workspace_id` en cada tabla — el orden
  alfabético de triggers de Postgres importa: debe ejecutarse antes que
  `dnm_enforce_editable`/`receivables_sync_client_name_snapshot`), rellena
  `workspace_id` desde la membresía activa de
  `coalesce(auth.uid(), new.owner_id)` cuando el caller no lo pasa
  explícito. El `coalesce` con `owner_id` es necesario porque los fixtures
  de pgTAP insertan como superusuario de Postgres, sin JWT — sin él, cada
  test de la suite existente habría fallado con `workspace_id` nulo.
- Efecto colateral importante: el tipo `Insert` generado por
  `supabase gen types` sigue marcando `workspace_id` como requerido
  (Postgres no expone defaults basados en triggers al generador de tipos),
  así que cada INSERT explícito en TypeScript debe seguir pasando
  `workspace_id` aunque la base de datos lo rellenaría sola si se omitiera.
- 13 FKs compuestas que emparejaban `(hijo_id, owner_id)` con
  `(padre.id, padre.owner_id)` pasan a `(hijo_id, workspace_id)` — de lo
  contrario, un asistente (con su propio `owner_id`) no podía insertar un
  campo bajo un machote que no le pertenece a él sino a su propietario.
  Se agregaron 6 unique constraints nuevas para soportarlas.

### 12.2 RLS y permisos: matriz aplicada en tres capas

La matriz de §5.2 se aplicó tal cual, sin permisos personalizados por
casilla ni rol "Personalizado" (restricción explícita del spec de esta
iteración). Las políticas INSERT/UPDATE de clients/templates/
template_fields/documents/receivables/document_notarial_metadata se
ampliaron a `['propietario', 'administrador', 'asistente']`;
lawyer_profiles/document_settings a `['propietario', 'administrador']`.
`documents.finalize` no se puede expresar como una condición RLS simple
(un UPDATE que solo cambia `status` a `final` debe distinguirse de
cualquier otro UPDATE), así que tiene su propio trigger dedicado,
`enforce_document_finalize_permission` — mismo patrón que
`enforce_notarial_metadata_editable`/`block_delete_final_documents`, ya
existentes en este código base.

Durante la reescritura de las políticas se detectó (vía pgTAP, no por
inspección) una regresión real de seguridad: las nuevas condiciones
`is_workspace_member(...)` habían quedado sin el `owner_id = auth.uid()`
que las políticas originales sí tenían, permitiendo a cualquier miembro
forjar el `owner_id` de una fila ajena dentro del mismo Workspace. Se
corrigió reintroduciendo `owner_id = auth.uid() and` al inicio de cada
`with check`. Registrado aquí porque es exactamente el tipo de regresión
que una migración de este tamaño puede introducir sin que ningún test
*nuevo* la detecte — solo los tests *existentes* de "no se puede forjar
owner_id" (`rls_documents.test.sql` y análogos) la atraparon, al pasar
inesperadamente.

`rls_workspace_foundation.test.sql` (Iteración 4) tenía una aserción que
codificaba la limitación que esta iteración existe para resolver: un
asistente insertando una fila terminaba en su propio Workspace, no en el
compartido. Esa aserción se actualizó para reflejar el comportamiento
correcto (termina en el Workspace compartido) — un cambio de test
deliberado, no una regresión encubierta.

### 12.3 Invitaciones: un Workspace activo por usuario, sin selector

Cada usuario pertenece a exactamente un Workspace activo a la vez — una
decisión de diseño propia (no está en el spec) para evitar construir un
selector de "Workspace actual" en la UI. `accept_workspace_invitation`
elimina la fila `workspace_members` del Workspace personal del invitado
al aceptar una invitación real, reutilizando el trigger de limpieza de
Workspaces huérfanos de la Iteración 4 (`cleanup_orphaned_workspace`) para
borrar también la fila `workspaces` correspondiente.

**Efecto secundario no cubierto por esta iteración**: un miembro
*removido* (no suspendido, no baneado) se queda sin ninguna membresía
activa — su Workspace personal ya no existe. `requireWorkspace()` lo
manda de vuelta a `/login` en el siguiente intento aunque sus credenciales
sigan siendo válidas. Verificado explícitamente en
`e2e/team-management-authenticated.spec.ts`. Si un removido debe poder
seguir usando la cuenta con un Workspace propio nuevo, hace falta decidir
y construir ese flujo — no implementado aquí.

El flujo de correo reutiliza el patrón de `/auth/confirm` de la Iteración
2 (`token_hash` + `type`, ya genérico para cualquier `EmailOtpType`):
`admin.inviteUserByEmail` (service role, `src/lib/supabase/admin.ts`,
nunca importado desde el cliente) crea la cuenta y dispara el correo con
la plantilla `supabase/templates/invite.html`
(`config.toml` → `[auth.email.template.invite]`); el enlace apunta a
`/auth/confirm?type=invite&next=/accept-invite`. `/accept-invite` exige
fijar contraseña (`updateUser`, mismo patrón que `/update-password`) y
llama a `accept_workspace_invitation` en el mismo submit.

### 12.4 Jerarquía de gestión de miembros

`assert_can_manage_target_member(caller_role, target_role)` (SQL) y
`canManageMember()` (`src/lib/server/permissions.ts`, espejo exacto para
la UI) implementan: el propietario es inmutable (nadie puede cambiarle el
rol, suspenderlo ni removerlo); un administrador puede gestionar
asistente/solo_lectura pero no a otro administrador ni al propietario.
`remove_workspace_member` registra el evento de auditoría **antes** del
`delete` (comentario explícito en la migración: así la auditoría queda
escrita incluso si una futura constraint llegara a bloquear el delete).

### 12.5 Qué NO se implementó (fuera de alcance explícito)

- Permisos personalizados por casilla ni rol "Personalizado" — restricción
  explícita del spec de esta iteración.
- La separación `actor_user` vs `notary_profile` (§7) — el Índice y el
  historial de actividad siguen sin distinguir "quién generó el borrador"
  de "a nombre de qué Notario aparece en el documento". Es exactamente el
  alcance de la Iteración 6, deliberadamente no empezada (ver §9 y la
  decisión explícita de secuenciar las iteraciones una a la vez).
- Firma digital ni envío oficial — no aplica a esta iteración tampoco.

## 13. Iteración 6 — Identidad notarial y auditoría de actores: estado real de la implementación

Migración: `supabase/migrations/20260805100000_actor_identity_audit_snapshots.sql`.
Test: `supabase/tests/rls_actor_identity_audit_snapshots.test.sql` (19
aserciones). E2E: `e2e/notary-identity-actor-audit-authenticated.spec.ts`
(proyecto autocontenido `chromium-notary-identity-actor-audit`).

### 13.1 `lawyer_profiles` YA ES el `notary_profile` — no se creó tabla nueva

El objetivo de la iteración (§ modelo del spec: separar `actor_user` de
`notary_profile`) llevaba implícita la pregunta de si había que crear una
tabla `notary_profiles` nueva. La auditoría del código existente (hecha
antes de escribir una sola línea) encontró que **ya no hacía falta**:
`lawyer_profiles` es, desde la Iteración 5 (§12.1), una fila única por
`workspace_id` — exactamente la forma de un `notary_profile` — y el Índice
Notarial **ya leía el nombre del notario desde ahí**, nunca desde el
usuario autenticado
(`src/features/notarial-index/server/export-actions.ts`, sin cambios en
esta iteración). "Consolidar" (palabra del spec) se interpretó como usar
lo que ya existe, documentado aquí, en vez de construir infraestructura
paralela redundante.

Lo que sí hacía falta y no existía: la página de Configuración mostraba el
formulario de `lawyer_profiles` totalmente interactivo a CUALQUIER
miembro, incluido un asistente — el guardado fallaba solo en el servidor
(`settings.manage`) y en RLS, sin ninguna señal en la UI. Se corrigió
pasando `canManage = hasPermission(role, "settings.manage")` a
`SettingsWorkspace` (`src/app/(dashboard)/dashboard/settings/page.tsx` →
`_components/SettingsWorkspace.tsx`): todos los campos quedan `disabled`,
la barra de guardar/descartar no se renderiza, y un aviso explica por qué.

### 13.2 `actor_name_snapshot` / `actor_role_snapshot` en las cuatro tablas de auditoría

`document_activity`, `receivable_activity`, `workspace_activity`
(Iteración 5) y `notarial_index_exports` ganaron dos columnas `not null`:
`actor_name_snapshot` (el email del actor — no existe una tabla de
"nombre por usuario" en este esquema; `lawyer_profiles` es la identidad
del Workspace, no de la persona) y `actor_role_snapshot` (su rol en el
Workspace al momento del hecho). Ambas se fijan una sola vez, en el
momento del INSERT, por un helper único:

```sql
resolve_actor_snapshot(p_workspace_id uuid, p_actor_user_id uuid)
  returns (actor_name text, actor_role text)
```

`SECURITY DEFINER`, con fallback a `'desconocido'` si el actor no se puede
resolver (defensivo — la auditoría nunca debe romperse por esto). Los 11
puntos de escritura existentes (`record_document_activity`,
`record_notarial_metadata_activity`, `log_document_word_generated`,
`record_receivable_activity`, `register_receivable_payment`,
`void_receivable_payment`, `log_notarial_index_export`,
`invite_workspace_member`, `accept_workspace_invitation`,
`change_workspace_member_role`, `suspend_workspace_member`,
`reactivate_workspace_member`, `remove_workspace_member`) se reescribieron
para poblarlas — ninguno cambió su lógica de negocio, solo agregaron la
resolución + las dos columnas al `insert`. Backfill de filas existentes:
mejor esfuerzo con el estado ACTUAL de `auth.users`/`workspace_members`
(no se puede reconstruir el estado histórico real; todo evento nuevo
queda fijado correctamente para siempre).

**Verificado explícitamente por pgTAP** (no solo por diseño): cambiar el
rol de un actor, o removerlo del Workspace, **no** altera
retroactivamente el `actor_role_snapshot`/`actor_name_snapshot` de sus
eventos pasados — es la prueba central de "no depender del nombre actual
del usuario para hechos históricos" (texto literal del spec).

### 13.3 `list_workspace_activity()`: workspace_activity pasa de escrito-pero-nunca-leído a visible

La auditoría de Iteración 5 (invitar/aceptar/cambiar rol/suspender/
reactivar/remover) se escribía desde el día uno pero **ningún código de
`src/` la leía** — "Mi equipo" no tenía ninguna vista de historial. Nuevo
RPC `list_workspace_activity(p_limit)`, mismo patrón que
`list_workspace_members()` (acota al Workspace activo del caller vía
`SECURITY DEFINER`), añade una sección "Actividad" a
`/dashboard/team` (`WorkspaceActivityList.tsx`). Resuelve el email
ACTUAL del `target_user_id` como etiqueta de conveniencia (no un
snapshot histórico — el dato con garantía histórica es
`actor_name_snapshot`/`actor_role_snapshot`, no el target).

### 13.4 UI: nombre real del actor en vez de "Tú" / "Otro miembro del equipo"

`src/features/documents/server/activity-queries.ts` y
`src/features/receivables/server/detail-queries.ts` ahora seleccionan
`actor_name_snapshot`/`actor_role_snapshot` y arman
`"Tú"` (si `actor_user_id === user.id`) o `"{email} ({rol})"` en caso
contrario — resuelto una sola vez en el servidor, nunca en el cliente.
Sustituye el placeholder genérico que existía desde la Iteración 5 (ver
comentario, ya eliminado, en `activity-queries.ts`).

### 13.5 `documents.export`: permiso explícito, sin cambio de comportamiento

El spec pide "definir quién puede... exportar DOCX". La exportación de la
Escritura (`prepareDocumentDocxExport`) no tenía ningún chequeo de
permiso — solo `requireApiWorkspace()` (cualquier miembro activo). Se
decidió que exportar es una acción de lectura (formatear contenido ya
visible para descarga), no una sensible, así que se agregó
`documents.export` a la matriz con los 4 roles (mismo nivel que
`clients.read`) y el chequeo correspondiente — defensa en profundidad y
documentación explícita de la decisión, sin cambiar quién puede hacerlo
hoy. `notarial_index.generate` (Índice) sigue restringido a
propietario/administrador, sin cambios — es la acción sensible real.

### 13.6 Qué NO se hizo (fuera de alcance explícito)

- No se agregó ningún snapshot de identidad notarial al DOCX de la
  Escritura ni al Índice: ambos ya usaban `lawyer_profiles` correctamente
  (Índice) o no tenían ningún dato de identidad que corregir (Escritura —
  es el documento legal en sí, no un registro con "quién lo generó").
  Verificado, no modificado: `src/features/notarial-index/export/notarial-docx.test.ts`.
- No se creó una tabla `notary_profiles` separada (§13.1).
- Firma digital ni envío oficial — restricción explícita del spec,
  igual que en la Iteración 5.
