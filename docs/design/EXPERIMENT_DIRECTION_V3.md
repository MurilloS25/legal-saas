# Dirección LexCR — iteración 3 (rediseño estructural)

Rama `experiment/lexcr-visual-refresh`, PR #191. Este documento reemplaza
la iteración 2 (que fue solo un refresh visual del sistema de diseño) con
una dirección que también replantea estructura/flujo, según lo pedido
explícitamente por el dueño del producto.

## Por qué existe este documento

La iteración 2 (tokens, Geist, primitives, motion) fue necesaria pero
insuficiente: la app seguía sintiéndose como la misma aplicación con
mejor pulido. Esta iteración exige cambios de **composición, jerarquía,
navegación y flujo**, no solo de superficie.

## Principios de las skills que se aplican aquí

- **emil-design-eng**: motion debe estar motivado — usarlo para dar
  continuidad espacial cuando un panel cambia de contenido sin
  desmontar el lienzo principal (ej. el editor de un Machote no debe
  desaparecer al cambiar de sección). Springs/`layoutId` para
  superficies que persisten; nunca animación decorativa.
- **design-taste-frontend**: *color consistency lock* — un solo acento,
  en la familia azul histórica de LexCR (no índigo/violeta). *Shape
  consistency lock* ya establecido (botones/inputs `rounded-lg`, cards
  `rounded-xl`, diálogos `rounded-2xl`). *Section-layout-repetition
  ban* aplicado al Dashboard: no repetir el mismo patrón de tile en
  cada bloque.
- **redesign-existing-projects**: "modales para todo → usar edición
  inline, paneles deslizantes o secciones expandibles" es la guía
  central de esta iteración — aplica directamente a Machotes y
  Escrituras (de stepper de pantallas completas a workspace
  persistente) y a Clientes/Índice (de navegación completa a
  list+detail). También: alinear acciones al fondo de las cards,
  jerarquía visual antes que "misma tabla con Badge nuevo".

## Referencias conceptuales estudiadas

- **Linear**: sidebar agrupado por secciones (`Workspace` /
  `Favorites`), panel de actividad tipo timeline (avatar + timestamp +
  descripción) — inspira el reagrupamiento del sidebar y el patrón de
  historial/actividad en Escrituras e Índice.
- **Attio / Notion** (patrón general, conocido de antemano — no
  requirió sesión autenticada): *list + detail* con el registro
  abriéndose en un panel lateral o vista dividida en vez de navegar a
  una página nueva; el documento/registro como lienzo persistente con
  paneles de propiedades alrededor, no como una serie de pantallas.
- Aplicado con criterio: LexCR NO es una landing page ni un CRM
  genérico — es una herramienta profesional legal, así que se adapta el
  patrón (list+detail, workspace persistente) sin adoptar animaciones
  o densidad de esos productos que no encajan con "sobrio, profesional,
  legal".

## Corrección inmediata: sistema visual

- **Acento**: se reemplaza el azul-índigo (`accent-500 #4F5FD6`, hue
  ~235°, leía violeta) por un azul inequívoco (`accent-500 #2563EB`,
  hue ~217°) — misma familia navy que `ink-*`, sin ambigüedad con
  morado.
- **Logo**: se elimina el cuadrado "Lx" del sidebar y del panel de
  marca de auth. Sin isotipo nuevo. Wordmark "LexCR" sobrio, en
  colapsado solo la letra "L" sin caja de color.

## Dirección por módulo

### Shell
Se mantiene el sidebar persistente y colapsable (precedente: Linear,
Attio, Notion — herramientas de trabajo con 6+ secciones se benefician
de navegación siempre visible, quitarlo perjudicaría la orientación).
El cambio real: agrupar la navegación en dos bloques con separación
visual clara (espacio de trabajo vs. cuenta — ya existía parcialmente,
se formaliza), y quitar el logo. La marca es texto, no ícono.

### Machotes — de stepper a workspace persistente
**Antes**: 5 pantallas secuenciales (Información → Documento →
Variables → Índice → Publicar), cada una reemplaza a la anterior,
"Guardar y continuar" por paso.

**Ahora**: un workspace de una sola pantalla. El editor del documento
(Tiptap + `DocumentSheet`) es el lienzo central, **siempre montado**.
Un riel de navegación contextual (no un stepper de pantalla completa)
permite saltar entre secciones — Información, Variables, Índice,
Publicar — como paneles que aparecen junto al editor, no que lo
reemplazan. El guardado deja de ser "Guardar y continuar" por paso: se
vuelve un estado persistente visible ("Guardado" / "Guardando…") en la
barra de acciones, siempre presente. "Publicar" sigue siendo una acción
explícita y deliberada (no se oculta ni se automatiza), pero vive en
esa misma barra persistente, no como último paso de una secuencia.

No cambia: qué datos se guardan, cuándo se dispara cada server action,
la semántica de variables/Option Blocks/índice.

### Escrituras — equivalente para el documento notarial
Mismo criterio: el documento es el lienzo persistente. Los datos
(variables), la vista previa, el cobro asociado, el índice y el
historial se acceden como paneles/secciones dentro del mismo workspace,
no como pasos que se abandonan unos a otros. Las acciones de lifecycle
(Finalizar, Reabrir, Descargar Word) viven en una barra de acciones
persistente siempre visible, no gateadas por "llegar al último paso".

No cambia: reglas de lifecycle, `authorized_at`, confirmación del
índice, generación DOCX.

### Índice Notarial
De "tabla + link a Ver escritura" (dos navegaciones) a **list + detail**:
seleccionar un registro abre su detalle en un panel lateral sin
abandonar la tabla/filtros. Refuerza la sensación de "herramienta de
revisión" en vez de "tabla CRUD". No cambia qué campos existen, sus
reglas de completitud, ni la semántica de confirmación.

### Clientes
De lista de página completa + página de detalle completa a
**list + detail** en la misma pantalla (panel lateral o vista
dividida) — reduce saltos de navegación, refuerza que es un módulo de
consulta rápida mientras se trabaja en otras cosas, no un CRUD aislado.

### Cuentas por cobrar
Reordenar por jerarquía real: el resumen por moneda (lo que un
abogado necesita ver primero) gana peso visual arriba; la lista se
agrupa por urgencia (vencidas primero), no solo cronológicamente.
Registrar pago puede vivir en un panel lateral en vez de un modal
centrado, dado que es una acción que se repite seguido sobre el mismo
registro. No cambian cálculos, moneda, ni inmutabilidad financiera.

### Dashboard
Pregunta rectora: ¿qué necesita ver primero un abogado al entrar?
Respuesta: qué requiere su atención hoy (cuentas vencidas/próximas,
registros de índice incompletos, escrituras en borrador) — eso sube a
ser el contenido principal, arriba, no una card secundaria al final.
Los conteos por módulo (Clientes, Machotes, Escrituras) se vuelven una
franja compacta secundaria, no el centro de la pantalla — nadie
necesita ver "12 clientes" todos los días.

## Límites de dominio (sin cambios respecto a la iteración 2)

No tocar: migrations, Supabase Cloud, schema, RLS, permisos, roles,
ownership, reglas financieras, semántica de lifecycle,
finalizar/reabrir, reglas del índice, `authorized_at`, semántica de
confirmación, audit trail, generación DOCX, semántica de Option
Blocks/variables.

## Validación de esta fase

`pnpm lint`, `pnpm typecheck`, `pnpm build`. Sin E2E/unit/integration
tests todavía.
