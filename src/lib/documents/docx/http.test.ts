import { describe, expect, it } from "vitest";
import { contentDispositionAttachment, DOCX_MIME } from "./http";
import { buildDocxFilename } from "./filename";

describe("DOCX_MIME", () => {
  it("is the OOXML wordprocessing MIME type", () => {
    expect(DOCX_MIME).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });
});

describe("contentDispositionAttachment", () => {
  it("emits an attachment disposition with ascii and RFC 5987 filenames", () => {
    const header = contentDispositionAttachment("Escritura.docx");
    expect(header).toBe(
      "attachment; filename=\"Escritura.docx\"; filename*=UTF-8''Escritura.docx",
    );
  });

  it("keeps accents only in the encoded variant, ascii-folds the fallback", () => {
    const header = contentDispositionAttachment("Pública.docx");
    // El fallback ASCII sustituye la í/á por "_"; la variante* la codifica.
    expect(header).toContain('filename="P_blica.docx"');
    expect(header).toContain("filename*=UTF-8''P%C3%BAblica.docx");
  });

  it("never lets a quote break the quoted token", () => {
    const header = contentDispositionAttachment('a"b.docx');
    expect(header).toContain('filename="a_b.docx"');
    // No hay una comilla suelta que cierre el filename antes de tiempo.
    expect(header.match(/filename="[^"]*"/)).not.toBeNull();
  });

  it("strips CR/LF so a second header cannot be injected", () => {
    const header = contentDispositionAttachment("a\r\nSet-Cookie: x.docx");
    // El único vector de inyección de un header nuevo es un CR/LF crudo:
    // no debe sobrevivir en ninguna de las dos variantes del filename.
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
  });

  it("encodes RFC 5987 reserved chars ' ( ) *", () => {
    const header = contentDispositionAttachment("a'(b)*.docx");
    const star = /filename\*=UTF-8''(.+)$/.exec(header)?.[1] ?? "";
    expect(star).not.toMatch(/['()*]/);
  });

  it("is safe end-to-end when fed a sanitized filename", () => {
    // Un título hostil, ya pasado por buildDocxFilename.
    const filename = buildDocxFilename("../../etc/passwd\r\nX: y");
    const header = contentDispositionAttachment(filename);
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    expect(header).not.toContain("/");
    expect(header.endsWith(".docx") || header.includes(".docx")).toBe(true);
  });
});
