# Generación de Machotes con IA ("Crear con IA")

Estado: implementado (v1). Alcance aprobado explícitamente como cambio de
producto: **solo crear Machotes nuevos en borrador** a partir de un único
documento. No hay chat, RAG, embeddings, navegación web, OCR, imágenes,
análisis de varios documentos ni edición de Machotes existentes por IA.

Este documento es la fuente de verdad de la feature. Complementa a
`docs/ARCHITECTURE.md`, `docs/SECURITY.md` y `docs/DATABASE.md`.

## 1. Qué hace

El abogado pega el texto de una escritura existente o sube **un** archivo
`.docx` o PDF con texto seleccionable, opcionalmente describe qué partes
pueden redactarse de varias formas ("Notas para la IA"), acepta el
aviso de procesamiento y pulsa **Generar machote**. LexCR:

1. extrae el texto en memoria y aplica límites deterministas;
2. pide a un proveedor de IA una **propuesta estructurada** (JSON con schema
   estricto): variables, normalizaciones, Bloques de opciones y mapeos del
   Índice Notarial;
3. valida la propuesta y **reconstruye el Machote desde el texto original**
   con el modelo actual de LexCR (documento Tiptap canónico, variables,
   Bloques de opciones, configuración del Índice);
4. crea el Machote como **`draft`** con la RPC existente
   `save_template_workspace` y abre el stepper normal
   (Información → Documento → Variables → Índice → Publicar).

Solo una persona puede publicar, con la acción existente del paso Publicar.
La creación manual queda intacta y sigue siendo el camino por defecto.

## 2. Flujo UX

```text
Machotes ──► [Crear con IA]  (también en /templates/new y en el estado vacío)
               │
               ▼
     Diálogo "Crear machote con IA"
       · Documento: Pegar texto | Subir archivo (.docx / .pdf)
       · Notas para la IA (opcional)  — no es un chat
       · Aviso de procesamiento + [ ] Entiendo y deseo continuar
               │  Generar machote
               ▼
     "Analizando documento…" (mensajes estáticos, sin razonamiento del modelo)
               │
               ▼
     "LexCR detectó N variables, M bloques de opciones y K configuraciones
      iniciales del Índice Notarial."   [Revisar borrador]
               │
               ▼
     /templates/<id>?section=document  — stepper normal + advertencia IA
```

- El botón solo se muestra con `templates.write`; el servidor vuelve a
  verificar el permiso en cada solicitud.
- Sin configuración válida el diálogo informa que la función no está
  disponible; el resto de Machotes funciona igual.
- Indicador de IA en el Machote (`AiGeneratedTemplateNotice`), en dos
  estados (`model/ai-generation/notice.ts`):
  - **Pendiente de revisión** (recién generado): callout neutral y compacto
    (gris, icono pequeño; no es un banner de error) — "Generado con
    asistencia de inteligencia artificial. Puede contener errores u
    omisiones." + "Revise el contenido, las variables y la configuración
    notarial antes de utilizarlo o publicarlo", las claves marcadas para
    revisión y la metadata (fecha · proveedor · modelo).
  - **Revisado**: una sola línea discreta — "Creado originalmente con
    asistencia de inteligencia artificial." (metadata en el `title`).
  - **Señal de revisión humana:** `templates.updated_at >
    ai_template_generations.finished_at`, es decir, el Machote se guardó con
    cambios (o se publicó) después de la generación. Es la señal más simple
    y segura del lifecycle actual: la generación cierra el libro después de
    crear el borrador (un Machote recién generado nunca cuenta como
    revisado); `save_template_workspace` solo actualiza la fila cuando algo
    cambió; abrir el Machote, guardar sin cambios o guardar solo el Índice
    no cuentan. No hay workflow de aprobación ni columna nueva.
  - **No se muestran porcentajes de confianza**: no hay una calibración real
    que los respalde.
  - La trazabilidad no cambia: la fila del libro (proveedor, modelo, versión
    de schema, fecha) y el evento `template_ai_generated` se conservan
    siempre; solo cambia la presentación.
- No hay botón Cancelar durante la generación: cancelar la petición en el
  navegador no detiene el costo ya incurrido en el proveedor, así que no se
  simula. Cerrar con Escape se ignora mientras hay una solicitud en curso.
- Regenerar es explícito: cada generación crea un borrador nuevo e
  independiente; nunca se reemplaza ni modifica un Machote existente.

## 3. Arquitectura

```text
src/app/api/templates/ai-generation/route.ts      Route Handler (POST)
        │  same-origin, auth + Workspace, templates.write, límite de cuerpo
        ▼
features/templates/server/ai-generation/          (server-only)
  request.ts            FormData → GenerationSource (1 documento)
  generation-service.ts runTemplateGeneration(): orquestación con deps
  config.ts             variables de entorno (server-only), disponibilidad
  provider.ts           AiTemplateProvider (interfaz de dominio) + errores
  prompt.ts             prompt neutral de proveedor, datos no confiables
  providers/openai.ts   adapter OpenAI (Responses API vía fetch)
  providers/anthropic.ts adapter Anthropic (Messages API vía SDK oficial)
  providers/fake.ts     proveedor simulado (solo dev/E2E)
  providers/index.ts    único punto de elección del adapter
  adapters.ts           persistencia (sesión del usuario) + cuota (service role)
  logging.ts            log operativo con lista cerrada de campos
  queries.ts            disponibilidad y metadata IA de un Machote
        │
        ▼
features/templates/model/ai-generation/           (puro, client-safe)
  proposal.ts           contrato de dominio: Zod + JSON Schema estricto
  build-draft.ts        reconstrucción determinista del Machote
  limits.ts / errors.ts límites por defecto, códigos y mensajes

lib/documents/extraction/                          (server-only, genérico)
  detect.ts  docx.ts  pdf.ts  normalize.ts  index.ts
```

Dependencias: `app → features/lib`, `features → lib`. La extracción es
genérica (no conoce IA ni Machotes) y vive en `lib`; todo lo específico de
Machotes vive en la feature Templates. El Route Handler solo usa
`@/features/templates/server` y `@/features/templates/domain`.

Se usa un Route Handler y no una Server Action para acotar el tamaño del
cuerpo **solo en esta ruta**: subir el límite global de las Server Actions
(1 MB) afectaría a todas.

### 3.1 Abstracción de proveedor

```ts
interface AiTemplateProvider {
  readonly id: string;     // "openai" | "anthropic"
  readonly model: string;  // de OPENAI_MODEL / ANTHROPIC_MODEL, nunca hardcodeado
  generateTemplate(request: TemplateGenerationRequest): Promise<TemplateGenerationResult>;
}
type TemplateGenerationRequest = { paragraphs: string[]; variantInstructions: string | null };
type TemplateGenerationResult  = { rawOutput: string; usage: { inputTokens; outputTokens } };
```

El dominio no conoce nombres, objetos de respuesta ni IDs de ningún SDK.
Los errores se normalizan a `AiProviderError { kind, retryable, billable,
httpStatus }` sin cuerpo, cabeceras ni request IDs del proveedor.

### 3.2 Adapter OpenAI

- `POST https://api.openai.com/v1/responses` con `fetch` (sin SDK: una sola
  llamada HTTP; evita una dependencia nueva y deja explícito qué se envía).
- `instructions` = reglas de LexCR; `input` = mensaje de usuario con los
  datos no confiables.
- `text.format = { type: "json_schema", name, schema, strict: true }`.
- `store: false`; **sin `tools`**, sin `metadata`, sin identificadores de
  usuario/Workspace.
- Timeout con `AbortController` (`AI_TEMPLATE_TIMEOUT_MS`).
- Mapeo: 429 → rate limit (no se reintenta); 5xx/red → no disponible
  (reintentable); 401/403/404 → configuración; `refusal`/`content_filter` →
  rechazo; `incomplete` por `max_output_tokens` → salida inválida (no se
  reintenta, daría lo mismo).

### 3.3 Adapter Anthropic

- `POST https://api.anthropic.com/v1/messages` con el SDK oficial
  `@anthropic-ai/sdk` (errores tipados). `maxRetries: 0`: el SDK no
  reintenta por su cuenta; el único retry técnico lo decide
  `runTemplateGeneration`. Petición no streaming con timeout explícito
  (`AI_TEMPLATE_TIMEOUT_MS`).
- `system` = reglas de LexCR; `messages[0]` (user) = los mismos datos no
  confiables con delimitadores y nonce (`prompt.ts` compartido).
- Salida estructurada `output_config.format = { type: "json_schema",
  schema }` (GA, sin header beta). **Sin `tools`, `tool_choice`,
  `metadata` ni servidores MCP.** La credencial viaja solo en la cabecera
  `x-api-key`; `authToken: null` evita que el SDK tome otras credenciales
  del entorno.
- La salida estructurada de Anthropic no admite `pattern` ni uniones de
  tipo (`["string","null"]`). Se envía el **mismo** contrato
  `lexcr.template_generation.v3` transformado (`toAnthropicJsonSchema`:
  quita `pattern`, convierte uniones nulas en `anyOf`). La validación
  Zod server-side es idéntica para ambos proveedores y sigue exigiendo los
  patrones de clave.
- Mapeo: `stop_reason: "refusal"` → rechazo; `"max_tokens"` → salida
  inválida (no se reintenta); texto vacío → reintentable; bloques
  `thinking` se ignoran. HTTP 429 → rate limit (no se reintenta); 500 y
  529 `overloaded_error` → no disponible (reintentable, no facturado);
  401/402/403/404 → configuración (clave, saldo, permiso o modelo); 400/413
  → entrada rechazada; red → no disponible; timeout → timeout.
- **400 ≠ documento largo.** Un 400 `invalid_request_error` (p. ej. API key
  de organización sin workspace, parámetro o schema no aceptado) se reporta
  como `provider_rejected` ("El servicio de IA rechazó la solicitud por un
  problema de configuración del proveedor"); solo un 413
  `request_too_large` (o `context_length_exceeded` en OpenAI) se reporta
  como "texto demasiado largo". El log registra `providerHttpStatus` y
  `providerErrorType` (solo el identificador, nunca el mensaje).
- **Esfuerzo de razonamiento:** se envía `output_config.effort = "low"` por
  defecto (`ANTHROPIC_EFFORT` lo cambia; `off` lo omite para modelos sin
  soporte de effort, p. ej. Haiku 4.5). Motivo medido (2026-09-23,
  `claude-sonnet-5`, escritura ficticia de ~2.100 caracteres, mismo prompt
  y schema): con el effort por defecto la respuesta tardó **129,8 s** y
  usó 16.483 tokens de salida, de los cuales **13.053 eran razonamiento
  interno** (el JSON empezó a los 109,9 s); con `low` tardó **22,6 s**,
  3.333 tokens de salida y 0 de razonamiento, y la propuesta pasó la
  validación completa (28 variables, 2 Bloques por patrón conocido, 6
  mapeos de Índice). La tarea es de extracción estructurada: el
  razonamiento extendido añadía ~4× costo y ~6× latencia sin beneficio
  observable. Subir el effort solo si la calidad lo exige y medirlo.
- **API key sin workspace:** si Anthropic responde "This API key is not
  scoped to a workspace…", usar una API key creada dentro de un workspace
  (recomendado) o definir `ANTHROPIC_WORKSPACE_ID` (opcional, no secreto),
  que se envía como cabecera `anthropic-workspace-id`.
- Retención: la Messages API no tiene un flag `store` por solicitud; la
  retención del lado de Anthropic la define la configuración de la
  organización (p. ej. Zero Data Retention). LexCR no afirma más.

### 3.4 Cambiar de proveedor (OpenAI ↔ Anthropic)

Solo configuración; no hay cambios de código:

```env
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...

# Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...     # p. ej. claude-opus-5
```

Reiniciar el servidor (o redeploy en Vercel). Cada generación registra
`provider`/`model` en `ai_template_generations` y en el evento de
auditoría. Prompt, contrato, validación, construcción, persistencia,
cuota, límites, retry, logs y UI son idénticos para ambos. Para agregar un
tercer proveedor: nuevo archivo en `providers/` que implemente
`AiTemplateProvider`, su id en `SUPPORTED_PROVIDERS` + variables en
`config.ts` y el `case` en `providers/index.ts`.

### 3.5 Extracción (`lib/documents/extraction`)

| Fuente | Implementación | Defensas |
|---|---|---|
| Texto pegado | normalización | máx. caracteres; vacío rechazado |
| `.docx` | `jszip` + recorrido de `w:p`/`w:t` | firma ZIP, `[Content_Types].xml` de Word, máx. entradas ZIP, descompresión en streaming con tope de bytes (zip bomb), `<!DOCTYPE` rechazado (sin XXE/SSRF), solo entidades XML estándar, texto borrado en control de cambios descartado, páginas por `docProps/app.xml` si existe |
| `.pdf` | `unpdf` (build serverless de PDF.js) | firma `%PDF-`, páginas validadas antes de extraer, corte por caracteres, sin red (`disableRange/Stream/AutoFetch`), XFA desactivado, sin compilación de fuentes con `eval`, contraseña → rechazo, sin capa de texto → rechazo (sin OCR) |

Tipo real = extensión **y** MIME declarado **y** firma binaria coherentes.
`.doc` (OLE), imágenes y cualquier otra extensión se rechazan. El nombre del
archivo solo se usa para leer la extensión; nada se escribe en disco.

### 3.6 Contrato estructurado y fidelidad

El modelo **no devuelve el texto del documento**. Devuelve referencias:
`{ paragraph, text, occurrence }` (número de párrafo `[Pn]`, literal exacto
y número de aparición dentro del párrafo). `build-draft.ts`:

- copia literalmente todo el texto no referenciado (el modelo no puede
  reescribir, resumir, corregir ni agregar cláusulas);
- descarta referencias que no se encuentran exactas (nunca adivina);
- resuelve solapamientos de forma determinista (más largo primero; un cruce
  parcial con un bloque se descarta);
- crea cada Bloque de opciones con el **texto original como variante
  predeterminada** y las alternativas propuestas como variantes adicionales;
- incluye en el catálogo solo claves realmente usadas;
- pasa el resultado por `validateTemplateDocument`,
  `TemplateWorkspaceVariableSchema` y los límites de `TEMPLATE_DOC_LIMITS`.

Schema (`lexcr.template_generation.v3`, resumido; v2 agregó
`vehicle_identifiers`; v3 retiró `required` (lo decide LexCR), admite
variantes vacías y agregó `identification_types`):

```text
{ schema_version, template:{name, description|null},
  variables:[{ key, label, semantic_type, output_transform,
               needs_review, occurrences:[{paragraph,text,occurrence}] }],
  option_blocks:[{ name, basis, paragraph, text, occurrence,
                   original_variant_label,
                   alternative_variants:[{label, content "{{clave}}" | ""}],
                   time_output: {original:{hour_key,minute_key|null},
                                 alternatives:[…]} | null }],
  vehicle_identifiers: { paragraph, text, occurrence, original_case,
                         chassis_key, vin_key, serial_key } | null,
  identification_types:[{ paragraph, text, occurrence,
                          identification_key, original_type }],
  notarial_index:{ instrument_number_key, authorized_date_key,
                   authorized_time_key, authorized_time_option_block,
                   protocol_book_key, initial_folio_key, party_keys[] },
  warnings:[código cerrado] }
```

No existe `final_folio` en el contrato: el folio final **no se puede
inferir** (depende de cómo termine impresa la escritura) y queda pendiente
para el abogado.

## 4. Comportamiento de la IA

### 4.0 Modelado del Machote (v3)

El objetivo no es "reemplazar datos por variables" sino **modelar un
Machote legal reutilizable**: qué queda fijo, qué cambia entre escrituras,
qué cláusulas pueden aparecer o desaparecer y qué redacciones son
alternativas. El prompt se organiza en: objetivo, preservación,
clasificación del contenido, variables, Bloques de opciones, notas del
abogado, patrones conocidos, datos no confiables/prohibiciones y contrato
de salida. Reglas deterministas de LexCR (no dependen del modelo):

- **`required = false` siempre**: el contrato ya no tiene `required`; toda
  variable generada con IA es opcional. El abogado decide qué exigir.
- **Datos del profesional fijos**: variables cuya clave nombra al notario,
  abogado, licenciado, autorizante o carné se descartan y el texto queda
  literal, salvo que las notas pidan expresamente parametrizarlos
  (`professional_data_kept_fixed`).
- **Nacionalidad de las Partes**: un gentilicio de una lista cerrada que
  quedó literal hasta 250 caracteres después del nombre de una Parte
  (`rol.x`, `person_name`) en el mismo párrafo pasa a `rol.nacionalidad`
  (autollenado `client_nationality`), para cualquier rol
  (`nationality_completed`).
- **Variantes vacías**: una alternativa con `content: ""` es válida y
  significa que la cláusula no existe en esa modalidad ("Sin garantía").
  El editor manual también las admite si al menos una variante tiene
  contenido. Un bloque puede contener variables en sus variantes.
- **Política de Bloques**: A) notas del abogado (`user_instruction`, solo
  si hay notas); B) patrón conocido con evidencia (hora, Chasis/VIN/Serie) o canónico
  (documento de identificación); C) mera posibilidad: no se crea.
- **Bloque de hora coherente o nada**: si la hora no es `time_hour`, los
  minutos no son `time_minutes`, no están dentro del fragmento/variante, o
  una variante incluye la fecha, el bloque se descarta completo
  (`time_block_discarded`) y sus variables quedan en el texto. La fecha se
  mapea al Índice antes que la hora y una variable de tipo fecha nunca es
  la hora del Índice (causa del caso "minutos + fecha de otorgamiento").
- **Cédula / DIMEX / Pasaporte** (patrón canónico): toda identificación
  de una Parte persona física, de cualquier rol, queda preparada para las
  tres modalidades en un Bloque "Tipo de identificación" que reutiliza la
  MISMA variable. Fuentes: `identification_types` del modelo y una
  detección determinista de LexCR (variable de identificación de un rol
  precedida por "cédula de identidad (número)", "cédula", "DIMEX" o
  "pasaporte"), deduplicadas. LexCR solo cambia el nombre del documento
  ("cédula de identidad", "DIMEX", "pasaporte"); nunca agrega requisitos,
  residencia ni vigencias. No aplica a personas jurídicas (mención de
  "cédula jurídica", rol de entidad como `sociedad`/`empresa`, o número con
  formato 3-XXX-XXXXXX). Las notas lo desactivan solo con una exclusión
  explícita ("solo cédula", "sin DIMEX ni pasaporte", "no agregues opciones
  de tipo de identificación").

Limitación conocida: un Bloque de opciones vive dentro de UN párrafo; una
cláusula opcional de varios párrafos no puede ser un solo bloque (el
modelo puede proponer un bloque por párrafo, sin sincronización entre
ellos).

- **Variables**: los datos que cambian entre escrituras (partes,
  identificaciones, estado civil, profesión, domicilios, nacionalidad de
  las partes, fechas, horas, montos, folios, número de escritura,
  vehículos, fincas…); los datos del profesional autor quedan fijos. Convención
  actual de claves (`FIELD_KEY_PATTERN`): minúsculas, dígitos, `_` y `.` para
  rol (`comprador.nombre`) o claves simples (`fecha_otorgamiento`).
- **Deduplicación semántica**: el mismo dato en varias formas ("JUAN PÉREZ",
  "el comprador JUAN PÉREZ") reutiliza la misma clave; el mismo texto con
  roles distintos usa claves distintas, distinguidas por `occurrence`.
- **Normalizaciones**: solo las transformaciones existentes
  (`none`, `digits_to_words`, `number_to_words`); el render sigue siendo el
  motor determinista actual (`applyVariableTransform`). Reglas
  deterministas de LexCR sobre la propuesta del modelo (`resolveTransform`):
  1. **Número completo:** horas, minutos, días, años, cantidades, montos,
     folios y número de escritura nunca usan `digits_to_words`; si el modelo
     lo propone se corrige a `number_to_words` (30 minutos → TREINTA, nunca
     TRES CERO).
  2. **Identificadores técnicos:** si el tipo semántico es identificación,
     identificador de vehículo, placa o identificador de finca, o la clave
     nombra un identificador (`motor`, `chasis`, `vin`, `serie`, `placa`,
     `matricula`, `cedula`, `identificacion`, `pasaporte`, `dimex` como
     palabra del último segmento, p. ej. `vehiculo.modelo_motor`) y el modelo
     no asignó transformación, LexCR asigna `digits_to_words` (carácter por
     carácter: "1AJK203" → "UNO A J K DOS CERO TRES"). Tener letras no deja a
     un identificador sin transformar.
  3. Todo lo demás (nombres, marca, color, direcciones) queda como lo
     propuso el modelo.
  Limitación real del motor actual: `digits_to_words` separa también las
  letras con espacios ("AJK" → "A J K") y elimina guiones; no existe una
  transformación que conserve bloques de letras juntos ("AJK"). Si la
  práctica notarial exige ese formato, la variable debe dejarse en `none`
  (el abogado lo ajusta en el panel de Variables) o agregarse una
  transformación nueva en un cambio aparte.
- **Fechas y horas**: el modelo solo clasifica (`date`, `time_hour`,
  `time_minutes`); no hay tipo de campo nuevo. La fecha completa usa
  `number_to_words` (el motor actual convierte "25 de julio de 2026"); hora
  y minutos son variables separadas; la hora puede mapearse al Índice como
  campo o como Bloque de hora con salida estructurada (`structuredOutput`
  existente).
- **Autollenado desde Clientes**: no lo decide el modelo; se usa la
  inferencia determinista existente (`suggestAutofillSource`).
- **Bloques de opciones**: solo con una base admitida:
  1. `known_pattern_time_minutes` (el fragmento debe mencionar horas —
     verificado);
  2. `document_evidence` (alternativas presentes en el documento);
  3. `user_instruction` (solo si el abogado escribió "Variantes del
     documento" — verificado).
  Sin base, o con alternativas que usan claves no declaradas, el bloque se
  descarta. Ante duda, no se crea: el abogado puede agregarlo después.
- **Patrón conocido Chasis / VIN / Serie** (se evalúa siempre, sin
  indicación del abogado): el modelo devuelve `vehicle_identifiers` con el
  fragmento literal, el caso que muestra el documento y las tres claves.
  **LexCR construye el bloque de forma determinista** con el modelo actual
  de Option Blocks (un nodo `optionBlock`, sin mecanismo nuevo):
  - variante predeterminada = el texto original del documento con sus
    variables, etiquetada con su caso "(según el documento)";
  - las otras cuatro combinaciones con redacción estándar de LexCR:

    | Caso | Redacción |
    |---|---|
    | Chasis, VIN y serie iguales | `chasis, VIN y serie número {{vin}}` |
    | Chasis y VIN iguales; serie diferente | `chasis y VIN número {{vin}}, y serie número {{serie}}` |
    | VIN y serie iguales; chasis diferente | `chasis número {{chasis}}, y VIN y serie número {{vin}}` |
    | Chasis y serie iguales; VIN diferente | `chasis y serie número {{chasis}}, y VIN número {{vin}}` |
    | Chasis, VIN y serie diferentes | `chasis número {{chasis}}, VIN número {{vin}} y serie número {{serie}}` |

  - las mismas tres variables (por defecto `vehiculo.chasis`,
    `vehiculo.vin`, `vehiculo.serie`, con `digits_to_words`) se reutilizan
    en todas las variantes; un valor compartido se escribe una sola vez. Si
    el modelo repite una clave para dos roles, LexCR usa las canónicas; si
    falta alguna declaración, LexCR la crea.
  - Solo se crea si el fragmento existe literalmente y menciona chasis o
    VIN. Si el documento menciona chasis/VIN pero no se pudo crear el
    bloque, la generación agrega la advertencia
    `vehicle_identifier_block_missing`.
  - Causa del fallo anterior (v1): el modelo redactaba las alternativas y
    fusionó chasis+VIN en una clave (`vehiculo.chasis_vin`) mientras la
    alternativa usaba `vehiculo.vin`, no declarada; la validación descartó
    la alternativa y con ella el bloque. v2 retira esa responsabilidad del
    modelo.
- **Índice Notarial**: solo mapeos de alta confianza a los destinos
  existentes (número de instrumento, fecha, hora, tomo, folio inicial,
  partes). Se guardan con la RPC existente
  `save_template_index_mapping_with_block_source`; sin partes el Índice
  queda "Pendiente de definir". La naturaleza del acto sigue usando el
  nombre del Machote (fallback existente), por lo que el modelo propone un
  nombre breve del acto.
- **Human-in-the-loop**: todo resultado es `draft`, se revisa en el stepper
  normal y solo una persona publica.

## 4.1 Comparar modelos o proveedores (guía manual)

Cambiar de modelo es solo configuración (`ANTHROPIC_MODEL=claude-opus-5`
↔ `ANTHROPIC_MODEL=claude-sonnet-5`, o `AI_PROVIDER` + `OPENAI_*`); no
requiere cambios de código. Para comparar calidad y costo sobre los mismos
documentos:

1. Elegir 3–5 escrituras de prueba **ficticias o anonimizadas**
   representativas (vehículo con chasis/VIN/serie, inmueble, poder, etc.) y
   usarlas siempre iguales.
2. Para cada modelo: configurar `ANTHROPIC_MODEL`, reiniciar el servidor y
   generar un Machote por documento (considerar la cuota diaria; en local
   puede ampliarse con `workspace_ai_settings`).
3. Registrar por generación, desde el resumen del diálogo y la línea de log
   `ai_template_generation`: variables detectadas, bloques de opciones,
   configuraciones de Índice, advertencias (fila del libro,
   `review_summary`), `inputTokens`, `outputTokens`, `providerDurationMs`
   y `attempts`.
4. Revisar manualmente cada borrador: variables faltantes o sobrantes,
   claves correctas por rol, normalizaciones, bloque Chasis/VIN/Serie y
   mapeos del Índice.
5. Costo estimado = `inputTokens` × precio de entrada + `outputTokens` ×
   precio de salida (precios por millón de tokens publicados por el
   proveedor; referencia a 2026-09: Claude Opus 5 $5 / $25, Claude Sonnet 5
   $2 / $10 — verificar la tabla vigente antes de decidir). LexCR no guarda
   precios en configuración.

Referencia medida (`claude-sonnet-5`, effort `low`, escritura ficticia de
~2.100 caracteres): 22,6 s, 5.834 tokens de entrada y 3.333 de salida,
≈ $0,045.

## 5. Modelo de seguridad

Esta sección explica, capa por capa, cómo se protege la función. El
principio que las une: **no se confía en que el modelo se comporte bien.**
Se asume que un documento puede contener instrucciones maliciosas y que el
modelo podría obedecerlas; por eso el diseño busca que, aun en ese caso,
el modelo **no tenga ninguna capacidad** para producir un efecto peligroso.

```text
Navegador ──(NO CONFIABLE: archivo, texto, "Variantes")──► Route Handler
Route Handler ──(Origin, sesión, templates.write, límites)──► extracción en memoria
Servicio ──(solo párrafos + indicaciones, sin secretos)──► Proveedor IA (NO CONFIABLE)
Proveedor ──(JSON NO CONFIABLE)──► JSON.parse + Zod estricto + reconstrucción + validadores
Servicio ──(borrador validado, status draft)──► RPC existente con la sesión del usuario (RLS)
Servicio ──(metadata sin contenido)──► RPCs del libro de cuota (solo service_role)
```

### A. Frontera de confianza

Son **input no confiable**: el archivo subido, el texto pegado y el campo
"Notas para la IA". Aunque contengan frases como "ignora todas las
instrucciones anteriores", siguen siendo **datos**: el documento que se
convierte en Machote. Nunca sustituyen las instrucciones de LexCR. También
es no confiable **la respuesta del modelo**: se trata exactamente igual que
un formulario enviado por un atacante.

### B. Separación entre instrucciones y datos

El request al proveedor (`server/ai-generation/prompt.ts`, común a todos
los proveedores) separa cuatro cosas:

1. **Instrucciones de LexCR** — en el canal de sistema (`system` en
   Anthropic, `instructions` en OpenAI). Definen la única tarea, las reglas
   de fidelidad, las bases admitidas para Bloques de opciones y el Índice.
   Nunca incluyen texto del usuario.
2. **Contrato de generación** — el JSON Schema, enviado como formato de
   salida estructurada (parámetro separado, no texto del prompt).
3. **Documento** — en el mensaje de usuario, con cada párrafo numerado
   (`[P1]`, `[P2]`…) y encerrado entre delimitadores
   `<<<DOCUMENTO_{nonce}>>> … <<<FIN_DOCUMENTO_{nonce}>>>`.
4. **Indicaciones del abogado** — también en el mensaje de usuario, entre
   `<<<INDICACIONES_DEL_ABOGADO_{nonce}>>> …`.

El `nonce` es aleatorio por solicitud (16 hex): un documento no puede
"cerrar" su bloque adivinando el delimitador e inyectar texto que parezca
instrucción. Las instrucciones de sistema dicen explícitamente que nada
dentro de esos bloques cambia el objetivo, el schema, las reglas ni el
alcance, y que las órdenes encontradas se tratan como texto (advertencia
`document_contains_instructions`).

**Esta capa sola no elimina la inyección**: un modelo puede ignorar
instrucciones. Reduce la probabilidad; las capas siguientes limitan el
impacto.

### C. Sin herramientas

El modelo recibe **0 tools, 0 function calls, 0 servidores MCP, 0
navegador, 0 web, 0 shell, 0 filesystem, 0 SQL, 0 acceso a Supabase**. Los
adapters no envían `tools`, `tool_choice`, `mcp_servers` ni `metadata`
(verificado por tests de ambos adapters). La interfaz `AiTemplateProvider`
tampoco tiene callbacks: recibe texto y devuelve texto.

Por qué importa: la mayoría de los daños de una inyección (leer datos,
llamar APIs, borrar, enviar, navegar) requieren **capacidades**. Un modelo
sin herramientas que "obedece" una inyección solo puede **escribir texto**,
y ese texto no se ejecuta: se valida como datos (F–I).

### D. Sin secretos

El modelo **no recibe** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, la service
role de Supabase, otros secretos, variables de entorno, tokens de sesión ni
credenciales. La API key solo existe en el servidor y se usa para
autenticar la llamada HTTP (cabecera `x-api-key` / `Authorization`); nunca
forma parte del contenido. Por eso, si el documento dice "devuélveme la API
key", el modelo **no dispone de ella**. Tests verifican que el cuerpo
enviado no contiene la clave y que ni el prompt ni los nombres de secretos
llegan al bundle del navegador.

### E. Abstracción de proveedor

La lógica de Machotes depende de `AiTemplateProvider` (dominio), no de
Anthropic ni de OpenAI. Cada adapter traduce su API a ese contrato y
normaliza errores sin exponer detalles del proveedor. Esto permite cambiar
de proveedor o de modelo por configuración (`AI_PROVIDER`,
`ANTHROPIC_MODEL`, `OPENAI_MODEL`), aplicar políticas por proveedor (p. ej.
`effort` en Anthropic, `store:false` en OpenAI) y **reemplazar un proveedor
problemático o comprometido** sin reescribir la lógica de Machotes, la
validación ni la persistencia.

### F. Salida estructurada (JSON Schema `lexcr.template_generation.v3`)

El modelo no puede devolver "acciones": solo una estructura limitada con
variables (clave, etiqueta, tipo semántico, transformación, apariciones),
referencias a fragmentos del texto, Bloques de opciones con bases cerradas,
el patrón Chasis/VIN/Serie, mapeos del Índice y códigos de advertencia de
una lista cerrada. Todo objeto es cerrado (`additionalProperties: false`)
y no existe ningún campo de texto libre para "respuestas", ni un campo de
folio final. Anthropic no admite `pattern` ni uniones de tipo; recibe una
copia compatible del mismo contrato. **Esa limitación del proveedor no
reduce la validación de LexCR**: el contrato completo se aplica igual en el
servidor.

### G. Segunda validación con Zod

El JSON Schema del proveedor **no es la defensa**; es una ayuda para que el
modelo acierte la forma. Aunque la respuesta parezca cumplirlo, LexCR:

1. limita el tamaño del JSON crudo antes de parsearlo;
2. parsea con un reviver que **rechaza `__proto__`, `constructor` y
   `prototype`** (contaminación de prototipos);
3. valida la forma de primer nivel y el Índice con Zod `.strict()`
   (**ningún campo extra**: un `system_prompt`, una "tool call" o texto
   conversacional rechazan la salida completa; un folio final dentro del
   Índice también);
4. valida **cada ítem por separado** (variables, bloques, patrones,
   advertencias): tipos, enums, patrones de clave, longitudes. Un ítem
   inválido se **descarta con un código de incidencia** en lugar de
   invalidar toda la generación; los campos desconocidos de un ítem se
   ignoran y nunca se guardan.

Después corre la **validación semántica** (`semantic-validation.ts`):
coherencia estructural de LexCR, no corrección jurídica — referencias que
no existen, variantes con claves no declaradas, Bloque de hora incoherente
(la "hora" debe ser `time_hour`, los minutos `time_minutes`, ambos dentro
del fragmento y de cada variante, sin la fecha), hora del Índice apuntando
a la fecha, índice de bloque de hora inválido. Cada incidencia es `repair`
(amerita el único retry de reparación) o `discard` (la reconstrucción la
descarta y el resto sigue coherente). Ver §9.

### H. Validadores del dominio

Después de Zod se ejecutan los validadores reales de LexCR: el documento
canónico del editor (`validateTemplateDocument`), las variables del
workspace (`TemplateWorkspaceVariableSchema`), los Bloques de opciones
(variantes, ids, salida estructurada de hora con claves presentes), las
referencias (cada fragmento debe existir literalmente), los mapeos del
Índice (solo claves del catálogo final, un destino por campo) y las
normalizaciones. Una salida "válida para el LLM" puede ser inválida para
LexCR; en ese caso **no se persiste**. Finalmente, la RPC existente
`save_template_workspace` vuelve a validar en la base de datos.

### I. Reconstrucción determinista

Es una de las protecciones más importantes. El modelo **no devuelve una
versión nueva del documento**; devuelve referencias: número de párrafo,
fragmento literal exacto, número de aparición y la clave a usar. LexCR toma
el **texto original** extraído y:

1. localiza cada fragmento en su párrafo (si no está literalmente, se
   descarta: nunca se adivina una posición);
2. resuelve solapamientos de forma determinista (el más largo primero; un
   cruce parcial con un bloque se descarta);
3. copia literalmente todo el texto no referenciado y sustituye solo los
   fragmentos referenciados por nodos de variable o de bloque.

Consecuencias: el modelo no puede reescribir el lenguaje jurídico, resumir,
inventar cláusulas ni borrar párrafos; en el peor caso **deja de marcar**
una variable (que el abogado agrega después). Un documento con una frase
de inyección conserva esa frase como texto literal — verificado por tests
y por la prueba real.

### J. Option Blocks deterministas (Chasis / VIN / Serie)

En la prueba real, cuando el modelo redactaba las variantes, fusionó
chasis y VIN en una clave y usó en la alternativa una clave no declarada:
la validación descartó el bloque (comportamiento correcto, resultado
inútil). Desde la v2, para este patrón conocido el modelo **solo
identifica** el fragmento, el caso que muestra el documento y las tres
claves. **LexCR construye** las cinco variantes con redacción estándar
(la del documento como predeterminada), reutilizando las mismas tres
variables. El modelo ya no inventa texto jurídico en ese bloque. Para los
demás bloques solo se aceptan bases verificables (patrón de hora con
evidencia, evidencia del documento, indicación explícita del abogado) y
alternativas que usan únicamente claves declaradas.

### K. Normalizaciones deterministas

El modelo solo **clasifica** el dato (tipo semántico) y propone una de las
transformaciones existentes. La conversión final —número completo en
palabras, carácter por carácter, fechas, horas— la hace el código existente
de LexCR (`applyVariableTransform`) al renderizar cada Escritura. Además,
LexCR corrige propuestas incoherentes: los números completos nunca van
dígito por dígito, y los identificadores técnicos sin transformación
reciben la de carácter por carácter. **El modelo nunca escribe la versión
final de los números.**

### L. Autorización

- **UI**: el botón "Crear con IA" solo se muestra con `templates.write`.
  Es comodidad, no seguridad.
- **Servidor**: el Route Handler resuelve la sesión y el Workspace
  (`requireApiWorkspace`) y exige `templates.write` en cada solicitud,
  aunque el botón no exista.
- **Base de datos**: `save_template_workspace` (SECURITY DEFINER existente)
  exige membresía activa con rol de escritura; RLS mantiene el aislamiento;
  `begin_ai_template_generation` vuelve a exigir la membresía.

Nunca se confía en controles del lado del cliente.

### M. Aislamiento por Workspace

La generación pertenece únicamente al Workspace activo del actor: la RPC
deriva el Workspace de la membresía activa y el libro se escribe con ese
Workspace. **No existe ninguna operación del modelo para elegir otro
Workspace**, y el modelo no recibe datos de otros clientes, Machotes,
Escrituras ni Workspaces: solo el documento de la solicitud. La lectura del
libro está protegida por RLS de membresía (verificado con pgTAP y E2E).

### N. Borrador obligatorio

La IA **nunca publica**. El estado `draft` está fijado en el código del
adapter de persistencia (no es un parámetro del modelo) y la RPC de cierre
rechaza un Machote que no sea borrador del mismo Workspace. No existe una
API ni una herramienta que el modelo pueda invocar para publicar.

### O. Humano en el ciclo

Aviso previo con aceptación obligatoria → resumen de lo detectado →
revisión en el stepper normal (Documento, Variables, Índice) con un aviso
visible de "revisar" y las claves marcadas por el modelo → guardado humano
(el aviso pasa a una marca histórica discreta) → publicación humana en el
paso Publicar → trazabilidad permanente (libro + auditoría). La IA es
**asistencia**; la decisión final y la responsabilidad profesional son del
abogado.

### P. Seguridad de la carga de archivos

Un solo archivo por generación; solo `.docx` y PDF con capa de texto
(`.doc`, imágenes, OCR y múltiples archivos no se admiten); tipo real por
extensión **y** MIME **y** firma binaria (magic bytes); límite de bytes
(verificado con `content-length` antes de leer y con el tamaño del
archivo), de páginas y de caracteres, más un tope de tokens estimados; DOCX
con límite de entradas ZIP y descompresión en streaming con tope de bytes
(zip bombs), rechazo de `<!DOCTYPE` y solo entidades XML estándar (sin
XXE/SSRF); PDF.js sin acceso a red (sin range/stream/autofetch), sin XFA,
con páginas validadas antes de extraer; timeout de extracción.

### Q. No persistencia del documento

El documento original y su texto extraído **no se guardan** en la base de
datos, en Storage, en el filesystem, en la actividad ni en los logs: se
procesan en memoria durante la solicitud. Queda: el **Machote generado**
(como cualquier Machote manual), y metadata técnica (proveedor, modelo,
versión de schema, tiempos, tokens, tamaños, códigos de error, claves
marcadas para revisión) más el evento de auditoría.

### R. Logging sanitizado

El log operativo (`ai_template_generation`) acepta solo una lista cerrada
de campos: ids de usuario/Workspace, proveedor, modelo, tiempos, tokens,
estado y categoría de error, tamaños y el guard que rechazó. No acepta
documento, texto, indicaciones, prompt, respuesta, PII ni secretos. Los
errores del proveedor se reducen a una categoría, un estado HTTP y un
identificador de tipo; nunca su mensaje.

### S. Límite de uso y costos (denial-of-wallet)

2 generaciones por usuario y día (configurable, override por Workspace sin
cambios de código), 1 generación activa por usuario, 1 retry técnico
máximo que **no** consume otra unidad, y timeouts que no se reintentan. La
cuota se decide en la base de datos con un lock por usuario y un índice
único parcial (resiste varias pestañas o solicitudes concurrentes). Las
RPCs de cuota solo las ejecuta `service_role`: el usuario no puede
consultar ni modificar su contador desde el Data API. Esto evita el abuso
deliberado y los costos accidentales (reintentos, dobles clics).

### T. CSRF / Origin

El endpoint `POST /api/templates/ai-generation` exige que la cabecera
`Origin` coincida con el host (además de las cookies de sesión
`SameSite`): un sitio de terceros no puede disparar generaciones con la
sesión del usuario.

### U. Sanitización de la salida / XSS

Lo que devuelve el modelo nunca se renderiza como HTML: se convierte al
modelo estructurado permitido del editor (párrafos, texto, variables,
bloques; sin enlaces, scripts ni atributos), pasa por los validadores y
React lo muestra como texto escapado. No se usa `dangerouslySetInnerHTML`.
Las advertencias mostradas son códigos cerrados, no texto del modelo.

### V. Filtración del system prompt

El prompt de sistema vive solo en el servidor (no aparece en el bundle del
navegador — verificado tras el build), no contiene secretos, y el schema no
tiene ningún campo donde devolverlo: una respuesta que lo incluya se
rechaza como salida fuera de contrato. Aunque el usuario lo pida, **no
existe una operación autorizada** que devuelva el prompt al cliente. Si se
filtrara, no expondría credenciales: describe las reglas de la tarea.

### W. Limitaciones y postura honesta

**No afirmamos que la inyección de prompts esté resuelta al 100 %.** Un
modelo puede seguir una instrucción maliciosa del documento (por ejemplo,
marcar mal variables, omitir datos o proponer un bloque inadecuado). La
defensa es en profundidad y el punto central es de **capacidades**: aun si
el modelo obedece, no tiene herramientas, secretos, base de datos,
filesystem ni navegador; no puede publicar; no escribe directamente en
ningún sistema; y su respuesta debe pasar parseo seguro, Zod, la
reconstrucción desde el texto original y los validadores de dominio antes
de convertirse en un **borrador** que una persona revisa. El impacto
residual es de calidad (un borrador incorrecto), no de seguridad.

### Resumen de amenazas y mitigaciones

| Amenaza | Mitigación (capa) |
|---|---|
| Inyección desde el documento | B, C, D, G, I, W |
| Inyección desde "Variantes" | A, B; solo afecta bloques `user_instruction` |
| Extraer el system prompt | F, G, V |
| Exfiltración de secretos | D, R; clave solo server-side |
| Uso como IA de propósito general | F, G (sin chat ni campos libres) |
| Acceso cross-workspace | L, M |
| Archivos maliciosos, enormes o bombas | P |
| Denial-of-wallet / cuota concurrente | S |
| Output injection / XSS | U, I |
| Salida estructurada inválida | G, H (nada se escribe) |
| SSRF | P (sin URLs, sin red en parsers) |
| Logs con datos sensibles | R |
| CSRF | T |
| Publicación sin revisión | N, O |

## 6. Privacidad

- **Qué se envía al proveedor**: los párrafos del texto extraído y, si
  existen, las indicaciones de variantes. Nada más (ni nombre de archivo, ni
  usuario, ni Workspace, ni otros datos de LexCR).
- **Qué NO se persiste**: el archivo, el texto extraído, el prompt y la
  respuesta completa del modelo. No van a Supabase Storage, base de datos,
  disco, logs, analytics ni auditoría. El archivo se lee a memoria
  (`arrayBuffer`) y se descarta al terminar la solicitud; no hay temporales
  en disco.
- **Qué sí se persiste**: el Machote borrador resultante (igual que uno
  manual — el texto de la escritura original queda como contenido del
  Machote, que es precisamente el objetivo) y metadata operativa en
  `ai_template_generations`.
- **Proveedor externo**: LexCR solo garantiza lo que controla. Se usa
  `store: false`; la retención del proveedor para seguridad/abuso se rige
  por sus propias políticas. El aviso de la UI distingue "LexCR no conserva
  el archivo" de "el contenido se envía al proveedor configurado".

### 6.1 Política de logging

Campos permitidos (`logging.ts`): outcome, código de error, user/workspace
id, proveedor, modelo, tipo de fuente, caracteres de entrada, duración,
intentos, tokens de entrada/salida, categoría, estado HTTP y tipo del error
del proveedor, y diagnóstico numérico: `documentChars`,
`instructionsChars`, `estimatedInputTokens`, `maxDocumentChars`,
`maxInputTokens`, `fileBytes`, `pages` y `rejectedBy` (guard que rechazó:
`extraction:<código>`, `input_token_estimate`, `quota:<código>`,
`provider:<tipo>`, `proposal:<código>`), `providerDurationMs` (tiempo
esperando al proveedor) y, en timeouts, `providerErrorType` `client_timeout`
(timeout propio de LexCR, `AI_TEMPLATE_TIMEOUT_MS`) o `http_408` (del
proveedor), `repairAttempted` (hubo retry de reparación) e `issueCodes`
(códigos de incidencias de parseo/semántica, sin rutas ni contenido).
Nunca: documento, texto extraído, indicaciones, prompt,
respuesta, PII del documento, secretos ni API keys. El costo no se calcula
en v1 (depende de tarifas por modelo); los tokens registrados permiten
calcularlo después.

## 7. Persistencia

Migración `20260923120000_ai_template_generation.sql`:

- `ai_template_generations`: una fila por generación solicitada por el
  usuario (el retry técnico NO crea otra fila; se registra en `attempts`).
  Guarda Workspace, actor, template resultante, estado, tipo de fuente,
  proveedor, modelo, versión de schema, caracteres, tokens, intentos,
  código de error, si cuenta para cuota, `review_summary` (solo claves de
  variables y códigos cerrados), tiempos. RLS: lectura para miembros del
  Workspace; sin escritura para `anon`/`authenticated`.
- `workspace_ai_settings`: override opcional de la cuota diaria por usuario
  de un Workspace. Sin acceso para `anon`/`authenticated`.
- `begin_ai_template_generation` / `finish_ai_template_generation`:
  `SECURITY INVOKER`, `search_path` fijo, ejecutables solo por
  `service_role`. `finish` escribe el evento de auditoría
  `template_ai_generated` en `workspace_activity` (actor con snapshot de
  nombre/rol, template, proveedor, modelo, versión de schema, éxito). Los
  fallos quedan en el libro, no en la auditoría.

Pruebas pgTAP: `supabase/tests/ai_template_generation.test.sql` (24).

Trazabilidad: el Machote muestra que fue generado con IA leyendo
`ai_template_generations` por `template_id` (RLS por Workspace).

## 8. Límites

| Límite | Valor por defecto | Configurable |
|---|---|---|
| Tamaño de archivo | 10 MB | `AI_TEMPLATE_MAX_FILE_BYTES` (solo menor) |
| Páginas | 5 | `AI_TEMPLATE_MAX_PAGES` (solo menor) |
| Texto pegado | 12.000 caracteres (~3 páginas) | constante |
| Texto extraído | 20.000 caracteres (4.000 × páginas) | derivado |
| Tokens estimados de entrada | techo del documento + indicaciones: ⌈(12.000 + 1.000)/3,5⌉ = 3.715 para texto pegado; ⌈(20.000 + 1.000)/3,5⌉ = 6.000 para archivos. Solo cuenta lo que aporta el usuario (documento + "Variantes"); el prompt de sistema y el schema son fijos y **no** cuentan. Es una segunda barrera de costo coherente con los límites de caracteres (no puede rechazar algo que ya pasó el límite de caracteres de su fuente). | derivado |
| Notas para la IA | 1.000 caracteres | constante |
| Tokens de salida pedidos | 24.000 | constante |
| Timeout por llamada al proveedor | 120 s | `AI_TEMPLATE_TIMEOUT_MS` (5–240 s) |
| Timeout de extracción | 15 s | constante |
| Generaciones por usuario y día (CR) | 2 | `AI_TEMPLATE_DAILY_LIMIT`; override por Workspace |
| Generaciones activas por usuario | 1 | fijo |
| Retry técnico | 1 | fijo |
| Límites de la propuesta | 150 variables, 10 bloques, 4 alternativas, 60 apariciones/variable, 400.000 caracteres de JSON | constantes |

Notas de plataforma: el proxy de Next.js bufferiza hasta 10 MiB; Vercel
limita además el cuerpo de las funciones (~4,5 MB), por lo que **en Vercel
el límite efectivo de archivo es ese**. Una escritura de ≤ 5 páginas en
.docx o PDF de texto suele pesar muy por debajo. La ruta declara
`maxDuration = 300` (dos llamadas + extracción).

## 9. Cuota y retry

- Una unidad de cuota por generación solicitada por el usuario. El retry
  técnico interno usa la misma fila y la misma unidad.
- Hay como máximo **un** retry, de uno de dos tipos:
  - **reparación**: la salida no era JSON del schema, tenía ítems
    inválidos o incidencias semánticas `repair`. El retry reenvía la salida
    anterior (si era JSON utilizable, delimitada como dato no confiable) y
    la lista de incidencias (códigos y rutas, sin texto), y pide corregir
    SOLO eso. Luego se valida TODO otra vez.
  - **técnico**: error transitorio del proveedor antes de procesar (5xx,
    529 overloaded, red); repite la solicitud idéntica.
  Si la reparación falla pero el primer intento ya era utilizable
  (coherente tras los descartes), se conserva ese borrador; si nada es
  utilizable, no se crea ningún Machote y la persona ve un mensaje genérico
  ("No fue posible completar la generación. Intenta nuevamente"), sin
  detalles técnicos. El log seguro registra `repairAttempted` y los
  códigos de incidencia (`issueCodes`), nunca el contenido. **Un timeout nunca se reintenta** (política central en
  `runTemplateGeneration`): la solicitud pudo haberse procesado y
  facturado, y repetirla duplicaría costo y latencia. Tampoco se reintenta:
  archivo inválido, PDF sin texto, rate limit, entrada demasiado grande,
  permiso denegado, rechazo del modelo, truncado por tokens.
- Un timeout consume la unidad de cuota (puede haber costo). LexCR aborta
  su conexión HTTP al cumplirse `AI_TEMPLATE_TIMEOUT_MS`; no puede
  garantizar que el proveedor detenga la generación de su lado, por lo que
  el costo de ese intento puede existir aunque el usuario vea el error.
- Una generación que nunca llegó a facturarse (proveedor no alcanzable,
  rate limit, credenciales) no consume cuota; si algún intento obtuvo
  respuesta del proveedor, sí la consume.
- Día calendario de Costa Rica. Una fila `running` huérfana (> 10 min) se
  cierra como `abandoned` al iniciar otra y sigue contando.

Override por Workspace (administración técnica, sin UI):

```sql
insert into public.workspace_ai_settings (workspace_id, ai_template_daily_limit_per_user)
values ('<workspace-uuid>', 20)
on conflict (workspace_id) do update
  set ai_template_daily_limit_per_user = excluded.ai_template_daily_limit_per_user,
      updated_at = now();
```

## 10. Operación

### 10.1 Variables de entorno (server-only)

```env
AI_PROVIDER=openai          # openai | anthropic; vacío = feature apagada
OPENAI_API_KEY=             # secreto (si AI_PROVIDER=openai)
OPENAI_MODEL=               # obligatorio, sin valor por defecto
ANTHROPIC_API_KEY=          # secreto (si AI_PROVIDER=anthropic)
ANTHROPIC_MODEL=            # obligatorio, sin valor por defecto
ANTHROPIC_WORKSPACE_ID=     # opcional: solo para keys sin workspace
# Opcionales (solo pueden endurecer los defaults):
AI_TEMPLATE_MAX_FILE_BYTES=
AI_TEMPLATE_MAX_PAGES=
AI_TEMPLATE_DAILY_LIMIT=
AI_TEMPLATE_TIMEOUT_MS=
```

Requiere también `SUPABASE_SERVICE_ROLE_KEY` (ya usada por invitaciones)
para el libro de cuota. Local: `.env.local`. Vercel: Project Settings →
Environment Variables (Production/Preview), sin prefijo `NEXT_PUBLIC_`.
`AI_PROVIDER=fake` activa el proveedor simulado **solo** fuera de
producción (lo usan los E2E); en builds de producción/Preview se rechaza.

### 10.2 Troubleshooting

| Síntoma | Causa probable |
|---|---|
| "La creación con IA no está disponible" | `AI_PROVIDER` vacío/inválido, faltan la clave/modelo del proveedor elegido (`OPENAI_*` o `ANTHROPIC_*`) o la service role, o un override numérico fuera de rango |
| `provider_unavailable` constante | clave inválida (401), sin saldo (402 en Anthropic), modelo inexistente (404) o caída/sobrecarga del proveedor (5xx, 529) — ver `providerHttpStatus` en el log `ai_template_generation` |
| "El servicio de IA rechazó la solicitud…" (`provider_rejected`) | el proveedor respondió 400: revisar `providerErrorType` en el log; causa típica en Anthropic: API key de organización sin workspace (ver §3.3) |
| `invalid_output` frecuente | el modelo configurado no respeta bien el schema; probar otro modelo |
| `quota_exceeded` | cuota diaria alcanzada; override por Workspace (§9) |
| `generation_in_progress` persistente | fila `running` de un proceso caído; se libera sola a los 10 min |

## 11. Pruebas

- Unitarias: extracción (DOCX/PDF/zip bomb/MIME/escaneado/límites),
  contrato y JSON Schema, reconstrucción (fidelidad, deduplicación, roles,
  solapamientos, normalizaciones, Bloques, Índice, inyección como texto),
  prompt (separación y nonce), adapters OpenAI y Anthropic con `fetch`
  simulado (request sin tools, schema adaptado, mapeo de errores sin fugas,
  sin reintentos propios del SDK, timeout), servicio sobre el adapter
  Anthropic simulado, configuración, servicio (retry máx. 1, cuota
  no duplicada, borrador, errores del proveedor, entradas de seguridad, logs
  sin contenido), parseo de solicitud (un documento), same-origin.
- pgTAP: `supabase/tests/ai_template_generation.test.sql`.
- E2E: `e2e/template-ai-generation-authenticated.spec.ts` (proyecto
  `chromium-template-ai-generation`) con el proveedor simulado. Nunca se
  llama a un proveedor real en E2E ni en CI.

## 12. Justificación de diseño (resumen académico)

- **El LLM no escribe en la base de datos**: la salida de un modelo es
  input no confiable. Solo el backend, después de validar, escribe, y lo
  hace con la sesión del usuario para que RLS y los permisos existentes
  sigan siendo la autoridad.
- **Sin herramientas**: la tarea es una transformación documento → JSON; no
  requiere efectos. Sin tools, una inyección no tiene capacidades que
  secuestrar (mínimo privilegio).
- **Salida estructurada revalidada**: el schema del proveedor reduce
  errores de forma, pero no es una frontera de seguridad propia; la
  validación server-side (Zod estricto + validadores del editor) sí lo es y
  es independiente del proveedor.
- **Referencias en lugar de texto**: garantiza por construcción la
  fidelidad al documento original y hace verificable cada cambio.
- **Proveedor abstraído**: el dominio depende de un contrato propio; cambiar
  de proveedor o modelo es configuración + un adapter.
- **Publicación humana**: la responsabilidad profesional es del abogado;
  el sistema solo prepara un borrador.
- **Documentos no persistidos**: minimización de datos; el único resultado
  persistido es el Machote, igual que en el flujo manual.

## 13. Limitaciones conocidas

- El límite efectivo de archivo en Vercel es el del cuerpo de funciones
  (~4,5 MB), no 10 MB.
- Las páginas de un DOCX dependen del metadato `Pages` (lo escribe Word; si
  falta, rige el límite de caracteres).
- Tablas complejas, encabezados/pies y notas al pie de un DOCX no se
  extraen como estructura (solo párrafos del cuerpo); el formato (negrita,
  etc.) no se conserva.
- El texto de PDF depende de la capa de texto; columnas o guiones de corte
  de línea pueden producir saltos que la IA no puede referenciar a través
  de párrafos.
- Un dato cuyo literal cruza un salto de línea no puede convertirse en
  variable (las referencias son por párrafo).
- `digits_to_words` separa también las letras de un identificador ("AJK" →
  "A J K"); no existe hoy una transformación que conserve grupos de letras.
- Las cuatro variantes estándar de Chasis/VIN/Serie usan redacción de LexCR
  (minúsculas, "número"); el abogado puede ajustarlas en el editor.
- No se calcula costo monetario (solo tokens).
- No hay cancelación de una generación en curso.
- La calidad depende del modelo configurado; la revisión humana es
  obligatoria.
