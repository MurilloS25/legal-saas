import { describe, expect, it } from "vitest";
import {
  createDocumentNotarialSnapshot,
  resolveDocumentNotarialSnapshot,
} from "./document-notarial-snapshot";
import type { TemplateIndexConfiguration } from "./template-index-configuration";

const configuration: TemplateIndexConfiguration = {
  id: "config-v1",
  templateId: "template-v1",
  partySeparator: " Y ",
  fixedSuffix: "TESTIGOS",
  allowEmpty: false,
  mappingsValid: true,
  simpleFields: {
    instrument_number: "field-number",
    authorized_date: "field-date",
    authorized_time: null,
    protocol_book: null,
    initial_folio: null,
    final_folio: null,
  },
  authorizedTimeOptionBlockId: "authorization-time",
  invalidMappings: [],
  fields: [{ templateFieldId: "field-party", order: 0 }],
};

describe("document notarial configuration snapshot", () => {
  it("freezes template name and mappings by stable field key", () => {
    const snapshot = createDocumentNotarialSnapshot(
      "Compraventa v1",
      configuration,
      [
        { id: "field-number", fieldKey: "instrumento" },
        { id: "field-date", fieldKey: "fecha" },
        { id: "field-party", fieldKey: "parte_nombre" },
      ],
    );

    expect(snapshot).toMatchObject({
      templateName: "Compraventa v1",
      configuration: {
        simpleFields: {
          instrument_number: "instrumento",
          authorized_date: "fecha",
        },
        fields: [{ fieldKey: "parte_nombre", order: 0 }],
      },
    });

    const resolved = resolveDocumentNotarialSnapshot(snapshot);
    expect(resolved.templateName).toBe("Compraventa v1");
    expect(resolved.configuration?.simpleFields.instrument_number).toBe("instrumento");
    expect(resolved.configuration?.fields).toEqual([
      { templateFieldId: "parte_nombre", order: 0 },
    ]);
  });

  it("does not change when a later template configuration uses v2 ids or names", () => {
    const v1 = createDocumentNotarialSnapshot("Acto v1", configuration, [
      { id: "field-number", fieldKey: "instrumento_v1" },
      { id: "field-date", fieldKey: "fecha_v1" },
      { id: "field-party", fieldKey: "parte_v1" },
    ]);
    const v2 = createDocumentNotarialSnapshot(
      "Acto v2",
      {
        ...configuration,
        id: "config-v2",
        simpleFields: { ...configuration.simpleFields, instrument_number: "field-v2" },
      },
      [{ id: "field-v2", fieldKey: "instrumento_v2" }],
    );

    expect(resolveDocumentNotarialSnapshot(v1).templateName).toBe("Acto v1");
    expect(
      resolveDocumentNotarialSnapshot(v1).configuration?.simpleFields.instrument_number,
    ).toBe("instrumento_v1");
    expect(resolveDocumentNotarialSnapshot(v2).templateName).toBe("Acto v2");
  });
});
