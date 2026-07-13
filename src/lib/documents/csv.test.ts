import { describe, expect, it } from "vitest";
import { CSV_BOM, escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("leaves plain text untouched", () => {
    expect(escapeCsvCell("Compraventa")).toBe("Compraventa");
  });

  it("quotes cells with commas, quotes or newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });

  it("neutralizes formula-injection prefixes", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("+1")).toBe("'+1");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
    expect(escapeCsvCell(" =SUM(A1)")).toBe("' =SUM(A1)");
    expect(escapeCsvCell("  +1")).toBe("'  +1");
  });

  it("both neutralizes and quotes when needed", () => {
    // Empieza por '=' y contiene coma.
    expect(escapeCsvCell("=1,2")).toBe("\"'=1,2\"");
  });

  it("neutralizes tab/CR-led cells", () => {
    expect(escapeCsvCell("\t=1").startsWith("'")).toBe(true);
    expect(escapeCsvCell("\r=1")).toBe("\"'\r=1\"");
    expect(escapeCsvCell("\n=1")).toBe("\"'\n=1\"");
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF and cells with commas", () => {
    expect(
      toCsv([
        ["Número", "Tipo"],
        ["100", "Compraventa"],
      ]),
    ).toBe("Número,Tipo\r\n100,Compraventa");
  });

  it("prepends the BOM when requested", () => {
    expect(toCsv([["á"]], { bom: true })).toBe(`${CSV_BOM}á`);
  });

  it("escapes each cell", () => {
    expect(toCsv([["=1", "a,b"]])).toBe("'=1,\"a,b\"");
  });
});
