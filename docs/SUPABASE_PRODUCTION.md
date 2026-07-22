# Supabase Cloud — entorno productivo (LexCR)

Este documento describe el entorno productivo de Supabase Cloud para el
piloto privado de LexCR. No contiene secretos: ni tokens, ni contraseñas,
ni claves — solo nombres y configuración pública.

## Proyecto

| Campo | Valor |
|---|---|
| Nombre | `lexcr-production` |
| Organización | `MurilloS25's Org` |
| Región | `us-east-1` (N. Virginia, AWS) |
| Plan | **Free** — $0/mes confirmado antes de crear el proyecto, sin add-ons |
| Creado | 2026-07-22 |
| Postgres | 17.6 (release channel GA) |
| Project ref | `iicsltjlnmawkobqnhpi` |
| API URL | `https://iicsltjlnmawkobqnhpi.supabase.co` |

**Razón de la región:** la infraestructura de internet de Costa Rica
enruta predominantemente a través de Miami, que tiene muy buena
interconexión con `us-east-1`. Es la región AWS de menor latencia típica
para Centroamérica, confirmada con el usuario antes de crear el proyecto
(alternativas consideradas: `sa-east-1` São Paulo, `us-east-2` Ohio).

Existe además un proyecto anterior, no relacionado y sin usar
(`MurilloS25's Project`, region `us-east-2`, creado 2025-09-19, estado
`INACTIVE`) — no se tocó ni se reutilizó.

## CLI y flujo usado

- CLI: `supabase` v2.100.1 (via `pnpm exec supabase`), disponible pero
  **sin sesión iniciada** en este entorno (`supabase login` requiere un
  flujo de navegador no disponible aquí, y no correspondía pedirle al
  usuario que pegara un access token en el chat).
- En su lugar se usó el servidor MCP de Supabase (ya autenticado),
  funcionalmente equivalente para este despliegue:
  - `apply_migration` en vez de `supabase db push` — se aplicaron las 20
    migraciones **una por una, en orden cronológico**, verificando éxito
    de cada una antes de continuar (más seguro que un solo `push` en
    lote: cualquier error se detiene en la migración exacta que falló).
  - `get_advisors` en vez de la revisión manual del Security Advisor del
    dashboard.
  - No hubo un "dry run" en el sentido literal de `--dry-run`; en su
    lugar se hizo una auditoría estática completa de las 20 migraciones
    (ver más abajo) antes de aplicar nada, y cada migración se verificó
    individualmente contra la base real conforme se aplicaba.

Si en el futuro se prefiere usar el CLI directamente:
```bash
supabase login
supabase link --project-ref iicsltjlnmawkobqnhpi
supabase db push
```

## Auditoría previa (Fase 3-4)

Se auditaron las 20 migraciones (`supabase/migrations/*.sql`) antes de
aplicar nada. Resumen:

- **Orden/dependencias:** limpio, sin referencias hacia adelante — las 20
  migraciones aplican en orden de nombre de archivo sin conflicto.
- **SQL local-only:** ninguno encontrado en las migraciones (config.toml
  tiene valores de desarrollo local, pero `db push`/`apply_migration` no
  lo aplican — solo afecta al CLI local).
- **Extensión:** solo `pgcrypto` (disponible por defecto en Cloud).
- **RLS:** habilitada en las 16 tablas de `public`; cada política
  INSERT/UPDATE que referencia otra tabla revalida `owner_id = auth.uid()`
  contra esa tabla (no confía solo en la FK compuesta).
- **Vistas:** ambas (`notarial_index_entries`, `receivable_entries`) usan
  `security_invoker = on` y unen contra tablas ya filtradas por owner.
- **Funciones `SECURITY DEFINER`:** todas fijan `search_path` explícito;
  ninguna otorga `EXECUTE` a `PUBLIC` ni `anon`; las RPCs pensadas para
  el cliente se otorgan solo a `authenticated`, y cada una valida
  `auth.uid()`/ownership de forma independiente antes de mutar datos.
- **Realtime:** no habilitado para ninguna tabla (confirmado, cero
  referencias a publicaciones en las migraciones).
- **Storage:** no usado (cero buckets, cero políticas de `storage.objects`).
- Dos observaciones menores, no bloqueantes, documentadas pero no
  corregidas en esta tarea (no había hallazgo real que forzara una
  migración correctiva):
  1. `document_metadata`/`notarial_records`/la primera versión de
     `receivables` (todas de la migración inicial) son andamiaje sin uso
     real por el código de la aplicación — correctamente protegidas por
     RLS, solo superficie sin usar.
  2. Un puñado de funciones trigger (`record_document_activity`,
     `record_receivable_activity`, `sync_receivable_client_name_snapshot`,
     `enforce_receivable_payment_consistency`) confían en el RLS de la
     tabla base en vez de revalidar `auth.uid() = owner_id` dentro de la
     función, a diferencia del patrón más defensivo usado en
     `enforce_notarial_metadata_editable`. Seguro hoy porque el RLS de
     base está correcto, pero inconsistente en estilo.

## Migraciones aplicadas

Las 20 migraciones se aplicaron una por una, en orden, sin errores:

1. `initial_schema`
2. `documents`
3. `documents_client_id`
4. `document_status_lifecycle`
5. `document_activity`
6. `document_notarial_metadata`
7. `notarial_index_view`
8. `notarial_index_exports`
9. `receivables_core`
10. `receivable_payments`
11. `receivables_summary`
12. `template_transactional_save`
13. `strengthen_notarial_index_data_model`
14. `template_index_configuration`
15. `notarial_index_docx_export`
16. `extend_template_index_mapping`
17. `simplify_document_lifecycle_events`
18. `receivables_free_client_name`
19. `template_field_autofill_transform`
20. `block_delete_final_documents`

Verificado después del push: 16 tablas en `public`, todas con
`rls_enabled = true`, todas con **0 filas** (sin datos de negocio).

## Seguridad — Security Advisor

`get_advisors(type=security)` tras aplicar todas las migraciones:
**7 hallazgos, todos `WARN`, cero `ERROR`/BLOCKER/HIGH.**

Los 7 son la misma clase de aviso ("Signed-In Users Can Execute
SECURITY DEFINER Function") sobre estas RPCs, todas intencionalmente
diseñadas así:

- `log_document_word_generated`
- `log_notarial_index_export`
- `register_receivable_payment`
- `save_template_index_configuration`
- `save_template_index_mapping`
- `save_template_workspace`
- `void_receivable_payment`

Cada una valida `auth.uid()` y ownership de forma independiente dentro
de su propio cuerpo (confirmado en la auditoría previa) — el patrón es
intencional (operaciones transaccionales/atómicas que necesitan
`SECURITY DEFINER` para escribir en tablas sin política INSERT directa,
como `document_activity`/`receivable_activity`), no un descuido.

`get_advisors(type=performance)` tras el push: solo sugerencias
estándar en una base vacía (`auth_rls_initplan` — envolver `auth.uid()`
en `(select auth.uid())` dentro de políticas RLS para cachear el plan de
consulta a escala; `unused_index`/`unindexed_foreign_keys` — esperables
sin datos reales todavía). Ninguna es de seguridad; ninguna se aplicó en
esta tarea ("sin optimizaciones masivas").

## Datos de negocio

**Confirmado: no se migró ninguna fila.** La base productiva arrancó
vacía y sigue vacía en todas las tablas de negocio (`clients`,
`templates`, `template_fields`, `documents`, `document_activity`,
`receivables`, `receivable_payments`, metadata notarial, etc.). No se
ejecutaron dumps, imports, seeds funcionales, scripts E2E ni fixtures.

## Auth

Estos pasos requieren el dashboard de Supabase directamente — ningún
tool disponible en este entorno puede leer/escribir configuración de
Auth ni invitar usuarios sin un access token que este entorno no tiene
(y que, por política, nunca se pide pegar en el chat). Por eso se le
pidió al usuario que los completara directamente.

**Registro público (Authentication → Settings → Auth):** confirmado
por el usuario como revisado y completado (`Allow new user signups` en
OFF, proveedor `Email` como único habilitado). No se pudo verificar de
forma independiente desde este entorno (sin acceso al dashboard ni a la
Management API) — queda registrado según la confirmación directa del
usuario, no una verificación automatizada.

**Usuarios autorizados (Authentication → Users → Add user → Send
invitation):** el usuario indicó que invitará directamente a las
personas autorizadas del piloto por su cuenta, sin necesidad de
compartir los correos en esta conversación. No se creó ningún usuario
desde este entorno (ni admin genérico, ni `test@test.com`, ni cuenta
demo).

Después de que cada persona acepte su invitación, conviene verificar
(desde la propia aplicación, ya logueada como esa persona):
- que se creó su fila en `lawyer_profiles` (si el flujo de la app la
  crea automáticamente al primer login, o si requiere completarse a mano
  en `/dashboard/settings`);
- que el `owner_id` es correcto;
- que no hay datos de otro usuario visibles.

## Pruebas de seguridad A/B — pendientes

La Fase 12 (aislamiento entre dos usuarios autorizados) requiere al
menos dos cuentas reales ya invitadas y confirmadas — no se puede
simular de forma significativa sin sesiones autenticadas reales, y el
usuario invitará a esas personas por su cuenta fuera de esta
conversación. Queda como pendiente explícito hasta que existan cuentas
reales que probar; no se marcó como completada.

## Conexión con Vercel

**Fecha de conexión:** 2026-07-22.

- **URL productiva:** `https://lexcr.vercel.app` (proyecto Vercel `lexcr`).
- **Site URL en Supabase Auth (Authentication → URL Configuration):**
  pendiente de que el usuario la configure a `https://lexcr.vercel.app`
  — ningún tool disponible en este entorno puede leer/escribir
  configuración de Auth (mismo motivo que el signup/proveedor
  documentado arriba). Ver `docs/VERCEL_PRODUCTION.md` para las
  instrucciones exactas dadas al usuario.
- **Redirect URL necesaria:** únicamente
  `https://lexcr.vercel.app/auth/confirm` — es el único endpoint de
  auth que existe en el código (`src/app/auth/confirm/route.ts`,
  verifica `token_hash`/`type` de invitación/OTP). No hay ruta de
  reseteo de contraseña ni callback OAuth en la aplicación; no se
  inventó ninguna ruta adicional.
- Verificado en vivo contra la Escritura desplegada: `/auth/confirm`
  sin parámetros redirige a `/login` sin error (comportamiento
  esperado del código).

## Variables para Vercel (solo nombres, nunca valores)

```text
NEXT_PUBLIC_SUPABASE_URL              -> https://iicsltjlnmawkobqnhpi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY         -> clave "anon"/"publishable" del proyecto (ver Fase 14)
```

Reglas:
- La clave anon/publishable puede llegar al navegador (es pública por
  diseño) — pero de todas formas no se imprime su valor en este
  documento ni en el chat, solo se confirma que existe y su nombre.
- La `service_role key` (si algún día se necesita server-side) **nunca**
  lleva prefijo `NEXT_PUBLIC_` y nunca se expone al navegador.
- La contraseña de la base de datos no se usa en la aplicación — no se
  guarda en ningún archivo del repo.
- No se creó `.env.production` versionado.
- No se copió ninguna clave a Vercel todavía (Vercel no se tocó en esta
  tarea, según alcance).

## Backup y operación (para cuando haya datos reales)

Documentado por adelantado; no se ejecutó ningún backup/restore real
(no hay datos de negocio todavía que respaldar).

- **Backup lógico manual:** `supabase db dump --linked -f backup.sql`
  (requiere `supabase login`/`link` con el CLI) o `pg_dump` contra la
  connection string del proyecto (Settings → Database). Guardar el
  archivo cifrado (p. ej. `age`/`gpg`) fuera del repositorio — nunca en
  Git, nunca en texto plano en un disco compartido.
- **Acceso al backup:** solo el propietario del proyecto (o quien el
  dueño del negocio autorice explícitamente); no se comparte por canales
  no cifrados.
- **Restaurar en un entorno no productivo:** crear un proyecto Supabase
  Cloud separado (o usar `supabase db reset --local` contra el stack
  local) y aplicar el dump ahí — nunca sobre `lexcr-production`
  directamente sin una razón explícita y confirmación del usuario.
- **Si el plan Free pausa el proyecto por inactividad:** Supabase Free
  pausa proyectos tras ~7 días sin actividad de API. Restaurar desde
  Dashboard → el proyecto pausado → "Restore project" (o
  `restore_project` vía MCP/API). Las migraciones y el esquema persisten
  durante la pausa; solo se pierde disponibilidad temporal, no datos.
- **Rotar claves:** Dashboard → Settings → API → regenerar la clave
  anon/publishable o la service-role si se sospecha exposición; también
  posible resetear la contraseña de base de datos desde Settings →
  Database. Cualquier rotación implica actualizar las variables de
  entorno en Vercel en el siguiente deploy.
- **Revocar un usuario:** Authentication → Users → seleccionar el
  usuario → eliminar/deshabilitar. Sus filas (`clients`, `templates`,
  `documents`, etc.) tienen `owner_id references auth.users(id) on
  delete cascade`, así que eliminar el usuario elimina también todos
  sus datos — confirmar con el dueño del negocio antes de hacerlo si
  hay datos reales de por medio.

## Límites del plan Free (referencia)

- Sin Point-in-Time Recovery (solo backups manuales).
- Proyecto se pausa tras inactividad prolongada (ver arriba).
- Sin Branching de base de datos como feature persistente del plan
  (existe `create_branch` vía API, que sí tiene costo — no usado aquí).
- Límites de tamaño de base de datos y de ancho de banda del plan
  gratuito vigentes en el dashboard del proyecto (verificar ahí para
  cifras actualizadas, cambian con el tiempo).

## Pendientes para Vercel (fase futura, no iniciada)

- Configurar `Site URL` y redirect URLs productivos en Supabase Auth
  una vez exista el dominio de Vercel.
- Configurar las variables de entorno documentadas arriba en el
  proyecto de Vercel.
- Deploy inicial y verificación end-to-end contra `lexcr-production`.

Nada de esto se tocó en esta tarea, según alcance explícito ("No
desplegar Vercel").
