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
- En el Machote generado se muestra una advertencia persistente y no
  invasiva ("Generado con asistencia de IA"), con las claves que el modelo
  marcó para revisión. **No se muestran porcentajes de confianza**: no hay
  una calibración real que los respalde.
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
  readonly id: string;     // "openai"
  readonly model: string;  // de OPENAI_MODEL, nunca hardcodeado
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

### 3.3 Cambiar a Anthropic u otro proveedor

1. Crear `providers/anthropic.ts` que implemente `AiTemplateProvider`
   (Messages API con salida estructurada/JSON y **sin tools**), mapeando sus
   errores a `AiProviderError`.
2. Agregar `"anthropic"` a `SUPPORTED_PROVIDERS` y leer
   `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` en `config.ts`.
3. Agregar el `case` en `providers/index.ts`.
4. Configurar `AI_PROVIDER=anthropic` + variables.

Nada más cambia: prompt, contrato, validación, construcción, persistencia,
cuota y UI son neutrales de proveedor. Cambiar solo de **modelo** es
cambiar `OPENAI_MODEL` (queda registrado por generación).

### 3.4 Extracción (`lib/documents/extraction`)

| Fuente | Implementación | Defensas |
|---|---|---|
| Texto pegado | normalización | máx. caracteres; vacío rechazado |
| `.docx` | `jszip` + recorrido de `w:p`/`w:t` | firma ZIP, `[Content_Types].xml` de Word, máx. entradas ZIP, descompresión en streaming con tope de bytes (zip bomb), `<!DOCTYPE` rechazado (sin XXE/SSRF), solo entidades XML estándar, texto borrado en control de cambios descartado, páginas por `docProps/app.xml` si existe |
| `.pdf` | `unpdf` (build serverless de PDF.js) | firma `%PDF-`, páginas validadas antes de extraer, corte por caracteres, sin red (`disableRange/Stream/AutoFetch`), XFA desactivado, sin compilación de fuentes con `eval`, contraseña → rechazo, sin capa de texto → rechazo (sin OCR) |

Tipo real = extensión **y** MIME declarado **y** firma binaria coherentes.
`.doc` (OLE), imágenes y cualquier otra extensión se rechazan. El nombre del
archivo solo se usa para leer la extensión; nada se escribe en disco.

### 3.5 Contrato estructurado y fidelidad

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

Schema (`lexcr.template_generation.v1`, resumido):

```text
{ schema_version, template:{name, description|null},
  variables:[{ key, label, semantic_type, output_transform, required,
               needs_review, occurrences:[{paragraph,text,occurrence}] }],
  option_blocks:[{ name, basis, paragraph, text, occurrence,
                   original_variant_label,
                   alternative_variants:[{label, content "{{clave}}"}],
                   time_output: {original:{hour_key,minute_key|null},
                                 alternatives:[…]} | null }],
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
  motor determinista actual (`applyVariableTransform`). Regla defensiva: si
  el modelo propone `digits_to_words` para horas, minutos, días, años,
  cantidades, montos, folios o número de escritura, LexCR lo corrige a
  `number_to_words` (30 minutos → TREINTA, nunca TRES CERO). Identificadores
  (cédula, VIN, chasis, serie, placa) pueden usar `digits_to_words`.
- **Fechas y horas**: el modelo solo clasifica (`date`, `time_hour`,
  `time_minutes`); no hay tipo de campo nuevo. La fecha completa usa
  `number_to_words` (el motor actual convierte "25 de julio de 2026"); hora
  y minutos son variables separadas; la hora puede mapearse al Índice como
  campo o como Bloque de hora con salida estructurada (`structuredOutput`
  existente).
- **Autollenado desde Clientes**: no lo decide el modelo; se usa la
  inferencia determinista existente (`suggestAutofillSource`).
- **Bloques de opciones**: solo con una base admitida:
  1. `known_pattern_vin_chassis_serial` (el fragmento debe mencionar chasis,
     VIN o serie — verificado por LexCR);
  2. `known_pattern_time_minutes` (el fragmento debe mencionar horas —
     verificado);
  3. `document_evidence` (alternativas presentes en el documento);
  4. `user_instruction` (solo si el abogado escribió "Variantes del
     documento" — verificado).
  Sin base, o con alternativas que usan claves no declaradas, el bloque se
  descarta. Ante duda, no se crea: el abogado puede agregarlo después.
- **Índice Notarial**: solo mapeos de alta confianza a los destinos
  existentes (número de instrumento, fecha, hora, tomo, folio inicial,
  partes). Se guardan con la RPC existente
  `save_template_index_mapping_with_block_source`; sin partes el Índice
  queda "Pendiente de definir". La naturaleza del acto sigue usando el
  nombre del Machote (fallback existente), por lo que el modelo propone un
  nombre breve del acto.
- **Human-in-the-loop**: todo resultado es `draft`, se revisa en el stepper
  normal y solo una persona publica.

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
intentos, tokens de entrada/salida, categoría y estado HTTP del error del
proveedor. Nunca: documento, texto extraído, indicaciones, prompt,
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
| Tokens estimados de entrada | ~6.000 (3,5 caracteres/token) | derivado |
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
  vacía, error transitorio del proveedor (5xx, red, timeout). No se
  reintenta: archivo inválido, PDF sin texto, rate limit, entrada demasiado
  grande, permiso denegado, rechazo del modelo, truncado por tokens.
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
AI_PROVIDER=openai          # vacío = feature apagada
OPENAI_API_KEY=             # secreto
OPENAI_MODEL=               # obligatorio, sin valor por defecto
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
| "La creación con IA no está disponible" | `AI_PROVIDER` vacío/inválido, falta `OPENAI_API_KEY`/`OPENAI_MODEL`/service role, o un override numérico fuera de rango |
| `provider_unavailable` constante | clave inválida (401), modelo inexistente (404) o caída del proveedor — ver `providerHttpStatus` en el log `ai_template_generation` |
| `invalid_output` frecuente | el modelo configurado no respeta bien el schema; probar otro modelo |
| `quota_exceeded` | cuota diaria alcanzada; override por Workspace (§9) |
| `generation_in_progress` persistente | fila `running` de un proceso caído; se libera sola a los 10 min |

## 11. Pruebas

- Unitarias: extracción (DOCX/PDF/zip bomb/MIME/escaneado/límites),
  contrato y JSON Schema, reconstrucción (fidelidad, deduplicación, roles,
  solapamientos, normalizaciones, Bloques, Índice, inyección como texto),
  prompt (separación y nonce), adapter OpenAI (request sin tools, mapeo de
  errores sin fugas, timeout), configuración, servicio (retry máx. 1, cuota
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
- No se calcula costo monetario (solo tokens).
- No hay cancelación de una generación en curso.
- La calidad depende del modelo configurado; la revisión humana es
  obligatoria.
