/**
 * Transformaciones de salida configurables por variable: convierten el valor
 * capturado (texto libre) a una representación en palabras, en MAYÚSCULAS,
 * para su uso en Escrituras notariales (cédulas, VIN, placas, cilindraje,
 * cantidades, día de fecha, etc.).
 *
 * Único punto de verdad: estas funciones son puras y las consume tanto la
 * configuración del Machote como el pipeline de render compartido
 * (`resolveValue` en `render.ts`), para que formulario, previsualización,
 * `rendered_content` y DOCX nunca diverjan.
 */

export const VARIABLE_OUTPUT_TRANSFORMS = [
  "none",
  "digits_to_words",
  "number_to_words",
] as const;

export type VariableOutputTransform = (typeof VARIABLE_OUTPUT_TRANSFORMS)[number];

export const VARIABLE_OUTPUT_TRANSFORM_LABELS: Record<
  VariableOutputTransform,
  string
> = {
  none: "Sin transformación",
  digits_to_words: "Dígitos en palabras",
  number_to_words: "Número completo en palabras",
};

/**
 * Normaliza un valor de transformación leído de la base de datos (columna
 * `text`, no tipada por Postgres) al tipo estricto. Un valor desconocido cae
 * a `none` en vez de romper el render.
 */
export function toVariableOutputTransform(raw: string): VariableOutputTransform {
  return (VARIABLE_OUTPUT_TRANSFORMS as readonly string[]).includes(raw)
    ? (raw as VariableOutputTransform)
    : "none";
}

const DIGIT_WORDS = [
  "CERO",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
] as const;

function stripControlChars(input: string): string {
  let result = "";
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) continue;
    result += char;
  }
  return result;
}

/**
 * Convierte cada dígito de `raw` en su palabra individual, preserva las
 * letras (en MAYÚSCULAS) y elimina separadores no semánticos (guiones y
 * espacios). No agrupa dígitos ni interpreta el valor como un número entero:
 * el orden original de caracteres se conserva. Cualquier otro carácter se
 * conserva tal cual (salvo caracteres de control, que se descartan).
 *
 * Ejemplos: "208390123" -> "DOS CERO OCHO TRES NUEVE CERO UNO DOS TRES";
 * "V20839" -> "V DOS CERO OCHO TRES NUEVE"; "ABC-102" -> "A B C UNO CERO DOS".
 */
export function digitsToUppercaseWords(raw: string): string {
  const withoutControlChars = stripControlChars(raw);
  const withoutSeparators = withoutControlChars.replace(/[-\s]/g, "");
  const tokens: string[] = [];
  for (const char of withoutSeparators.toUpperCase()) {
    tokens.push(/[0-9]/.test(char) ? DIGIT_WORDS[Number(char)] : char);
  }
  return tokens.join(" ");
}

/** Límite superior soportado por `integerToUppercaseWords` (documentado). */
export const MAX_NUMBER_TO_WORDS = 999_999_999;

export type IntegerToWordsResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const UNITS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
];

const TEN_TO_NINETEEN = [
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
];

const TWENTIES = [
  "VEINTE",
  "VEINTIUNO",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];

const TENS = [
  "",
  "",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function twoDigitsToWords(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEN_TO_NINETEEN[n - 10];
  if (n < 30) return TWENTIES[n - 20];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return units === 0 ? TENS[tens] : `${TENS[tens]} Y ${UNITS[units]}`;
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (rest > 0) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

function integerToWordsUnsafe(n: number): string {
  if (n === 0) return "CERO";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const units = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(
      millions === 1 ? "UN MILLÓN" : `${threeDigitsToWords(millions)} MILLONES`,
    );
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "MIL" : `${threeDigitsToWords(thousands)} MIL`);
  }
  if (units > 0 || parts.length === 0) {
    parts.push(threeDigitsToWords(units));
  }
  return parts.join(" ");
}

/**
 * Convierte un entero no negativo (como texto) a su representación completa
 * en palabras, en MAYÚSCULAS ("1600" -> "MIL SEISCIENTOS"). Solo acepta
 * enteros no negativos dentro de `MAX_NUMBER_TO_WORDS`; rechaza negativos,
 * decimales, notación científica, letras, `NaN`/`Infinity` y valores fuera
 * de rango con un error legible en vez de lanzar una excepción.
 */
export function integerToUppercaseWords(raw: string): IntegerToWordsResult {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      error: "El valor debe ser un número entero no negativo.",
    };
  }
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n > MAX_NUMBER_TO_WORDS) {
    return {
      ok: false,
      error: `El valor debe estar entre 0 y ${MAX_NUMBER_TO_WORDS}.`,
    };
  }
  return { ok: true, value: integerToWordsUnsafe(n) };
}

/**
 * Aplica la transformación configurada a un valor ya resuelto. Si la
 * transformación no puede aplicarse (p. ej. `number_to_words` sobre un valor
 * que no es un entero válido), se conserva el valor original sin transformar
 * en vez de romper el render del documento.
 */
export function applyVariableTransform(
  value: string,
  transform: VariableOutputTransform,
): string {
  switch (transform) {
    case "none":
      return value;
    case "digits_to_words":
      return digitsToUppercaseWords(value);
    case "number_to_words": {
      const result = integerToUppercaseWords(value);
      return result.ok ? result.value : value;
    }
  }
}
