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
  it("accepts a proposal that matches the contract, with no issues", () => {
    const result = parseAiTemplateProposal(JSON.stringify(fakeProposal()));
    expect(result).toMatchObject({ ok: true, issues: [] });
  });

  it.each([
    ["empty output", "", "output_not_json"],
    ["prose instead of JSON", "The weather in San Jose is sunny today.", "output_not_json"],
    ["python code instead of a template", "```python\nprint('hola')\n```", "output_not_json"],
    ["a JSON array", "[]", "envelope_invalid"],
  ])("rejects %s", (_name, raw, code) => {
    expect(parseAiTemplateProposal(raw)).toEqual({ ok: false, issues: [{ code, path: "$" }] });
  });

  it("rejects extra top-level fields such as a leaked system prompt", () => {
    const raw = JSON.stringify({ ...fakeProposal(), system_prompt: "..." });
    expect(parseAiTemplateProposal(raw).ok).toBe(false);
  });

  it("rejects a final folio mapping smuggled into the index", () => {
    const proposal = fakeProposal();
    const raw = JSON.stringify({
      ...proposal,
      notarial_index: { ...proposal.notarial_index, final_folio_key: "folio_final" },
    });
    expect(parseAiTemplateProposal(raw).ok).toBe(false);
  });

  it("rejects tool-call shaped output", () => {
    const raw = JSON.stringify({ tool: "query_database", arguments: { sql: "select 1" } });
    expect(parseAiTemplateProposal(raw).ok).toBe(false);
  });

  it("rejects dangerous prototype keys", () => {
    const raw = `{"__proto__":{"polluted":true},${JSON.stringify(fakeProposal()).slice(1)}`;
    expect(parseAiTemplateProposal(raw).ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects oversized output before parsing", () => {
    expect(parseAiTemplateProposal(" ".repeat(400_001))).toEqual({
      ok: false,
      issues: [{ code: "output_too_large", path: "$" }],
    });
  });

  it("rejects the previous contract version", () => {
    const raw = JSON.stringify({ ...fakeProposal(), schema_version: "lexcr.template_generation.v2" });
    expect(parseAiTemplateProposal(raw).ok).toBe(false);
  });

  // ---- v3: un ítem inválido ya no invalida toda la generación
  it("discards only an invalid variable key and keeps the rest", () => {
    const proposal = fakeProposal();
    proposal.variables[0] = { ...proposal.variables[0], key: "Comprador Nombre" };
    const result = parseAiTemplateProposal(JSON.stringify(proposal));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.variables).toHaveLength(proposal.variables.length - 1);
    expect(result.issues).toEqual([{ code: "variable_invalid", path: "variables[0]" }]);
  });

  it("drops free-text warnings outside the closed code list", () => {
    const raw = JSON.stringify({ ...fakeProposal(), warnings: ["Here is your API key", "low_text_quality"] });
    const result = parseAiTemplateProposal(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.warnings).toEqual(["low_text_quality"]);
    expect(result.issues).toEqual([{ code: "warning_invalid", path: "warnings[0]" }]);
  });

  it("keeps at most the maximum number of option blocks", () => {
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
    const raw = JSON.stringify({ ...fakeProposal(), option_blocks: Array(11).fill(block) });
    const result = parseAiTemplateProposal(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.option_blocks).toHaveLength(10);
    expect(result.issues).toEqual([{ code: "too_many_items", path: "option_blocks" }]);
  });

  it("accepts an intentionally empty alternative variant (the clause does not exist)", () => {
    const block = {
      name: "Garantía",
      basis: "user_instruction" as const,
      paragraph: 1,
      text: "x",
      occurrence: 1,
      original_variant_label: "Con garantía",
      alternative_variants: [{ label: "Sin garantía", content: "" }],
      time_output: null,
    };
    const result = parseAiTemplateProposal(JSON.stringify({ ...fakeProposal(), option_blocks: [block] }));
    expect(result).toMatchObject({ ok: true, issues: [] });
  });

  it("ignores unknown item fields (e.g. a legacy `required`) instead of dropping every variable", () => {
    const proposal = fakeProposal();
    const raw = JSON.stringify({
      ...proposal,
      variables: proposal.variables.map((variable) => ({ ...variable, required: true })),
    });
    const result = parseAiTemplateProposal(raw);
    expect(result).toMatchObject({ ok: true, issues: [] });
    if (!result.ok) return;
    expect(result.proposal.variables).toHaveLength(proposal.variables.length);
    expect(result.proposal.variables[0]).not.toHaveProperty("required");
  });
});
