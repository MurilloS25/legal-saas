# Auth security — piloto privado (LexCR)

Este documento explica el endurecimiento de Auth hecho para el piloto
privado sobre Supabase Free, sus límites reales, los controles
compensatorios ya implementados, y el diseño futuro de MFA (no
implementado todavía).

## Contexto: "Leaked Password Protection" deshabilitado

El Security Advisor de Supabase (Cloud) puede marcar **"Leaked Password
Protection disabled"**. Esto **no significa que las contraseñas de LexCR
se hayan filtrado** — significa que el plan Free no incluye el
chequeo automático contra la base de contraseñas comprometidas de
HaveIBeenPwned en cada intento de registro/cambio de contraseña. Esa
verificación es una feature de pago (Pro+); no se sube de plan solo para
resolver este aviso (decisión explícita del propietario del proyecto).

En su lugar, el piloto usa los controles compensatorios descritos abajo,
que cubren el mismo riesgo (contraseñas débiles/reutilizadas) desde otro
ángulo.

## Modelo del piloto

- **Registro público deshabilitado** (`enable_signup = false` en
  `supabase/config.toml`; Cloud: `Allow new user signups` en OFF). `/signup`
  en la app redirige a `/login` sin ofrecer ningún enlace de registro
  (cubierto por `e2e/auth-smoke.spec.ts`).
- **Proveedor único: Email.** Sin OAuth, sin Magic Link, sin Web3.
- **Usuarios creados solo por invitación.** La vía operativa normal es
  Despacho → Equipo en LexCR, donde un propietario/administrador autorizado usa
  el Server Action respaldado por la Admin API. El Dashboard de Supabase queda
  como herramienta administrativa excepcional; no sustituye la membresía del
  Workspace.

## Controles compensatorios implementados

### Política de contraseñas (doble capa)

- **App (Zod, `src/lib/validations/auth.ts`):** mínimo 12 caracteres,
  mayúscula, minúscula, número y símbolo. Aplica en signup (deshabilitado,
  pero el schema queda listo si se reactiva) y en recuperación
  (`UpdatePasswordSchema`).
- **Plataforma (`supabase/config.toml` → `[auth]`):**
  `minimum_password_length = 12`,
  `password_requirements = "lower_upper_letters_digits_symbols"`.
  Verificado empíricamente que esta política se aplica en los endpoints
  self-service (`/auth/v1/signup`, cambio de contraseña vía
  `updateUser`) — **no** se aplica a usuarios creados vía Admin API
  (`/auth/v1/admin/users`), que es el flujo de invitación intencional del
  piloto (el notario/propietario decide la contraseña inicial o la
  persona la establece al aceptar la invitación).
- **Cloud pendiente:** replicar la misma política manualmente en
  Authentication → Policies → Password Requirements (mínimo 12,
  "Lowercase, uppercase letters, digits and symbols").

### Mensajes que no revelan si una cuenta existe

`loginAction` y `forgotPasswordAction` devuelven siempre el mismo mensaje
genérico sin importar si el correo existe, si la contraseña es incorrecta,
o si Supabase devolvió un error interno (incluyendo rate limit) — evita
enumeración de cuentas por observación de la respuesta.

### Recuperación de contraseña

Antes de esta iteración **no existía ningún flujo de recuperación** — un
usuario invitado sin acceso al admin no tenía forma de recuperar su
cuenta. Implementado end-to-end:

1. `/forgot-password` — pide el correo, llama a
   `resetPasswordForEmail(email, { redirectTo: <origin>/update-password })`,
   siempre muestra el mismo mensaje genérico.
2. Supabase envía un correo con la plantilla personalizada
   `supabase/templates/recovery.html`, cuyo enlace apunta a
   `/reset-password?token_hash=...&email=...` — una ruta propia de la app
   en vez del endpoint hosted de Supabase, igual que para invitación (ver
   más abajo).
3. `/reset-password` (`src/app/(auth)/reset-password/`) muestra el formulario
   de contraseña sin consumir el token en el `GET`. Un único Server Action
   valida `token_hash` con `verifyOtp`, actualiza la contraseña y redirige al
   panel. Así el privilegio de recuperación nunca queda disponible para una
   sesión ordinaria y la URL final queda limpia.
4. `/update-password` es exclusivamente el cambio de contraseña de una sesión
   normal. Además de una sesión válida exige la contraseña actual y
   reautentica explícitamente el mismo correo con `signInWithPassword` antes
   del cambio. Una sesión robada por sí sola no basta para cambiar la
   credencial. Ambos flujos intentan revocar las otras
   sesiones y registran solo el código seguro si esa revocación remota falla.
5. `/update-password` y `/reset-password` están **deliberadamente
   excluidas** de `PRIVATE_ROUTE_PREFIXES` y `AUTH_ROUTES` en
   `src/proxy.ts` — ver el comentario ahí para el razonamiento (un enlace
   vencido debe mostrar un mensaje claro, no un bounce silencioso).

Cobertura: `e2e/auth-security-hardening.spec.ts` (test E, flujo feliz
completo) y `e2e/recovery-token-safety.spec.ts` (GET no consume, GETs
repetidos no consumen, un segundo POST con el mismo token falla seguro,
token inválido no permite continuar, URL final limpia).

**Cloud pendiente (manual, dashboard):**
- Authentication → Email Templates → "Reset Password": apuntar al mismo
  patrón `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&email={{ .Email }}`
  (contenido equivalente a `supabase/templates/recovery.html`).
- Authentication → URL Configuration → agregar
  `https://lexcr.vercel.app/update-password` y
  `https://lexcr.vercel.app/reset-password` a Redirect URLs (además de
  `https://lexcr.vercel.app/auth/confirm` y
  `https://lexcr.vercel.app/accept-invite`, ya documentados en
  `docs/SUPABASE_PRODUCTION.md`).

### Invitación a un Workspace: el token no se consume en un GET

Hasta esta iteración, el enlace de invitación (`supabase/templates/invite.html`)
apuntaba a `/auth/confirm?token_hash=...&type=invite&next=/accept-invite` —
una ruta GET que ejecutaba `verifyOtp` (consumiendo el token de un solo uso)
como efecto secundario de simplemente **cargar la URL**. Eso es vulnerable a
que cualquier cosa que haga esa petición antes que la persona real —
prefetch del navegador, un antivirus o un filtro de correo escaneando
enlaces — consuma el token en silencio, dejando el enlace "usado" sin que
nadie lo haya abierto deliberadamente (reproducido y confirmado
empíricamente: un `curl` GET simple al enlace bastaba para dejarlo inválido).

Diseño actual:

1. El correo enlaza directo a `/accept-invite?token_hash=...&email=...`
   (`src/app/(auth)/accept-invite/page.tsx`, "Mode A" en ese archivo). El
   `GET` **no** llama a `verifyOtp`, no toca sesión y tampoco consulta datos
   por correo con service role. Muestra un estado genérico sin Workspace,
   rol, correo ni estado de membresía. Esto evita que un token inventado con
   un correo conocido funcione como oráculo de metadatos.
2. Solo el `POST` del botón "Aceptar invitación"
   (`src/app/(auth)/accept-invite/confirm-actions.ts`) ejecuta
   `verifyOtp({ token_hash, type: "invite" })`, crea la sesión, y llama a
   `accept_workspace_invitation` (RPC sin cambios). Ese POST hereda la
   misma protección CSRF que cualquier Server Action de Next.js
   (verificación de Origin/Host) — no se añadió ningún mecanismo nuevo.
3. Redirige a `/accept-invite/set-password` (URL limpia, sin token) donde
   la persona ya autenticada fija su contraseña
   (`src/app/(auth)/accept-invite/set-password/`).
4. `/auth/confirm` (`src/app/auth/confirm/route.ts`) ahora rechaza
   defensivamente cualquier `type=invite` que le llegue (enlaces viejos en
   correos ya enviados) redirigiendo a `/accept-invite` sin tocar el
   token, en vez de reproducir el mismo problema.

La creación de la invitación también separa Auth de membresía de forma
explícita: valida entrada y permiso antes de tocar Auth, resuelve primero si la
cuenta ya existe, y solo envía correo para una cuenta nueva. Si Auth crea esa
cuenta pero la RPC de membresía falla, el servidor intenta eliminar únicamente
la cuenta creada por ese intento. Nunca elimina usuarios existentes; si la
compensación falla, registra solo un código seguro y el retry reconcilia la
cuenta existente sin reenviar ni duplicar la invitación.

Cobertura: `e2e/invite-token-safety-authenticated.spec.ts` (GET no consume,
GETs repetidos no consumen, un segundo POST con el mismo token falla
seguro, invitación revocada no se puede aceptar, remoción+reinvitación
funciona con Mailpit real).

**Nota:** el mismo patrón (página intermedia + POST) se extendió también a
`/auth/confirm?type=recovery` — ver "Recuperación de contraseña" más
arriba — así que ambos flujos de correo con token de un solo uso quedan
protegidos por igual.

**Cloud pendiente:** actualizar la plantilla "Invite user" en
Authentication → Email Templates para que enlace a
`{{ .SiteURL }}/accept-invite?token_hash={{ .TokenHash }}&email={{ .Email }}`
(contenido equivalente a `supabase/templates/invite.html`) — de lo
contrario producción seguiría usando el patrón GET vulnerable.

### Redirect posterior a confirmación

El parámetro `next` de `/auth/confirm` se acepta únicamente cuando representa
una ruta interna segura. La normalización rechaza URLs absolutas,
protocol-relative, backslashes y esquemas externos codificados antes de
redirigir. Las rutas internas válidas se conservan. La política está aislada en
`src/app/auth/confirm/safe-redirect.ts` y cubierta por tests unitarios; no se
debe reemplazar por una comprobación basada solo en `startsWith("/")`.

### Revocación de usuarios

Revocar un usuario (Authentication → Users → banear/eliminar) bloquea
inicios de sesión y refrescos de token nuevos — pero **no invalida por sí
solo un access token ya emitido**: los JWT de Supabase se validan de
forma stateless, y un token no vencido sigue siendo válido para
`getUser()` incluso después de banear al usuario (verificado
empíricamente contra el stack local). Por eso `src/proxy.ts` chequea
explícitamente `user.banned_until` en cada request (no solo `!user`) y
  cierra la sesión (`signOut()`) apenas lo detecta. El proxy corta además
  cualquier `/api/*` con `401` antes de ejecutar el Route Handler; los helpers
  `requireApiUser` y `requireUser` mantienen la defensa cuando el proveedor
  devuelve el atributo de baneo. Cubierto por
`e2e/auth-security-hardening.spec.ts` (test D).

Eliminar el usuario (en vez de banear) también sigue funcionando como
antes: `owner_id references auth.users(id) on delete cascade` borra en
cascada sus datos (`docs/SUPABASE_PRODUCTION.md`).

### Sesión

- `jwt_expiry = 3600` (1 hora) sin cambios — valor por defecto de
  Supabase, razonable para un piloto de baja escala.
- `enable_refresh_token_rotation = true` (ya existente) — cada refresh
  invalida el token de refresco anterior.
- `proxy.ts` llama `getUser()` (no `getSession()`) en cada request —
  valida el JWT contra el servidor de Auth en vez de confiar solo en la
  cookie local, requisito para que la revocación de arriba funcione.
- Las cookies de sesión emitidas por `@supabase/ssr` usan `HttpOnly`,
  `SameSite=Lax`, `Path=/` y `Secure` en producción. El checkout no crea un
  cliente Supabase en el navegador, por lo que `HttpOnly` es compatible con
  la arquitectura; en desarrollo `Secure` queda desactivado para HTTP local.
- El logout intenta revocación global, registra únicamente el código del
  error y elimina siempre las cookies Auth locales, incluso si falla la
  llamada remota.

### Headers del navegador

`next.config.ts` aplica CSP global con `frame-ancestors 'none'`, fuentes y
conexiones acotadas al propio origen y Supabase, además de
`X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`. El runtime
de desarrollo agrega solo lo necesario para Next local; producción no permite
`unsafe-eval`.

### Rate limits (solo local)

`supabase/config.toml` → `[auth.rate_limit]` se subió por encima de los
valores por defecto de Supabase (`email_sent` 2→30/hora,
`sign_in_sign_ups` 30→100/5min, `token_verifications` 30→100/5min)
**únicamente para desarrollo local** — el default original
(`email_sent = 2`) hacía que la propia suite de E2E se autobloqueara al
enviar más de dos correos de recuperación en una hora. Cloud mantiene sus
valores por defecto; estos números nunca se despliegan (no existe
`config.toml` en Cloud, es exclusivo del CLI local).

## Qué NO se hizo (fuera de alcance explícito)

- No se subió a Supabase Pro.
- No se agregó ninguna validación de contraseña en la UI que Supabase no
  aplique realmente a nivel de plataforma (evita falsa sensación de
  seguridad).
- No se guardan contraseñas ni hashes en ninguna tabla de la aplicación
  (Supabase Auth es la única fuente de verdad).
- No se implementó MFA todavía (ver diseño futuro abajo).

## Diseño futuro — MFA (no implementado)

Pendiente para una iteración futura, cuando el piloto lo requiera. Diseño
propuesto para no bloquear esa implementación:

- **Método:** TOTP (Supabase Auth ya soporta `mfa.enroll({ factorType: "totp" })`
  sin cambios de plan — no requiere Pro).
- **Enrolamiento:** paso opcional en `/settings`, no forzado al
  primer login (para no romper la aceptación de invitación existente).
  Flujo: `enroll()` → mostrar QR (`totp.qr_code`) → `challenge()` +
  `verify()` con el código de 6 dígitos → factor queda `verified`.
- **Challenge en login:** tras `signInWithPassword` exitoso, si el
  usuario tiene un factor TOTP verificado, Supabase devuelve una sesión
  en nivel `aal1`; la app debe detectar esto
  (`mfa.getAuthenticatorAssuranceLevel()`) y pedir el código antes de
  considerar el login completo, en vez de redirigir directo a
  `/dashboard`.
- **Enforcement diferenciado por rol:** los roles de Workspace ya existen,
  pero MFA todavía no. Si se aprueba MFA, la política propuesta es exigir `aal2`
  (MFA verificado) para acciones sensibles del propietario/notario
  (p. ej. configuración de la cuenta, exportación notarial) vía un check
  de servidor (`getAuthenticatorAssuranceLevel()` en el Server Action/ruta
  correspondiente), mientras que un futuro rol de asistente con permisos
  más acotados podría operar en `aal1` si sus acciones son de menor
  riesgo. La implementación debe usar la matriz de permisos vigente y requiere
  una decisión de producto/seguridad separada.
- **No implementado ahora:** esta sección conserva únicamente el diseño futuro
  de MFA; no describe una capacidad actual.

## Pruebas

`e2e/auth-security-hardening.spec.ts` (proyecto Playwright
`chromium-auth-security`, corre serial y no depende de la sesión
compartida — cada test crea/borra su propio usuario desechable vía la
Admin API de Supabase, la única forma de crear/revocar usuarios sin pasar
por RLS):

- Login válido.
- Logout invalida la sesión.
- Sesión persiste tras recargar.
- Usuario revocado pierde el acceso de inmediato.
- Recuperación de contraseña de punta a punta (correo real vía Mailpit
  local, enlace, nueva contraseña, la anterior deja de funcionar).

Login inválido, signup bloqueado, y rutas protegidas sin sesión ya
estaban cubiertos por `e2e/auth-smoke.spec.ts` — no se duplicaron.

`e2e/support/supabase-admin.ts` es la única excepción en `e2e/support/`
que usa la service-role key en vez de RLS + JWT del usuario de prueba —
necesario porque crear/banear usuarios no es posible con la anon key.
Requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (obtenerla con
`pnpm supabase status -o env`).
