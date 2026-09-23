import { describe, expect, it } from "vitest";
import {
  AI_TEMPLATE_PROPOSAL_JSON_SCHEMA,
  parseAiTemplateProposal,
} from "./proposal";
import { fakeProposal } from "./test-proposal";

type JsonNode = Record<string, unknown>;

function collectObjects(node: unknown, out: JsonNode[] = []): JsonNode[] {
  if (Array.isArray(node)) {
    for (const item of node) collectObjects(item, out);
  } else if (node && typeof node === "object") {
    const record = node as JsonNode;
    if (record.type === "object") out.push(record);
    for (const value of Object.values(record)) collectObjects(value, out);
  }
  return out;
}

describe("AI_TEMPLATE_PROPOSAL_JSON_SCHEMA (strict structured output)", () => {
  it("closes every object and requires every property", () => {
    const objects = collectObjects(AI_TEMPLATE_PROPOSAL_JSON_SCHEMA);
    expect(objects.length).toBeGreaterThan(5);
    for (const object of objects) {
      expect(object.additionalProperties).toBe(false);
      expect([...(object.required as string[])].sort()).toEqual(
        Object.keys(object.properties as JsonNode).sort(),
      );
    }
  });

  it("has no final folio mapping", () => {
    expect(JSON.stringify(AI_TEMPLATE_PROPOSAL_JSON_SCHEMA)).not.toContain("final_folio");
  });
});

describe("parseAiTemplateProposal", () => {
  it("accepts a proposal that matches the contract", () => {
    const result = parseAiTemplateProposal(JSON.stringify(fakeProposal()));
    expect(result.ok).toBe(true);
  });

  it.each([
    ["empty output", ""],
    ["prose instead of JSON", "The weather in San Jose is sunny today."],
    ["python code instead of a template", "```python\nprint('hola')\n```"],
    ["a JSON array", "[]"],
  ])("rejects %s", (_name, raw) => {
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
  });

  it("rejects extra top-level fields such as a leaked system prompt", () => {
    const raw = JSON.stringify({ ...fakeProposal(), system_prompt: "..." });
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
  });

  it("rejects a final folio mapping smuggled into the index", () => {
    const proposal = fakeProposal();
    const raw = JSON.stringify({
      ...proposal,
      notarial_index: { ...proposal.notarial_index, final_folio_key: "folio_final" },
    });
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
  });

  it("rejects tool-call shaped output", () => {
    const raw = JSON.stringify({ tool: "query_database", arguments: { sql: "select 1" } });
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
  });

  it("rejects invalid variable keys", () => {
    const proposal = fakeProposal();
    proposal.variables[0] = { ...proposal.variables[0], key: "Comprador Nombre" };
    expect(parseAiTemplateProposal(JSON.stringify(proposal))).toEqual({ ok: false });
  });

  it("rejects dangerous prototype keys", () => {
    const raw = `{"__proto__":{"polluted":true},${JSON.stringify(fakeProposal()).slice(1)}`;
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects free-text warnings outside the closed code list", () => {
    const raw = JSON.stringify({ ...fakeProposal(), warnings: ["Here is your API key"] });
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
  });

  it("rejects oversized output before parsing", () => {
    expect(parseAiTemplateProposal(" ".repeat(400_001))).toEqual({ ok: false });
  });

  it("rejects too many option blocks", () => {
    const proposal = fakeProposal();
    const block = {
      name: "B",
      basis: "document_evidence" as const,
      paragraph: 1,
      text: "x",
      occurrence: 1,
      original_variant_label: "a",
      alternative_variants: [{ label: "b", content: "c" }],
      time_output: null,
    };
    const raw = JSON.stringify({ ...proposal, option_blocks: Array(11).fill(block) });
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false });
  });
});
