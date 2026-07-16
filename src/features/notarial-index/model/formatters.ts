import type { FortnightSelection, NotarialFortnight } from "./fortnight";

const MONTHS = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
] as const;

function dateParts(value: Date): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  );
}

export function notarialMonthName(month: number): string {
  return MONTHS[month - 1] ?? "";
}

export function notarialFortnightLabel(half: NotarialFortnight): string {
  return half === "FIRST_HALF" ? "primera quincena" : "segunda quincena";
}

export function formatIndexDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateParts(date);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatIndexTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateParts(date);
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${hour}:${parts.minute}hrs`;
}

export function formatNotarialGenerationDate(date: Date): string {
  const parts = dateParts(date);
  return `${Number(parts.day)} DE ${notarialMonthName(Number(parts.month))} DEL ${parts.year}`;
}

export function notarialIndexFilename(selection: FortnightSelection): string {
  const half =
    selection.half === "FIRST_HALF" ? "primera-quincena" : "segunda-quincena";
  return `indice-notarial-${half}-${notarialMonthName(selection.month).toLocaleLowerCase("es-CR")}-${selection.year}.docx`;
}
