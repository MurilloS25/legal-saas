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
- **Usuarios creados solo por invitación** (Authentication → Users → Add
  user → Send invitation en el dashboard de Supabase Cloud) — ver
  `docs/SUPABASE_PRODUCTION.md` para el flujo de invitación ya documentado.

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
   `supabase/templates/recovery.html`, cuyo enlace apunta a la propia
   ruta de la app (`/auth/confirm?token_hash=...&type=recovery&next=...`)
   en vez del endpoint hosted de Supabase — mismo patrón ya usado
   (y documentado en comentarios) para signup/invitación.
3. `/auth/confirm` (`src/app/auth/confirm/route.ts`) verifica el token
   con `verifyOtp({ token_hash, type })` y redirige a `next`. El `next`
   puede llegar como ruta relativa o como URL absoluta (Supabase sustituye
   `{{ .RedirectTo }}` con el `redirectTo` absoluto que se le pasó a
   `resetPasswordForEmail`) — en ambos casos solo se usa el *path*, y la
   redirección siempre ocurre sobre el origen de la request actual, nunca
   sobre un host leído de `next`, porque la cookie de sesión que
   `verifyOtp()` acaba de fijar está atada a ese origen.
4. `/update-password` — Server Component que verifica sesión server-side
   antes de mostrar el formulario; sin sesión válida muestra "Enlace no
   válido o expirado" con un enlace para pedir uno nuevo, en vez de un
   redirect silencioso a `/login`. Al guardar la nueva contraseña,
   `updatePasswordAction` llama `signOut({ scope: "others" })` — cualquier
   otra sesión activa con la contraseña anterior queda invalidada.
5. `/update-password` está **deliberadamente excluida** de
   `PRIVATE_ROUTE_PREFIXES` y `AUTH_ROUTES` en `src/proxy.ts` — ver el
   comentario ahí para el razonamiento (un enlace vencido debe mostrar un
   mensaje claro, no un bounce silencioso).

**Cloud pendiente (manual, dashboard):**
- Authentication → Email Templates → "Reset Password": apuntar al mismo
  patrón `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}`
  (contenido equivalente a `supabase/templates/recovery.html`).
- Authentication → URL Configuration → agregar
  `https://lexcr.vercel.app/update-password` a Redirect URLs (además de
  `https://lexcr.vercel.app/auth/confirm`, ya documentado en
  `docs/SUPABASE_PRODUCTION.md`).

### Revocación de usuarios

Revocar un usuario (Authentication → Users → banear/eliminar) bloquea
inicios de sesión y refrescos de token nuevos — pero **no invalida por sí
solo un access token ya emitido**: los JWT de Supabase se validan de
forma stateless, y un token no vencido sigue siendo válido para
`getUser()` incluso después de banear al usuario (verificado
empíricamente contra el stack local). Por eso `src/proxy.ts` chequea
explícitamente `user.banned_until` en cada request (no solo `!user`) y
cierra la sesión (`signOut()`) apenas lo detecta — esto es lo que corta
el acceso de verdad, no el baneo en sí. Cubierto por
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
- **Enrolamiento:** paso opcional en `/dashboard/settings`, no forzado al
  primer login (para no romper la aceptación de invitación existente).
  Flujo: `enroll()` → mostrar QR (`totp.qr_code`) → `challenge()` +
  `verify()` con el código de 6 dígitos → factor queda `verified`.
- **Challenge en login:** tras `signInWithPassword` exitoso, si el
  usuario tiene un factor TOTP verificado, Supabase devuelve una sesión
  en nivel `aal1`; la app debe detectar esto
  (`mfa.getAuthenticatorAssuranceLevel()`) y pedir el código antes de
  considerar el login completo, en vez de redirigir directo a
  `/dashboard`.
- **Enforcement diferenciado por rol:** cuando exista distinción real de
  roles (propietario/notario vs. asistente — hoy no existe, es
  mono-usuario por cuenta), la política propuesta es exigir `aal2`
  (MFA verificado) para acciones sensibles del propietario/notario
  (p. ej. configuración de la cuenta, exportación notarial) vía un check
  de servidor (`getAuthenticatorAssuranceLevel()` en el Server Action/ruta
  correspondiente), mientras que un futuro rol de asistente con permisos
  más acotados podría operar en `aal1` si sus acciones son de menor
  riesgo. Esto requiere que el modelo de roles exista primero — no se
  diseña en detalle hasta esa iteración (ver
  `03_AUDITORIA_Y_DISENO_WORKSPACES_MULTIUSUARIO.md`).
- **No implementado ahora** porque el piloto actual es de un solo usuario
  por cuenta y el spec de esta iteración pide explícitamente entregar el
  diseño, no el código.

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
