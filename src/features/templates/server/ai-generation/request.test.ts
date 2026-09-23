import { describe, expect, it } from "vitest";
import { buildFakeProposal } from "./providers/fake";
import { parseGenerationSource } from "./request";
import { parseAiTemplateProposal } from "../../model/ai-generation/proposal";

const limits = { maxFileBytes: 1_000, maxPastedChars: 100 };

function form(entries: Array<[string, string | File]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const pdf = (name = "a.pdf", size = 10) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

describe("parseGenerationSource", () => {
  it("accepts pasted text", async () => {
    expect(await parseGenerationSource(form([["source_kind", "text"], ["text", "Hola"]]), limits)).toEqual({
      ok: true,
      source: { kind: "text", text: "Hola" },
    });
  });

  it("accepts exactly one file", async () => {
    const result = await parseGenerationSource(form([["source_kind", "file"], ["file", pdf()]]), limits);
    expect(result.ok && result.source.kind).toBe("file");
  });

  it("rejects multiple files (one document per generation)", async () => {
    expect(
      await parseGenerationSource(
        form([["source_kind", "file"], ["file", pdf("a.pdf")], ["file", pdf("b.pdf")]]),
        limits,
      ),
    ).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects text and file at the same time", async () => {
    expect(
      await parseGenerationSource(form([["source_kind", "file"], ["text", "x"], ["file", pdf()]]), limits),
    ).toEqual({ ok: false, code: "invalid_input" });
    expect(
      await parseGenerationSource(form([["source_kind", "text"], ["text", "x"], ["file", pdf()]]), limits),
    ).toEqual({ ok: false, code: "invalid_input" });
  });

  it("rejects an oversized file before reading it", async () => {
    expect(
      await parseGenerationSource(form([["source_kind", "file"], ["file", pdf("a.pdf", 1_001)]]), limits),
    ).toEqual({ ok: false, code: "file_too_large" });
  });

  it("rejects an unknown source kind", async () => {
    expect(await parseGenerationSource(form([["source_kind", "url"], ["text", "http://x"]]), limits)).toEqual({
      ok: false,
      code: "invalid_input",
    });
  });
});

describe("buildFakeProposal (local/E2E only)", () => {
  it("produces a contract-valid proposal from fake test data", () => {
    const proposal = buildFakeProposal({
      paragraphs: [
        "ESCRITURA NUMERO DOS. Comparece TEST PERSONA UNO y TEST PERSONA DOS.",
        "Vende TEST PERSONA DOS a TEST PERSONA UNO.",
      ],
      variantInstructions: null,
    });
    expect(parseAiTemplateProposal(JSON.stringify(proposal)).ok).toBe(true);
    expect(proposal.variables.find((v) => v.key === "comprador.nombre")?.occurrences).toEqual([
      { paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 },
      { paragraph: 2, text: "TEST PERSONA UNO", occurrence: 1 },
    ]);
    expect(proposal.notarial_index.party_keys).toEqual(["comprador.nombre", "vendedor.nombre"]);
  });
});
