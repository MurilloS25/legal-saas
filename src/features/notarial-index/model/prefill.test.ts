import { describe, expect, it } from "vitest";
import type { TemplateIndexConfiguration } from "./template-index-configuration";
import type { NotarialMetadata } from "./notarial";
import { resolveNotarialMetadataPrefill } from "./prefill";
import type { TemplateDocument } from "@/lib/editor/types";

const fieldIds = {
  instrument: "11111111-1111-4111-8111-111111111111",
  date: "22222222-2222-4222-8222-222222222222",
  time: "33333333-3333-4333-8333-333333333333",
  book: "44444444-4444-4444-8444-444444444444",
  initialFolio: "55555555-5555-4555-8555-555555555555",
  finalFolio: "66666666-6666-4666-8666-666666666666",
  seller: "77777777-7777-4777-8777-777777777777",
};

const fields = [
  { id: fieldIds.instrument, fieldKey: "instrument.number" },
  { id: fieldIds.date, fieldKey: "authorized.date" },
  { id: fieldIds.time, fieldKey: "authorized.time" },
  { id: fieldIds.book, fieldKey: "protocol.book" },
  { id: fieldIds.initialFolio, fieldKey: "folio.initial" },
  { id: fieldIds.finalFolio, fieldKey: "folio.final" },
  { id: fieldIds.seller, fieldKey: "seller.name" },
];

const configuration: TemplateIndexConfiguration = {
  id: "88888888-8888-4888-8888-888888888888",
  templateId: "99999999-9999-4999-8999-999999999999",
  simpleFields: {
    instrument_number: fieldIds.instrument,
    authorized_date: fieldIds.date,
    authorized_time: fieldIds.time,
    protocol_book: fieldIds.book,
    initial_folio: fieldIds.initialFolio,
    final_folio: fieldIds.finalFolio,
  },
  authorizedTimeOptionBlockId: null,
  invalidMappings: [],
  partySeparator: " Y ",
  fixedSuffix: null,
  allowEmpty: false,
  isComplete: true,
  fields: [{ templateFieldId: fieldIds.seller, order: 0 }],
};

const suggestions = {
  instrumentNumber: 42,
  protocolBook: "08",
  initialFolio: "10",
};

const timeBlockDocument: TemplateDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "optionBlock",
          attrs: {
            blockId: "hora-block",
            name: "Hora",
            defaultVariantId: "en_punto",
            variants: [
              {
                id: "en_punto",
                label: "Hora en punto",
                content: [
                  { type: "templateVariable", attrs: { key: "hora" } },
                ],
              },
              {
                id: "con_minutos",
                label: "Hora y minutos",
                content: [
                  { type: "templateVariable", attrs: { key: "hora" } },
                  { type: "templateVariable", attrs: { key: "minutos" } },
                ],
              },
            ],
            structuredOutput: {
              type: "time",
              variants: [
                {
                  variantId: "en_punto",
                  hourFieldKey: "hora",
                  minuteFieldKey: null,
                },
                {
                  variantId: "con_minutos",
                  hourFieldKey: "hora",
                  minuteFieldKey: "minutos",
                },
              ],
            },
          },
        },
      ],
    },
  ],
};

describe("resolveNotarialMetadataPrefill", () => {
  it("combines a mapped date with the selected Hora block output", () => {
    const result = resolveNotarialMetadataPrefill({
      metadata: null,
      configuration: {
        ...configuration,
        simpleFields: { ...configuration.simpleFields, authorized_time: null },
        authorizedTimeOptionBlockId: "hora-block",
      },
      availableFields: fields,
      fieldValues: {
        "authorized.date": "2026-07-15",
        hora: "diez",
        minutos: "veinte",
      },
      templateDocument: timeBlockDocument,
      optionSelections: { "hora-block": "con_minutos" },
      templateName: "Compraventa",
      generatedParties: null,
      suggestions,
    });

    expect(result.authorizedAt).toMatchObject({
      value: "2026-07-15T10:20",
      compatible: true,
      rawTime: "diez / veinte",
      optionBlockName: "Hora",
      optionVariantLabel: "Hora y minutos",
    });
  });

  it("leaves an invalid Hora block output for manual review", () => {
    const result = resolveNotarialMetadataPrefill({
      metadata: null,
      configuration: {
        ...configuration,
        simpleFields: { ...configuration.simpleFields, authorized_time: null },
        authorizedTimeOptionBlockId: "hora-block",
      },
      availableFields: fields,
      fieldValues: { "authorized.date": "2026-07-15", hora: "25" },
      templateDocument: timeBlockDocument,
      optionSelections: { "hora-block": "en_punto" },
      templateName: "Compraventa",
      generatedParties: null,
      suggestions,
    });

    expect(result.authorizedAt).toMatchObject({
      value: "",
      compatible: false,
      rawTime: "25 / 00",
      optionBlockName: "Hora",
    });
  });

  it("normalizes mapped values without changing the rendered document", () => {
    const result = resolveNotarialMetadataPrefill({
      metadata: null,
      configuration,
      availableFields: fields,
      fieldValues: {
        "instrument.number": "sesenta y uno",
        "authorized.date": "quince de julio de dos mil veintiséis",
        "authorized.time": "dieciséis horas con treinta minutos",
        "protocol.book": "Tomo IX",
        "folio.initial": "40F",
        "folio.final": "40V",
        "seller.name": "  Ana   Mora ",
      },
      templateName: "Compraventa",
      generatedParties: "ANA MORA",
      suggestions,
    });

    expect(result.instrumentNumber).toMatchObject({
      value: "61",
      source: "template",
      rawValue: "sesenta y uno",
      compatible: true,
    });
    expect(result.authorizedAt).toMatchObject({
      value: "2026-07-15T16:30",
      source: "template",
      compatible: true,
      rawDate: "quince de julio de dos mil veintiséis",
      rawTime: "dieciséis horas con treinta minutos",
    });
    expect(result.protocolBook).toMatchObject({
      value: "",
      rawValue: "Tomo IX",
      compatible: false,
    });
    expect(result.initialFolio).toMatchObject({
      value: "",
      rawValue: "40F",
      compatible: false,
    });
    expect(result.finalFolio).toMatchObject({
      value: "",
      rawValue: "40V",
      compatible: false,
    });
    expect(result.actName).toMatchObject({
      value: "Compraventa",
      source: "template",
    });
    expect(result.parties).toMatchObject({
      value: "ANA MORA",
      source: "template",
    });
  });

  it("combines only already-compatible mapped date and time values", () => {
    const result = resolveNotarialMetadataPrefill({
      metadata: null,
      configuration,
      availableFields: fields,
      fieldValues: {
        "instrument.number": "61",
        "authorized.date": "2026-07-15",
        "authorized.time": "16:30",
      },
      templateName: "Compraventa",
      generatedParties: null,
      suggestions,
    });

    expect(result.instrumentNumber).toMatchObject({
      value: "61",
      source: "template",
      compatible: true,
    });
    expect(result.authorizedAt).toMatchObject({
      value: "2026-07-15T16:30",
      source: "template",
      compatible: true,
    });
  });

  it("never overwrites an existing document metadata snapshot", () => {
    const metadata: NotarialMetadata = {
      instrument_number: 7,
      authorized_at: "2026-07-14T16:30:00.000Z",
      protocol_book: "Guardado",
      initial_folio: "1F",
      final_folio: "2V",
      act_name_snapshot: "Nombre histórico",
      act_name_override: "Corrección manual",
      generated_parties: "PARTE HISTÓRICA",
      parties_override: "PARTE CORREGIDA",
      notes: "Nota",
      version: 3,
      updated_at: "2026-07-14T16:30:00.000Z",
      notarial_confirmed_at: null,
      notarial_confirmed_by: null,
      notarial_review_required: false,
    };

    const result = resolveNotarialMetadataPrefill({
      metadata,
      configuration,
      availableFields: fields,
      fieldValues: {
        "instrument.number": "99",
        "protocol.book": "Nuevo",
      },
      templateName: "Nombre nuevo",
      generatedParties: "PARTE NUEVA",
      suggestions,
    });

    expect(result.instrumentNumber).toMatchObject({ value: "7", source: "saved" });
    expect(result.instrumentNumber.rawValue).toBe("99");
    expect(result.protocolBook).toMatchObject({
      value: "Guardado",
      source: "saved",
      rawValue: "Nuevo",
    });
    expect(result.actName).toMatchObject({
      value: "Corrección manual",
      source: "saved",
    });
    expect(result.parties).toMatchObject({
      value: "PARTE CORREGIDA",
      source: "saved",
    });
  });

  it("uses suggestions only when a mapped value is absent", () => {
    const result = resolveNotarialMetadataPrefill({
      metadata: null,
      configuration: {
        ...configuration,
        simpleFields: {
          ...configuration.simpleFields,
          instrument_number: null,
          protocol_book: null,
          initial_folio: null,
          final_folio: null,
        },
      },
      availableFields: fields,
      fieldValues: {},
      templateName: "Compraventa",
      generatedParties: null,
      suggestions,
    });

    expect(result.instrumentNumber).toMatchObject({
      value: "42",
      source: "suggestion",
    });
    expect(result.protocolBook).toMatchObject({
      value: "8",
      source: "suggestion",
    });
    expect(result.initialFolio.value).toBe("10");
    expect(result.finalFolio.value).toBe("10");
  });
});
