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
pueden redactarse de varias formas ("Variantes del documento"), acepta el
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
       · Variantes del documento (opcional)  — no es un chat
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
  `lexcr.template_generation.v2` transformado (`toAnthropicJsonSchema`:
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

Schema (`lexcr.template_generation.v2`, resumido; v2 agregó
`vehicle_identifiers` y retiró la base de bloque `known_pattern_vin_chassis_serial`):

```text
{ schema_version, template:{name, description|null},
  variables:[{ key, label, semantic_type, output_transform, required,
               needs_review, occurrences:[{paragraph,text,occurrence}] }],
  option_blocks:[{ name, basis, paragraph, text, occurrence,
                   original_variant_label,
                   alternative_variants:[{label, content "{{clave}}"}],
                   time_output: {original:{hour_key,minute_key|null},
                                 alternatives:[…]} | null }],
  vehicle_identifiers: { paragraph, text, occurrence, original_case,
                         chassis_key, vin_key, serial_key } | null,
  notarial_index:{ instrument_number_key, authorized_date_key,
                   authorized_time_key, authorized_time_option_block,
                   protocol_book_key, initial_folio_key, party_keys[] },
  warnings:[código cerrado] }
```

No existe `final_folio` en el contrato: el folio final **no se puede
inferir** (depende de cómo termine impresa la escritura) y queda pendiente
para el abogado.

## 4. Comportamiento de la IA

- **Variables**: máximo número razonable de datos variables (partes,
  identificaciones, estado civil, profesión, domicilios, fechas, horas,
  montos, folios, número de escritura, vehículos, fincas…). Convención
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

## 5. Seguridad

### 5.1 Fronteras de confianza

```text
Navegador ──(no confiable: archivo, texto, indicaciones)──► Route Handler
Route Handler ──(auth, permiso, límites)──► extracción en memoria
Servicio ──(solo párrafos + indicaciones)──► Proveedor IA (no confiable)
Proveedor ──(JSON no confiable)──► parse + Zod + build + validadores
Servicio ──(borrador validado)──► RPC existente con la sesión del usuario
Servicio ──(metadata)──► RPCs del libro (service role, sin contenido)
```

### 5.2 Mínimo privilegio del modelo

- **Herramientas disponibles al LLM: ninguna.** No se envía `tools`; no hay
  function calling, navegación, SQL, filesystem ni publicación.
- **Secretos accesibles al LLM: ninguno.** El prompt no contiene claves,
  variables de entorno, IDs de usuario/Workspace ni datos de otros módulos
  (clientes, escrituras, cobros, otros usuarios). La API key solo viaja en
  la cabecera HTTP hacia el proveedor, nunca en el contenido.
- El modelo no escribe en la base de datos: lo hace el backend, después de
  validar, y con la **sesión del usuario** (RLS y permisos actuales).
- No hay ruta de publicación: el status `draft` está fijado en el adapter de
  persistencia y `finish_ai_template_generation` exige un borrador del mismo
  Workspace.

### 5.3 Prompt injection (defensa en profundidad)

No se afirma que pueda eliminarse al 100 %. Capas:

1. Separación canal de sistema / datos; documento e indicaciones entre
   delimitadores con **nonce aleatorio por solicitud** (un documento no
   puede cerrar su propio bloque).
2. Instrucción explícita: nada dentro de los bloques cambia objetivo,
   schema, reglas ni alcance; las órdenes se tratan como texto y generan la
   advertencia `document_contains_instructions`.
3. Salida forzada a JSON Schema estricto (sin propiedades extra; advertencias
   solo de una lista cerrada).
4. Revalidación server-side con Zod `.strict()` y rechazo de claves de
   prototipo: texto conversacional, código, "tool calls" o un campo
   `system_prompt` se rechazan.
5. Reconstrucción desde el texto original: aunque el modelo "obedezca" una
   inyección, no puede introducir texto en el cuerpo del documento; solo
   puede proponer referencias que deben existir literalmente.
6. Sin herramientas ni secretos: una inyección exitosa no tiene nada que
   ejecutar ni exfiltrar.
7. El campo "Variantes del documento" solo influye en Bloques de opciones
   con base `user_instruction`; preguntas fuera de tema no cambian la tarea
   (el resultado sigue siendo una propuesta de Machote o un error).

### 5.4 Modelo de amenazas

| Amenaza | Mitigación |
|---|---|
| Inyección desde el documento | §5.3; texto preservado literal; sin tools |
| Inyección desde "Variantes" | mismo canal no confiable; solo afecta bases `user_instruction`; límite 1.000 caracteres |
| Extraer el system prompt | schema estricto sin campo libre; el prompt no contiene secretos; salida fuera de schema rechazada |
| Exfiltración de secretos | ningún secreto en el prompt/contexto; errores del proveedor sanitizados; clave solo server-side (sin `NEXT_PUBLIC_`) |
| Uso como IA de propósito general | sin chat; una sola tarea; respuestas conversacionales fallan la validación |
| Acceso cross-workspace | Workspace resuelto con la sesión; RPC existente deriva el Workspace del actor; libro con RLS por membresía; `begin` re-verifica membresía |
| Archivos maliciosos | tipo real por firma + extensión + MIME; `.doc`/imágenes rechazados; parsers acotados; sin disco |
| Archivos enormes | 10 MB, 5 páginas, caracteres máximos, `content-length` antes de parsear |
| Parser bombs | ZIP en streaming con tope, máx. entradas; PDF con páginas validadas primero y timeout de extracción |
| Denial-of-wallet | 2 generaciones/usuario/día (configurable), 1 activa por usuario, 1 retry técnico máximo, tokens de salida acotados, límites de entrada |
| Bypass concurrente de cuota | `pg_advisory_xact_lock` por usuario + índice único parcial `running`; RPCs solo `service_role` (el usuario no puede reembolsarse cuota) |
| Output injection / XSS almacenado | el output se convierte solo a nodos permitidos del documento; React escapa texto; sin `dangerouslySetInnerHTML`, URLs, scripts ni atributos HTML |
| Salida estructurada inválida | 1 retry técnico; luego error y nada se escribe |
| SSRF | ninguna librería recibe URLs; PDF.js sin red; DOCX sin DTD/entidades externas; única salida de red: URL fija del proveedor |
| Logs con datos sensibles | log con lista cerrada de campos; errores genéricos en `console.error`; sin cuerpo de respuesta del proveedor |
| CSRF sobre el Route Handler | verificación de `Origin` = host, además de cookies `SameSite` |

### 5.5 Autorización

- UI: botón solo con `templates.write`.
- Servidor: `requireApiWorkspace()` + `hasPermission(role, "templates.write")`.
- Base de datos: `save_template_workspace` exige rol de escritura en el
  Workspace activo; `begin_ai_template_generation` vuelve a exigir
  membresía activa con rol propietario/administrador/asistente.

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
proveedor). Nunca: documento, texto extraído, indicaciones, prompt,
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
| Variantes del documento | 1.000 caracteres | constante |
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
- Solo se reintenta (una vez) ante: salida estructurada inválida, salida
  vacía, error transitorio del proveedor antes de procesar (5xx, 529
  overloaded, red). **Un timeout nunca se reintenta** (política central en
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
