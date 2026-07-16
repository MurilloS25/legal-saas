import { costaRicaDayEndIso, costaRicaDayStartIso } from "./datetime";

export const NOTARIAL_FORTNIGHTS = ["FIRST_HALF", "SECOND_HALF"] as const;
export type NotarialFortnight = (typeof NOTARIAL_FORTNIGHTS)[number];

export type FortnightSelection = {
  year: number;
  month: number;
  half: NotarialFortnight;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseFortnightSelection(raw: {
  year?: string;
  month?: string;
  half?: string;
}): FortnightSelection | null {
  const year = Number(raw.year);
  const month = Number(raw.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!(NOTARIAL_FORTNIGHTS as readonly string[]).includes(raw.half ?? "")) {
    return null;
  }
  return { year, month, half: raw.half as NotarialFortnight };
}

export function fortnightForCostaRicaIso(
  iso: string,
): NotarialFortnight | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Costa_Rica",
      day: "numeric",
    }).format(date),
  );
  return day <= 15 ? "FIRST_HALF" : "SECOND_HALF";
}

export function fortnightRange(
  year: number,
  month: number,
  half: NotarialFortnight,
): { fromIso: string; toIso: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fromDay = half === "FIRST_HALF" ? 1 : 16;
  const toDay = half === "FIRST_HALF" ? 15 : lastDay;
  const prefix = `${year}-${pad2(month)}-`;
  const fromIso = costaRicaDayStartIso(`${prefix}${pad2(fromDay)}`);
  const toIso = costaRicaDayEndIso(`${prefix}${pad2(toDay)}`);
  if (!fromIso || !toIso) throw new Error("Invalid fortnight selection");
  return { fromIso, toIso };
}
