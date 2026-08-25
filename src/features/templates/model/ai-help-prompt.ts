/**
 * Prompt de ayuda para preparar un machote con una herramienta de IA
 * externa (ChatGPT, Claude, Gemini, etc.).
 *
 * Puramente informativo: LexCR nunca envía este texto a ningún servicio —
 * solo se copia al portapapeles para que la persona lo use fuera de la
 * aplicación. La sintaxis que enseña es la real que entiende el editor
 * (ver `src/lib/editor/variable-key.ts`: `{{clave}}`, clave en minúsculas,
 * dígitos, `_` y `.` como separador de segmentos — sin lista cerrada de
 * roles, cualquier primer segmento antes de un punto agrupa como rol).
 *
 * El marcador `[[OPCIÓN MÚLTIPLE: ...]]` es una convención SOLO de este
 * prompt, no una sintaxis que el editor de LexCR interprete — los bloques
 * de opciones reales se insertan por UI (`OptionBlockDialog`), nunca desde
 * texto pegado. Doble corchete a propósito: no colisiona con `{{clave}}` ni
 * con nada que el editor intente convertir automáticamente al pegar.
 */
export const MACHOTE_AI_HELP_PROMPT = `Necesito convertir una escritura o documento legal en un machote reutilizable para LexCR.

OBJETIVO
Analiza el documento que voy a proporcionar e identifica la información que normalmente puede cambiar entre una escritura y otra. Reemplaza cada dato variable y devuélveme el machote resultante.

SINTAXIS DE VARIABLES
Reemplaza cada dato variable utilizando exactamente este formato:

{{nombre_variable}}

Cuando puedas identificar claramente una parte o participante del acto, agrupa su información utilizando el formato:

{{rol.dato}}

Por ejemplo:

{{comprador.nombre}}
{{comprador.identificacion}}
{{vendedor.nombre}}
{{vendedor.identificacion}}
{{monto}}

Reglas de la clave de cada variable (nombre_variable o rol.dato):

- Solo minúsculas, números, "_" y "." — sin tildes, espacios ni otros símbolos.
- Usa "_" para separar palabras dentro de un mismo segmento (ej. fecha_otorgamiento).
- Usa "." únicamente para agrupar por rol o parte (ej. comprador.nombre), no como separador de palabras.
- Si el mismo dato aparece varias veces en el documento, utiliza EXACTAMENTE la misma clave en todas sus apariciones — LexCR sustituye todas las ocurrencias de una misma clave a la vez.
- No hay una lista fija de roles: cualquier primer segmento antes del punto (comprador, vendedor, fiador, etc.) funciona como agrupador.

OPCIONES MÚLTIPLES
Si una parte del documento debería elegirse entre varias cláusulas u opciones (por ejemplo, distintas formas de pago), NO inventes una variable ni una sintaxis especial para eso — LexCR no puede interpretar un bloque de opciones desde texto pegado. En su lugar, deja este marcador literal en su lugar, con las opciones sugeridas:

[[OPCIÓN MÚLTIPLE: nombre del bloque — opciones sugeridas: opción uno | opción dos | opción tres]]

Yo lo configuraré manualmente en LexCR después de pegar el documento.

OTRAS REGLAS
- No conviertas en variable texto jurídico que normalmente permanece fijo.
- No resumas el documento.
- No reescribas innecesariamente su contenido.
- No cambies el significado jurídico.
- Conserva la estructura y redacción original tanto como sea posible.
- No inventes información.
- No completes datos que no existan en el documento.

FORMATO DE RESPUESTA
Devuelve ÚNICAMENTE el texto final del machote, listo para copiar y pegar en LexCR. No agregues explicaciones, comentarios, resumen, lista de variables utilizadas, notas al final, ni ningún contenido fuera del documento mismo.

IMPORTANTE:
El resultado será revisado manualmente antes de utilizarse en LexCR. No asumas que tu salida será jurídicamente correcta ni definitiva.

Documento a convertir:

[PEGA AQUÍ EL DOCUMENTO O ADJÚNTALO A LA HERRAMIENTA DE IA]`;
