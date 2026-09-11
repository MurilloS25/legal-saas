# DESIGN.md — Design System de LexCR

Fuente de verdad visual de la aplicación. El shell vigente usa una navbar
superior oscura en desktop y un drawer lateral en móvil. El Panel principal
(`/dashboard`) y ese shell son la referencia aprobada: cualquier pantalla
nueva o migrada debe verse como si perteneciera al mismo producto.

Este documento reemplaza a `docs/design/DESIGN.md` ("Sober Juris") como
especificación autoritativa. Ese archivo se conserva solo como referencia
histórica del moodboard original — está marcado como superado y no debe
usarse para tomar decisiones visuales nuevas. `docs/UI_GUIDELINES.md`
sigue vigente para principios generales de producto (qué evitar, cómo
pensar accesibilidad, límites de alcance del MVP) y enlaza aquí para los
tokens de color reales.

No duplicar valores hexadecimales por feature: todo color decorativo
nuevo debe salir de los tokens de este documento (`src/app/globals.css`)
o de la paleta estándar de Tailwind (`slate`, `red`, `amber`, `emerald`)
para los estados semánticos. Si un valor no existe todavía, se agrega al
`@theme` de `globals.css`, nunca como hex suelto en un componente.

---

## 1. Identidad

```text
LexCR
Gestión Notarial
```

No usar "Legal Workspace" ni ningún otro subtítulo — es un placeholder
de una iteración anterior y debe desaparecer de cualquier pantalla que
todavía lo muestre (incluidas las pantallas de autenticación).

## 2. Personalidad visual

- profesional
- sobria
- moderna
- clara
- legal sin clichés (sin dorados, sin serif pesada, sin "lujo" corporativo)
- humana
- ordenada
- precisa
- descansada para uso prolongado

No debe sentirse: genérica de "dashboard hecho con IA", saturada,
experimental, ni parecida a una landing page de marketing.

## 3. Paleta

Todos los valores están implementados como tokens Tailwind v4 en
`src/app/globals.css` (`@theme` block) — usar las clases de utilidad
(`bg-ink-800`, `text-accent-600`, etc.), nunca el hex literal.

| Uso | Token / clase | Valor |
|---|---|---|
| Fondo de aplicación | `bg-slate-50` (`--background`) | `#F8FAFC` |
| Superficie / card | `bg-white` | `#FFFFFF` |
| Superficie atenuada | `bg-slate-100` | `#F1F5F9` |
| Navbar/drawer (base) | `bg-ink-800` | `#1B2A42` |
| Navegación hover | `bg-ink-700` | `#26374F` |
| Navegación activa | `bg-ink-600` | `#32455E` |
| Navegación secundaria / iconos inactivos | `text-ink-400` | `#90A0BA` |
| Overlay móvil / superficie más oscura | `bg-ink-900` | `#14202F` |
| Texto principal | `text-slate-900` | `#0F172A` |
| Texto secundario | `text-slate-600` / `text-slate-500` | `#475569` / `#64748B` |
| Texto deshabilitado | `text-slate-400` | `#94A3B8` |
| Bordes | `border-slate-200` | `#E2E8F0` |
| Acción primaria (fondo oscuro) | `bg-slate-900` hover `bg-slate-800` | `#0F172A` → `#1E293B` |
| Acento único (acción, enlaces, foco, badges, iconos) | `accent-50` … `accent-900` | ver tabla de abajo |
| Focus ring | `ring-accent-500` (`ring-accent-400` sobre fondo oscuro) | `#3E73C4` / `#5D91DC` |

Escala `accent` completa (variante más clara/intensa del mismo azul que
la navegación oscura — es el único acento decorativo de toda la app):

| Token | Valor | Uso típico |
|---|---|---|
| `accent-50` | `#EEF3FC` | fondo de chip de icono, hover sutil de card |
| `accent-100` | `#DCE8FA` | fondo de badge informativo |
| `accent-200` | `#B7D0F3` | borde de card en hover, borde de CTA |
| `accent-300` | `#8CB3E9` | — (reserva) |
| `accent-400` | `#5D91DC` | icono/barra activa sobre fondo `ink-800` |
| `accent-500` | `#3E73C4` | focus ring sobre fondo claro |
| `accent-600` | `#2F5C9E` | texto de enlace, icono de chip, badge texto |
| `accent-700` | `#244B87` | hover de texto/enlace, texto sobre `accent-50` |
| `accent-800` | `#1C3A69` | hover de botón de acento |
| `accent-900` | `#142A4D` | — (reserva) |

Contraste verificado (WCAG AA): `ink-800` vs blanco ≈14.6:1; `accent-400`
vs `ink-800` ≈4.4:1; `accent-600` vs blanco ≈6.7:1; `accent-700`/`800`
vs blanco superan 6.7:1.

Estados semánticos (paleta estándar de Tailwind, no tokens propios):

| Estado | Fondo suave | Texto/borde |
|---|---|---|
| Éxito / positivo | `bg-emerald-50` | `text-emerald-700` `border-emerald-200` |
| Pendiente / advertencia | `bg-amber-50` | `text-amber-700` `border-amber-200` |
| Error / peligro / vencido | `bg-red-50` | `text-red-700` `border-red-200` |
| Informativo neutro | `bg-slate-100` | `text-slate-600` |
| Deshabilitado | `bg-slate-50` | `text-slate-400`, `opacity-50` en controles |

## 4. Reglas cromáticas

- Los iconos generales de la aplicación (cards, accesos rápidos, chips)
  usan siempre el mismo tratamiento: fondo `accent-50`, icono
  `accent-600`. No un color distinto por módulo o por tarjeta.
- Verde (`emerald`) solo para éxito o estado positivo real (cuenta
  pagada, registro completo). Nunca decorativo.
- Ámbar solo para pendiente/advertencia real (parcial, incompleto).
- Rojo solo para error, peligro o vencido real.
- No usar teal (`teal-*`) en ningún componente nuevo o migrado — el
  acento único de la aplicación es `accent-*`.
- No usar gradientes decorativos ni glassmorphism. La navbar y el drawer
  usan un color sólido (`bg-ink-800`), sin degradado.
- No usar colores distintos por módulo como firma visual — todos los
  módulos comparten exactamente la misma paleta.

## 5. Tipografía

Familia única: Inter (`--font-sans`, ya configurada vía `next/font`).

| Uso | Clases típicas |
|---|---|
| Título de página (h1) | `text-2xl font-semibold text-slate-900` (Panel usa `text-[26px]` para el saludo) |
| Título de sección / card (h2) | `text-sm font-semibold text-slate-900` |
| Subtítulo de página | `text-sm text-slate-500` |
| Label de formulario | `text-sm font-medium text-slate-700` |
| Texto de tabla / metadatos | `text-xs text-slate-500` |
| Texto de tabla (celda principal) | `text-sm text-slate-900` / `text-slate-600` |
| Texto de documento (preview tipo hoja) | `font-serif text-[0.95rem] leading-7 text-slate-900` (ver `DocumentSheet`) |
| Eyebrow / etiqueta superior | `text-xs font-semibold uppercase tracking-wider text-accent-700` |

`line-height` generoso (`leading-relaxed`/`leading-7`) en cualquier texto
de lectura extendida (documentos, descripciones). Tablas y metadatos usan
interlineado más ajustado (`leading-tight` implícito por tamaño de fuente
pequeño).

## 6. Espaciado

Escala de Tailwind estándar (múltiplos de 0.25rem), sin escala propia
adicional. Criterio: equilibrado tirando a compacto — no vacío excesivo,
pero los formularios nunca se comprimen.

- `PageContainer`: `px-4 py-8 sm:px-6 lg:px-10`, `max-w-screen-2xl`
  (`width="wide"`, default) o `max-w-4xl` (`width="form"`, solo
  formularios de creación/edición standalone).
- Separación entre secciones de una página: `space-y-8` / `mb-8`.
- Separación entre campos de un formulario: `space-y-5`.
- Grid de cards / accesos rápidos: `gap-3` a `gap-4`.
- Padding interno de card: `p-5` a `p-6`.
- Padding interno de fila de tabla / lista: `px-5 py-3` a `px-6 py-4`.

## 7. Componentes

### PageContainer

`src/components/layout/PageContainer.tsx`. Único wrapper de ancho para
todas las páginas del dashboard. `width="wide"` (default) para listados,
Panel y vistas de detalle; `width="form"` solo para creación/edición
standalone (`/nuevo`). No crear wrappers de ancho alternativos.

### Shell: navbar superior y drawer móvil

`src/app/(dashboard)/_components/AppShell.tsx`. Ver §3 para colores.

- Desktop: navbar horizontal sticky `bg-ink-800`, marca LexCR, rutas
  principales y subrayado `accent-400` para la ruta activa.
- El menú de usuario agrupa Perfil, Configuración, Despacho y Cerrar sesión.
  La gestión del equipo vive dentro de Despacho según permisos.
- No existe sidebar desktop ni estado persistido de colapso.
- Móvil: botón hamburguesa que abre un drawer `bg-ink-800`; replica las
  rutas, identidad de cuenta y logout, con diálogo accesible y overlay.
- Tanto navbar como drawer participan en el guard compartido de navegación
  cuando Machotes o Escrituras tienen cambios sin guardar.

### Encabezados de página / workspace

Título + badge de estado (si aplica) + acciones a la derecha. Los
workspaces con pasos o pestañas (Machotes, Escrituras, Cuentas por cobrar) usan
el mismo patrón: breadcrumb, título, `role="tablist"` con indicador de
pestaña activa (borde inferior `accent-700` + texto `accent-800`), y las
pestañas permanecen siempre montadas (solo se ocultan con `hidden`) para
no perder estado de edición al cambiar de sección.

### Accesos rápidos

Fila de tiles iguales (mismo alto, mismo padding, mismo tratamiento de
icono). Todo el tile es un único `<Link>` clicable — nunca un texto
suelto dentro de una card no interactiva.

### Cards clicables

Todo el bloque es un `<Link>` (nunca solo un enlace interno). Borde
`border-slate-200`, hover `hover:border-accent-200 hover:shadow-md`,
`focus-visible:ring-2 focus-visible:ring-accent-500`. Si la card
resume un dato (KPI), debe mostrar un número/dato real — nunca una
métrica inventada solo para llenar espacio.

### KPI / resúmenes financieros

Número grande (`text-2xl font-semibold tabular-nums`) + descripción
corta debajo (`text-xs text-slate-500`). Badges de estado excepcional
(p. ej. "N vencidas") usan el color semántico correspondiente, nunca el
acento.

### Tablas

TanStack Table en todos los listados (Clientes, Machotes, Escrituras,
Cuentas por cobrar, Índice Notarial) — no reemplazar por otra librería.
Encabezado con fondo `bg-slate-50` o transparente, texto
`text-xs font-medium text-slate-500 uppercase`; filas separadas por
`divide-y divide-slate-100`; hover de fila `hover:bg-slate-50`;
paginación con el wrapper compartido `TablePagination`.

### Formularios

Labels siempre visibles. Input: `border-slate-300`, focus
`focus:ring-2 focus:ring-accent-500 focus:border-accent-500`. Errores:
texto `text-red-700`, componente compartido `FieldError`. Compactos pero
legibles — nunca comprimidos a costa de la legibilidad.

### Pasos y tabs

Machotes usa Información, Documento, Variables, Índice y Publicar. Escrituras
usa Completar, Cobro e Índice; `Revisar y finalizar` no es un paso. Cuentas por
cobrar conserva tabs de detalle. Cambiar de sección no debe desmontar ni perder
edición local.

### Badges

Pill (`rounded-full`), fondo suave + texto/borde del mismo color
semántico (ver tabla de §3). Nunca solo color: siempre acompañados de
texto (nunca un punto de color aislado).

### Botones

- Primario (acción principal de la página): `bg-slate-900` texto blanco,
  hover `bg-slate-800`.
- Acento (acción positiva importante, p. ej. "Guardar", "Registrar
  pago"): `bg-accent-600` texto blanco, hover `bg-accent-700`/`800`.
- Secundario: fondo blanco, borde `border-slate-300`, texto
  `text-slate-700`.
- Destructivo: `bg-red-600` texto blanco, hover `bg-red-700`, o icono
  solo con `hover:bg-red-50 hover:text-red-600` para acciones
  secundarias destructivas (eliminar).
- Todos: `focus-visible:ring-2 focus-visible:ring-accent-500`, estado
  `disabled:opacity-50 disabled:cursor-not-allowed`, y texto de carga
  explícito ("Guardando…") en vez de solo deshabilitar.

### Enlaces

`text-accent-700 hover:underline` (o `hover:text-accent-800`) para
enlaces de texto sueltos dentro de contenido.

### Diálogos

Dos patrones establecidos, reutilizar siempre uno de los dos:

- Modal centrado (`InsertVariableDialog`, `LegacyVariablesReviewDialog`,
  `RegisterPaymentDialog`): overlay `bg-slate-900/50`, card blanca
  centrada, foco atrapado dentro del diálogo, `Escape` cierra, foco
  vuelve al disparador al cerrar.
- Slide-over lateral (`DocumentHistoryDialog`, `ReceivableHistoryDialog`):
  overlay + panel deslizante desde la derecha, mismo manejo de foco.

No crear un tercer patrón de diálogo sin necesidad real.

### Drawers

Ver "Shell: navbar superior y drawer móvil" y "Diálogos → Slide-over". Mismo mecanismo de
transición (`translate-x`, `duration-200 ease-in-out`).

### Estados vacíos

Icono neutro (`text-slate-300`) o de acento suave + texto
`text-sm text-slate-500` +, cuando aplica, una acción para resolver el
estado vacío (p. ej. "Crear la primera →").

### Loading / feedback

Botones muestran su propio estado de carga (texto cambia, `disabled`). Sin
spinners globales de página completa fuera de lo ya existente.

Feedback temporal de éxito/información ("Cuenta creada.", "Pago
registrado.") usa el sistema de toast (`useToast()` de
`src/components/feedback/Toast.tsx`), no un banner dentro del layout: se
autodescarta, no desplaza contenido, y admite cierre manual. Tonos:
`success` (`bg-emerald-50 border-emerald-200 text-emerald-800`, igual que
"Éxito / positivo" en la tabla de estados semánticos), `info`
(`bg-slate-100 border-slate-300 text-slate-700`, igual que "Informativo
neutro"), `error` (`bg-red-50 border-red-200 text-red-800`). Errores y
advertencias que deban permanecer visibles junto al campo o acción que
falló, o bloqueos persistentes (permisos, pasos incompletos), siguen como
mensajes inline (`role="alert"`) — no se convierten a toast.

### Preview de documentos

`DocumentSheet` (hoja blanca, tipografía serif, sombra suave sobre fondo
`bg-slate-100`) es el patrón único para cualquier vista previa de
contenido legal (Machotes y Escrituras). No reemplazar por cards
genéricas — el documento es el protagonista de esas pantallas.

## 8. Responsive

- Mobile-first en todos los formularios (una columna en móvil).
- Navbar horizontal en escritorio (`lg:`), drawer deslizante en móvil
  (por debajo de `lg:`).
- Tablas: wrappers con `overflow-x-auto` cuando el contenido no cabe;
  evitar densidad excesiva en MVP.
- Pasos/tabs: `overflow-x-auto` en el `role="tablist"` para que no se rompan
  en pantallas angostas.
- Workspaces con documento + panel lateral (Machotes, Escrituras) usan
  un selector de vista Editar/Vista previa en móvil en vez de mostrar
  ambas columnas a la vez.

## 9. Modo oscuro

No se implementa en esta iteración. La infraestructura de tokens
(`ink-*`, `accent-*`, semánticos vía Tailwind) ya está preparada para
soportarlo más adelante sin reescribir componentes, siguiendo estas
reglas cuando se implemente:

- La navegación ya usa un azul oscuro coherente — en modo oscuro el resto
  de la app debe acercarse a esa misma familia, no a negro puro.
- Las superficies oscuras deben ser azul-grisáceas (`ink-900`/`ink-800`
  o una variante), nunca `#000000`.
- Mantener contraste WCAG AA en cada combinación texto/fondo, verificado
  igual que en §3, no solo "invertido".
- El preview de documentos (`DocumentSheet`) conserva la hoja blanca con
  texto oscuro en cualquier tema — un documento legal no debe volverse
  oscuro.
- Los colores semánticos (éxito/advertencia/error) se adaptan a
  variantes que mantengan contraste, no se invierten automáticamente.
- No implementar inversión automática de colores vía filtros CSS: cada
  superficie necesita su propio valor verificado.
