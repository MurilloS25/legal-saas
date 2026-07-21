import { describe, expect, it } from "vitest";
import {
  formatIndexDate,
  formatIndexTime,
  formatNotarialGenerationDate,
  notarialFortnightLabel,
  notarialIndexFilename,
  notarialMonthName,
} from "./formatters";

describe("notarial index formatters", () => {
  it("formats persisted instants in Costa Rica", () => {
    const instant = "2026-07-16T05:30:00.000Z";
    expect(formatIndexDate(instant)).toBe("15/07/2026");
    expect(formatIndexTime(instant)).toBe("23:30hrs");
  });

  it("uses uppercase Spanish labels", () => {
    expect(notarialMonthName(7)).toBe("JULIO");
    expect(notarialFortnightLabel("FIRST_HALF")).toBe("primera quincena");
    expect(notarialFortnightLabel("SECOND_HALF")).toBe("segunda quincena");
  });

  it("formats the generation date in Costa Rica", () => {
    expect(
      formatNotarialGenerationDate(new Date("2026-08-01T05:30:00.000Z")),
    ).toBe("31 DE JULIO DEL 2026");
  });

  it("builds a predictable safe filename", () => {
    expect(
      notarialIndexFilename({ year: 2026, month: 7, half: "FIRST_HALF" }),
    ).toBe("indice-notarial-primera-quincena-julio-2026.docx");
  });
});
