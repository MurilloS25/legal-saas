# Vercel — despliegue productivo (LexCR)

Este documento describe el despliegue productivo de LexCR en Vercel,
conectado al proyecto `lexcr-production` de Supabase Cloud. No contiene
secretos: ni tokens, ni contraseñas, ni claves — solo nombres y
configuración pública.

## Estado conocido vigente

Última reconciliación documental: **2026-09-11**. El proyecto y la URL
Production existen y `main` es la rama productiva. Esta reconciliación no
consultó ni modificó Vercel Production, por lo que el deployment exacto debe
revalidarse en Vercel antes de un release. El último deployment verificado se
conserva abajo como historial; el HEAD actual conocido de `main` en Git es
`0c0b355ec9a47aed23ebfabc623ebcd731e2dc3f`.

## Proyecto

| Campo | Valor |
|---|---|
| Nombre del proyecto Vercel | `lexcr` |
| Plan | **Hobby** — $0/mes, sin add-ons |
| Team/cuenta | `sebasmu223-8786's projects` (cuenta personal) |
| Framework | Next.js (auto-detectado) |
| Package manager | pnpm (auto-detectado desde `pnpm-lock.yaml`) |
| Production Branch | `main` |
| Repositorio | `MurilloS25/legal-saas` (privado, cuenta personal — compatible con Hobby) |
| Región de las funciones | `iad1` (Washington D.C.) |
| URL productiva | `https://lexcr.vercel.app` |
| Otros dominios asociados | `lexcr-sebasmu223-8786s-projects.vercel.app`, `lexcr-git-main-sebasmu223-8786s-projects.vercel.app` |
| Método de importación | Git (Import Git Repository) — **no** el deploy directo de archivos; se preservó la integración continua desde `main` |
| Bundler | Turbopack |
| Node | 24.x |

**Gate de compatibilidad con Hobby (verificado antes de crear nada):**
- Repositorio privado bajo una cuenta de usuario personal de GitHub
  (`githubRepoOwnerType: "User"`), no una organización — compatible.
- El uso se confirmó explícitamente con el usuario como **piloto
  personal, no comercial** por ahora (sin clientes de pago todavía) —
  condición requerida por los términos de Hobby. Si esto cambia en el
  futuro, Hobby dejaría de ser válido y correspondería evaluar Pro.

## Auditoría de variables de entorno (Fase 3)

Se auditó cada referencia a `process.env` en `src/` antes de configurar
nada en Vercel. En ese momento el resultado fue exactamente 3 archivos y
2 nombres de variable:

```text
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/proxy.ts
```

`client.ts` se retiró posteriormente al confirmarse que no tenía consumidores.
En el momento de la auditoría, los tres archivos consumían:

```text
NEXT_PUBLIC_SUPABASE_URL               (requerida)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (preferida, el código la intenta primero)
NEXT_PUBLIC_SUPABASE_ANON_KEY          (fallback legacy, solo si la anterior no está)
```

**`SUPABASE_SERVICE_ROLE_KEY`:** en esa auditoría no se encontró ninguna
referencia en `src/` y no se configuró en Vercel.

Solo se configuró `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (no también
`NEXT_PUBLIC_SUPABASE_ANON_KEY`): el código ya prioriza la publishable
key, así que agregar ambas sería redundante sin necesidad real (regla
explícita de la tarea: no configurar las dos claves públicas salvo que
el código realmente use ambas a la vez).

## Variables configuradas (Production only)

| Variable | Entorno | Clasificación | Origen del valor |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Pública (URL del proyecto) | Supabase → `lexcr-production` → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production | Pública (diseñada para llegar al navegador) | Supabase → `lexcr-production` → Settings → API → Publishable key |

No se copiaron a Preview (regla explícita: las ramas Preview no deben
tener acceso automático a producción). El usuario configuró estas dos
variables directamente en el dashboard de Vercel — ningún tool
disponible en este entorno puede leer/escribir variables de entorno de
un proyecto Vercel existente, así que no se pudo verificar el scope
"Production only" de forma automatizada; se confirma **funcionalmente**
más abajo (la conexión a Supabase funciona en producción, lo que
requiere que ambas estén presentes ahí).

## Historial: deployment verificado el 2026-07-22

- **Commit desplegado en esa verificación:** `24cd5d66c3005e089f835b8cb77b27ba4e9e33d4` (rama `main`). No se debe asumir que sigue siendo el deployment activo sin consultar Vercel.
- **Estado:** `READY`, target `production`.
- **Origen:** `import` (integración Git), no un deploy de archivos sueltos.
- **Runtime:** funciones Lambda de Next.js (App Router), sin advertencias críticas en logs de build ni de runtime.
- **Errores de runtime (`get_runtime_errors`, últimas 24h):** ninguno.

## Configuración de Supabase Auth con la URL productiva (Fase 8)

Ningún tool disponible en este entorno puede leer/escribir la
configuración de Auth de Supabase (mismo motivo documentado en
`docs/SUPABASE_PRODUCTION.md`) — requiere el dashboard directamente.
Instrucciones exactas dadas al usuario:

**Authentication → URL Configuration** (proyecto `lexcr-production`):

1. **Site URL:** cambiar a `https://lexcr.vercel.app` (exacta, sin barra final duplicada).
2. **Redirect URLs necesarias para los flujos actuales:**
   ```text
   https://lexcr.vercel.app/auth/confirm
   https://lexcr.vercel.app/accept-invite
   https://lexcr.vercel.app/reset-password
   https://lexcr.vercel.app/update-password
   ```
   `/auth/confirm` conserva el callback defensivo con redirect interno seguro;
   invitación y recuperación usan páginas intermedias cuyo GET no consume el
   token. No hay callback OAuth ni comodines de redirect.
3. Mantener las URLs locales de desarrollo (`http://127.0.0.1:3000` o
   equivalente) si el equipo sigue desarrollando localmente — no se
   eliminan por rutina.
4. **Signup:** confirmar de nuevo `Allow new user signups: OFF`.
5. **Provider:** confirmar `Email: ON`, resto de proveedores `OFF`.

## Historial: decisión de redeploy de la configuración inicial

No se modificó ninguna variable de entorno después del deployment
inicial en esta tarea, así que no correspondió un redeploy adicional.
Si el Site URL de Supabase se actualiza (paso anterior) sin tocar
código ni variables de Vercel, **no** se requiere redeploy — el cambio
vive del lado de Supabase, no en el build de Vercel.

## Historial: validación productiva realizada sin contraseñas

Hecho en esta tarea, contra `https://lexcr.vercel.app`, sin usar
ninguna cuenta real:

| Chequeo | Resultado |
|---|---|
| `/` (raíz, sin sesión) | Redirige a `/login` — 307 |
| `/login` carga | 200, formulario visible, sin errores de consola |
| `/dashboard` (ruta protegida, sin sesión) | Redirige a `/login` — 307 |
| `/signup` | Redirige a `/login` — 307 (signup público desactivado en la app, PR #134) |
| `/auth/confirm` (sin `token_hash`/`type`) | Redirige a `/login` sin error, comportamiento esperado del código |
| Intento de login con credenciales inexistentes (`smoke-test-nonexistent@example.com`) | El servidor responde correctamente "Credenciales inválidas..." — confirma que la Server Action llega a Supabase Auth productivo end-to-end (URL + publishable key correctamente configuradas), sin usar ninguna contraseña real |
| Referencias a `localhost`/`127.0.0.1`/`54321`/`55321` en los bundles JS servidos | Ninguna real — un único falso positivo (`"localhost"===s.host` dentro de un polyfill genérico de parsing de URL, no una URL hardcodeada de la app) |
| `SUPABASE_SERVICE_ROLE_KEY` / `service_role` / claves `sb_secret_*` en bundles JS o en logs de runtime | Ninguna encontrada |
| Logs de runtime (`get_runtime_logs`, última hora) | Limpios: solo accesos HTTP estructurados (200/304/307), sin trazas de error, sin contenido sensible |
| Errores de runtime (`get_runtime_errors`, 24h) | Cero |

## Runbook de validación manual (requiere cuenta autorizada real)

No se pudieron ejecutar en esta tarea — requieren una contraseña real,
que nunca se maneja desde este entorno. Ejecutar con un usuario
autorizado real, una vez el usuario complete la invitación:

1. **Login:** ir a `https://lexcr.vercel.app/login`, ingresar con la
   cuenta autorizada real. Confirmar que redirige a `/dashboard`.
2. **Persistencia de sesión:** con sesión iniciada, refrescar la
   página (F5) y confirmar que la sesión se mantiene (no vuelve a
   `/login`).
3. **Acceso directo a ruta protegida:** con sesión iniciada, ir
   directamente a `https://lexcr.vercel.app/clients` (o
   cualquier ruta bajo `/dashboard`) y confirmar que carga sin
   redirigir a `/login`.
4. **Logout:** cerrar sesión desde el menú de la aplicación y
   confirmar que redirige a `/login`, y que `/dashboard` vuelve a
   redirigir tras el logout.
5. **Smoke test funcional** (datos ficticios, nunca jurídicos reales):
   - crear un Cliente ficticio;
   - crear un Machote sencillo y activarlo (estado `active`);
   - crear una Escritura desde ese Machote;
   - editar variables inline en el documento;
   - usar autollenado desde el Cliente creado;
   - si el Machote tiene Bloques de opciones, seleccionar una variante;
   - guardar la Escritura;
   - duplicarla ("Duplicar Escritura") y confirmar que la copia es un
     borrador independiente;
   - generar y **descargar el DOCX** (confirmar que el archivo abre
     correctamente y contiene el contenido esperado);
   - finalizar la Escritura original (no la copia);
   - abrir el Índice Notarial y confirmar que la Escritura finalizada
     aparece;
   - crear una Cuenta por cobrar ficticia asociada;
   - registrar un pago ficticio sobre esa cuenta;
   - revisar el historial de actividad de la Escritura;
   - cerrar sesión al terminar;
   - **eliminar los datos ficticios** creados (Cliente, Machote,
     Escritura, Cuenta por cobrar) una vez confirmado que todo
     funciona — no dejar basura de prueba en producción.
6. **Prueba de aislamiento A/B** (requiere una segunda cuenta
   autorizada real, invitada aparte):
   - con el Usuario A: crear Cliente A, Machote A, Escritura A, Cuenta
     por cobrar A (datos ficticios);
   - con el Usuario B (sesión distinta): intentar listar los datos de
     A, abrir el UUID de la Escritura A directamente por URL,
     modificarla, borrarla, duplicarla, generar su DOCX, invocar
     cualquier acción/RPC sobre ella, o asociar datos propios de B con
     IDs de A;
   - resultado esperado: **B no puede leer, modificar, eliminar,
     duplicar, descargar ni inferir ningún dato de A** — cada intento
     debe fallar de forma genérica (redirección, 404, o "no
     encontrado"), nunca revelar que el recurso de A existe;
   - no usar la service-role key para esta prueba (RLS debe bastar);
   - no registrar ni compartir ningún token/contraseña usado durante la prueba.

## Rollback

Documentado por adelantado; no se ejecutó ningún rollback en esta
tarea (no hubo fallo).

- Vercel conserva cada deployment anterior; desde **Deployments**, se
  puede usar **Promote to Production** sobre un deployment `READY`
  anterior para volver a él de forma prácticamente instantánea (reusa
  el build ya compilado).
- **Importante:** un rollback instantáneo reutiliza el build anterior
  tal cual — si el problema fue causado por un cambio de variables de
  entorno, el rollback NO aplica las variables nuevas (siguen siendo
  las del build viejo). En ese caso, corregir la variable y generar un
  **deployment nuevo**, no solo un rollback.
- No se toca Supabase "a ciegas" como parte de un rollback de Vercel —
  son sistemas independientes; un problema de aplicación no implica
  revertir el esquema o los datos de Supabase.

## Límites del plan Hobby (referencia)

- Sin funciones premium, sin protección productiva de pago, sin
  observabilidad de pago — no se activó ninguna.
- Revisar en el dashboard de Vercel (Settings → Usage) los límites
  vigentes de bandwidth, build minutes, duración de funciones y tamaño
  de deployment — cambian con el tiempo, no se documentan cifras fijas
  aquí.
- El costo esperado de $0/mes depende de mantenerse dentro de esos
  límites y de las condiciones de uso no comercial del plan Hobby (ver
  gate de compatibilidad arriba).

## Pasos para un dominio futuro (no iniciado)

1. Comprar/configurar el dominio fuera de Vercel o vía Vercel (fuera
   de alcance de esta tarea — no se compró ningún dominio).
2. Vercel → Project → Settings → Domains → agregar el dominio.
3. Actualizar `Site URL` y `Redirect URLs` en Supabase Auth al nuevo
   dominio (mismo proceso que arriba, con la URL nueva).
4. Nuevo deployment no es necesario solo por el cambio de dominio en
   sí (a menos que el código tenga alguna referencia hardcodeada al
   dominio anterior, lo cual no es el caso aquí).

## Verificaciones pendientes antes del próximo release

- Revalidar Site URL, las cuatro redirect URLs, política de contraseña y
  plantillas de correo en Supabase Auth.
- Confirmar el deployment activo y sus variables Production en Vercel.
- Ejecutar los pasos manuales de la sección anterior con una cuenta
  autorizada real (login, sesión, logout, smoke test).
- Prueba de aislamiento A/B — pendiente hasta que exista una segunda
  cuenta autorizada real.
- Dominio propio — no iniciado, fuera de alcance de esta tarea.
