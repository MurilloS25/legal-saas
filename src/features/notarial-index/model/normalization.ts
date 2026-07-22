import { MAX_NUMBER_TO_WORDS } from "@/lib/editor/text-transforms";

export type NotarialSemanticType = "integer" | "date" | "time" | "text";
export type NotarialLocale = "es-CR";

export const NOTARIAL_SEMANTIC_TYPES = {
  instrument_number: "integer",
  protocol_book: "integer",
  initial_folio: "integer",
  final_folio: "integer",
  authorized_date: "date",
  authorized_time: "time",
  act_name: "text",
  parties: "text",
} as const satisfies Record<string, NotarialSemanticType>;

export type NormalizationFailureReason =
  | "empty"
  | "ambiguous"
  | "invalid"
  | "out_of_range"
  | "unsupported_format";

export type NormalizationResult<T> =
  | { ok: true; value: T; source: "structured" | "parsed" }
  | {
      ok: false;
      reason: NormalizationFailureReason;
      originalValue: string;
    };

type NormalizationInput<T extends NotarialSemanticType> = {
  value: string;
  type: T;
  locale: NotarialLocale;
};

const SIMPLE_NUMBERS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const TENS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
};

const INTEGER_PREFIXES = new Set([
  "tomo",
  "numero",
  "instrumento",
  "folio",
]);

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function normalizeWords(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-CR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function parseUnderHundred(tokens: readonly string[]): number | null {
  if (tokens.length === 1) {
    return SIMPLE_NUMBERS[tokens[0]] ?? TENS[tokens[0]] ?? null;
  }
  if (
    tokens.length === 3 &&
    tokens[1] === "y" &&
    TENS[tokens[0]] !== undefined &&
    SIMPLE_NUMBERS[tokens[2]] !== undefined &&
    SIMPLE_NUMBERS[tokens[2]] >= 1 &&
    SIMPLE_NUMBERS[tokens[2]] <= 9
  ) {
    return TENS[tokens[0]] + SIMPLE_NUMBERS[tokens[2]];
  }
  return null;
}

function parseUnderThousand(tokens: readonly string[]): number | null {
  if (tokens.length === 0) return 0;
  if (tokens[0] === "cien") return tokens.length === 1 ? 100 : null;
  const hundreds = HUNDREDS[tokens[0]];
  if (hundreds !== undefined) {
    if (tokens.length === 1) return hundreds;
    const rest = parseUnderHundred(tokens.slice(1));
    return rest === null ? null : hundreds + rest;
  }
  return parseUnderHundred(tokens);
}

function parseUnderMillion(tokens: readonly string[]): number | null {
  const thousandIndexes = tokens.flatMap((token, index) =>
    token === "mil" ? [index] : [],
  );
  if (thousandIndexes.length > 1) return null;
  if (thousandIndexes.length === 0) return parseUnderThousand(tokens);
  const index = thousandIndexes[0];
  const high = index === 0 ? 1 : parseUnderThousand(tokens.slice(0, index));
  const low = parseUnderThousand(tokens.slice(index + 1));
  if (high === null || low === null || high === 0) return null;
  return high * 1000 + low;
}

function parseSpanishIntegerWords(tokens: readonly string[]): number | null {
  const millionIndexes = tokens.flatMap((token, index) =>
    token === "millon" || token === "millones" ? [index] : [],
  );
  if (millionIndexes.length > 1) return null;
  if (millionIndexes.length === 0) return parseUnderMillion(tokens);
  const index = millionIndexes[0];
  if (index === 0) return null;
  const high = parseUnderMillion(tokens.slice(0, index));
  const low = parseUnderMillion(tokens.slice(index + 1));
  if (high === null || low === null || high === 0) return null;
  if (tokens[index] === "millon" && high !== 1) return null;
  if (tokens[index] === "millones" && high === 1) return null;
  return high * 1_000_000 + low;
}

function looksLikeAmbiguousNumber(tokens: readonly string[]): boolean {
  return tokens.every(
    (token) =>
      token === "y" ||
      token === "mil" ||
      token === "millon" ||
      token === "millones" ||
      /^\d+$/.test(token) ||
      SIMPLE_NUMBERS[token] !== undefined ||
      TENS[token] !== undefined ||
      HUNDREDS[token] !== undefined ||
      token === "cien",
  );
}

function normalizeInteger(value: string): NormalizationResult<number> {
  const trimmed = value.trim();
  if (trimmed === "") return failure(value, "empty");
  let normalized = normalizeWords(trimmed);
  const tokensWithPrefix = normalized.split(" ");
  if (INTEGER_PREFIXES.has(tokensWithPrefix[0])) {
    normalized = tokensWithPrefix.slice(1).join(" ");
  }
  if (normalized === "") return failure(value, "invalid");

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_NUMBER_TO_WORDS) {
      return failure(value, "out_of_range");
    }
    return {
      ok: true,
      value: parsed,
      source: normalized === String(parsed) ? "structured" : "parsed",
    };
  }
  if (/^[+-]?\d|\d[.,]|\d[eE]/.test(normalized)) {
    return failure(value, "unsupported_format");
  }

  const tokens = normalized.split(" ");
  const parsed = parseSpanishIntegerWords(tokens);
  if (parsed === null) {
    return failure(
      value,
      looksLikeAmbiguousNumber(tokens) ? "ambiguous" : "unsupported_format",
    );
  }
  if (parsed > MAX_NUMBER_TO_WORDS) return failure(value, "out_of_range");
  return { ok: true, value: parsed, source: "parsed" };
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function canonicalDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDate(value: string): NormalizationResult<string> {
  const trimmed = value.trim();
  if (trimmed === "") return failure(value, "empty");

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const [, year, month, day] = iso.map(Number);
    if (!validDate(year, month, day)) return failure(value, "invalid");
    return { ok: true, value: canonicalDate(year, month, day), source: "structured" };
  }

  const numeric = /^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/.exec(trimmed);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[3]);
    const year = Number(numeric[4]);
    if (!validDate(year, month, day)) return failure(value, "invalid");
    return { ok: true, value: canonicalDate(year, month, day), source: "parsed" };
  }
  if (/^[\d./-]+$/.test(trimmed)) return failure(value, "invalid");

  const tokens = normalizeWords(trimmed)
    .split(" ")
    .filter((token) => token !== "de" && token !== "del");
  const monthIndex = tokens.findIndex((token) => MONTHS[token] !== undefined);
  if (monthIndex <= 0 || monthIndex >= tokens.length - 1) {
    return failure(value, "unsupported_format");
  }
  if (tokens.some((token, index) => MONTHS[token] !== undefined && index !== monthIndex)) {
    return failure(value, "ambiguous");
  }
  const day = normalizeInteger(tokens.slice(0, monthIndex).join(" "));
  const year = normalizeInteger(tokens.slice(monthIndex + 1).join(" "));
  if (!day.ok || !year.ok) return failure(value, "unsupported_format");
  const month = MONTHS[tokens[monthIndex]];
  if (!validDate(year.value, month, day.value)) return failure(value, "invalid");
  return {
    ok: true,
    value: canonicalDate(year.value, month, day.value),
    source: "parsed",
  };
}

function canonicalTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function validTime(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function normalizeTime(value: string): NormalizationResult<string> {
  const trimmed = value.trim();
  if (trimmed === "") return failure(value, "empty");
  const numeric = /^(\d{1,2})([:.])(\d{1,2})$/.exec(trimmed);
  if (numeric) {
    const hour = Number(numeric[1]);
    const minute = Number(numeric[3]);
    if (!validTime(hour, minute)) return failure(value, "invalid");
    return {
      ok: true,
      value: canonicalTime(hour, minute),
      source:
        numeric[2] === ":" && trimmed === canonicalTime(hour, minute)
          ? "structured"
          : "parsed",
    };
  }
  if (/^[\d:.]+$/.test(trimmed)) return failure(value, "invalid");

  const tokens = normalizeWords(trimmed).split(" ");
  const hourMarker = tokens.findIndex(
    (token) => token === "hora" || token === "horas",
  );
  if (hourMarker <= 0) return failure(value, "unsupported_format");
  const hour = normalizeInteger(tokens.slice(0, hourMarker).join(" "));
  if (!hour.ok) return failure(value, hour.reason);

  const rest = tokens.slice(hourMarker + 1);
  let minute = 0;
  if (rest.length > 0) {
    if (
      rest[0] !== "con" ||
      !["minuto", "minutos"].includes(rest[rest.length - 1]) ||
      rest.length < 3
    ) {
      return failure(value, "unsupported_format");
    }
    const parsedMinute = normalizeInteger(rest.slice(1, -1).join(" "));
    if (!parsedMinute.ok) return failure(value, parsedMinute.reason);
    minute = parsedMinute.value;
  }
  if (!validTime(hour.value, minute)) return failure(value, "invalid");
  return { ok: true, value: canonicalTime(hour.value, minute), source: "parsed" };
}

function failure<T>(
  originalValue: string,
  reason: NormalizationFailureReason,
): NormalizationResult<T> {
  return { ok: false, reason, originalValue };
}

export function normalizeNotarialValue(
  input: NormalizationInput<"integer">,
): NormalizationResult<number>;
export function normalizeNotarialValue(
  input: NormalizationInput<"date" | "time" | "text">,
): NormalizationResult<string>;
export function normalizeNotarialValue(
  input: NormalizationInput<NotarialSemanticType>,
): NormalizationResult<number | string> {
  switch (input.type) {
    case "integer":
      return normalizeInteger(input.value);
    case "date":
      return normalizeDate(input.value);
    case "time":
      return normalizeTime(input.value);
    case "text": {
      const value = input.value.trim();
      return value === ""
        ? failure(input.value, "empty")
        : { ok: true, value, source: "structured" };
    }
  }
}
