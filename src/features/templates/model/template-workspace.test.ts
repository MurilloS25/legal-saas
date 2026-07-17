import { describe, expect, it } from "vitest";
import { parseTemplateWorkspacePayload } from "./template-workspace";
import { legacyTextToDocument } from "@/lib/editor/convert";

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

const validDocument = JSON.stringify(
  legacyTextToDocument("Comparece {{comprador.nombre}} hoy."),
);
const validVariables = JSON.stringify([
  { field_key: "comprador.nombre", label: "Nombre del comprador", required: true },
]);

const validEntries = {
  name: "Machote de prueba",
  description: "Descripción",
  status: "draft",
  document: validDocument,
  variables: validVariables,
};

describe("parseTemplateWorkspacePayload", () => {
  it("accepts a complete valid payload", () => {
    const result = parseTemplateWorkspacePayload(formDataFrom(validEntries));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.name).toBe("Machote de prueba");
      expect(result.payload.variables).toHaveLength(1);
      expect(result.payload.document.type).toBe("doc");
    }
  });

  it("accepts an empty variables list and no description", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({
        ...validEntries,
        description: "",
        variables: "[]",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.payload.description).toBeUndefined();
      expect(result.payload.variables).toEqual([]);
    }
  });

  it("accepts a document with an unlabeled variable (attrs.label: null, as Tiptap serializes a pasted/typed placeholder)", () => {
    const documentWithUnlabeledVariable = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Comparece " },
            { type: "templateVariable", attrs: { key: "pegada.nueva", label: null } },
            { type: "text", text: " hoy." },
          ],
        },
      ],
    });
    const result = parseTemplateWorkspacePayload(
      formDataFrom({
        ...validEntries,
        document: documentWithUnlabeledVariable,
        variables: "[]",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a missing name with a field error", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({ ...validEntries, name: "   " }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBe("El nombre del machote es requerido");
    }
  });

  it("rejects an invalid status", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({ ...validEntries, status: "publicado" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.status).toBeDefined();
  });

  it("rejects malformed document JSON", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({ ...validEntries, document: "{not json" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.document).toBe(
        "El contenido del machote no es válido.",
      );
    }
  });

  it("rejects a document with unknown nodes", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({
        ...validEntries,
        document: JSON.stringify({
          type: "doc",
          content: [{ type: "script", content: [] }],
        }),
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.document).toBeDefined();
  });

  it("rejects an oversized document payload before parsing", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({
        ...validEntries,
        document: `"${"a".repeat(1_000_001)}"`,
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.document).toBeDefined();
  });

  it("rejects variables that are not an array", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({ ...validEntries, variables: '{"a":1}' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.variables).toBe(
        "La configuración de variables no es válida.",
      );
    }
  });

  it("rejects duplicated variable keys", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({
        ...validEntries,
        variables: JSON.stringify([
          { field_key: "a", label: "A", required: false },
          { field_key: "a", label: "Otra A", required: true },
        ]),
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.variables).toBe(
        "Hay variables duplicadas en la configuración.",
      );
    }
  });

  it("rejects invalid variable keys and blank labels", () => {
    for (const variables of [
      [{ field_key: "Con Mayúscula", label: "X", required: false }],
      [{ field_key: "ok", label: "   ", required: false }],
      [{ field_key: "ok", label: "X", required: "sí" }],
    ]) {
      const result = parseTemplateWorkspacePayload(
        formDataFrom({ ...validEntries, variables: JSON.stringify(variables) }),
      );
      expect(result.success).toBe(false);
    }
  });

  it("collects several errors at once", () => {
    const result = parseTemplateWorkspacePayload(
      formDataFrom({
        name: "",
        description: "",
        status: "draft",
        document: "null",
        variables: "null",
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeDefined();
      expect(result.errors.document).toBeDefined();
      expect(result.errors.variables).toBeDefined();
    }
  });
});
