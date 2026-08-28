import { describe, expect, it } from "vitest";
import type { TemplateIndexConfiguration } from "./template-index-configuration";
import type { NotarialMetadata } from "./notarial";
import { resolveNotarialMetadataPrefill } from "./prefill";
import { costaRicaLocalToIso } from "./datetime";
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

/** Fila `document_notarial_metadata` completa, con snapshots derivados
 * `null` por defecto (equivalente a una fila creada antes de la migración
 * que los agregó, o a una que nunca se guardó desde un valor derivado). */
function metadataFixture(
  overrides: Partial<NotarialMetadata> = {},
): NotarialMetadata {
  return {
    instrument_number: null,
    authorized_at: null,
    protocol_book: null,
    initial_folio: null,
    final_folio: null,
    act_name_snapshot: null,
    act_name_override: null,
    generated_parties: null,
    parties_override: null,
    notes: null,
    version: 1,
    updated_at: "2026-07-14T16:30:00.000Z",
    notarial_confirmed_at: null,
    notarial_confirmed_by: null,
    notarial_review_required: false,
    instrument_number_derived_snapshot: null,
    authorized_date_derived_snapshot: null,
    authorized_time_derived_snapshot: null,
    protocol_book_derived_snapshot: null,
    initial_folio_derived_snapshot: null,
    final_folio_derived_snapshot: null,
    ...overrides,
  };
}

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

    expect(result.authorizedAt.date).toMatchObject({
      value: "2026-07-15",
      compatible: true,
    });
    expect(result.authorizedAt.time).toMatchObject({
      value: "10:20",
      compatible: true,
      rawValue: "diez / veinte",
    });
    expect(result.authorizedAt.optionBlockName).toBe("Hora");
    expect(result.authorizedAt.optionVariantLabel).toBe("Hora y minutos");
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

    expect(result.authorizedAt.time).toMatchObject({
      value: "",
      compatible: false,
      rawValue: "25 / 00",
    });
    expect(result.authorizedAt.optionBlockName).toBe("Hora");
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
    expect(result.authorizedAt.date).toMatchObject({
      value: "2026-07-15",
      source: "template",
      compatible: true,
    });
    expect(result.authorizedAt.time).toMatchObject({
      value: "16:30",
      source: "template",
      compatible: true,
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
    expect(result.authorizedAt.date.value).toBe("2026-07-15");
    expect(result.authorizedAt.time.value).toBe("16:30");
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

  // ------------------------------------------------------------ item 2:
  // Fecha y Hora se derivan de forma independiente.
  describe("independent Fecha/Hora derivation", () => {
    it("Caso A — derives both when both are mappable", () => {
      const result = resolveNotarialMetadataPrefill({
        metadata: null,
        configuration,
        availableFields: fields,
        fieldValues: { "authorized.date": "2026-07-15", "authorized.time": "16:30" },
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.authorizedAt.date.value).toBe("2026-07-15");
      expect(result.authorizedAt.time.value).toBe("16:30");
    });

    it("Caso B — derives Fecha alone, Hora stays pending, never invents 00:00", () => {
      const result = resolveNotarialMetadataPrefill({
        metadata: null,
        configuration,
        availableFields: fields,
        fieldValues: { "authorized.date": "2026-07-15" },
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.authorizedAt.date.value).toBe("2026-07-15");
      expect(result.authorizedAt.time).toMatchObject({ value: "", source: "empty" });
    });

    it("Caso C — derives Hora alone, Fecha stays pending, never invents today's date", () => {
      const result = resolveNotarialMetadataPrefill({
        metadata: null,
        configuration,
        availableFields: fields,
        fieldValues: { "authorized.time": "16:30" },
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.authorizedAt.time.value).toBe("16:30");
      expect(result.authorizedAt.date).toMatchObject({ value: "", source: "empty" });
    });

    it("Caso D — derives neither when nothing is mappable", () => {
      const result = resolveNotarialMetadataPrefill({
        metadata: null,
        configuration: {
          ...configuration,
          simpleFields: {
            ...configuration.simpleFields,
            authorized_date: null,
            authorized_time: null,
          },
        },
        availableFields: fields,
        fieldValues: {},
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.authorizedAt.date).toMatchObject({ value: "", source: "empty" });
      expect(result.authorizedAt.time).toMatchObject({ value: "", source: "empty" });
    });
  });

  // ------------------------------------------------------------ item 3:
  // precedencia manual vs. derivado tras reabrir/corregir la Escritura.
  describe("manual override precedence (reopen re-derivation)", () => {
    it("regression: a saved manual value survives even when the mapped source is currently unreadable", () => {
      // La fuente mapeada nunca se pudo interpretar (ni antes ni ahora), pero
      // el usuario corrigió manualmente el número de instrumento — esa
      // corrección NO debe desaparecer solo porque la fuente sigue siendo
      // ilegible (bug real encontrado en `notarial-template-config-authenticated.spec.ts`,
      // caso F: "ambiguous input requires a manual correction that survives reload").
      const metadata = metadataFixture({
        instrument_number: 324965,
        instrument_number_derived_snapshot: null,
      });
      const result = resolveNotarialMetadataPrefill({
        metadata,
        configuration,
        availableFields: fields,
        fieldValues: { "instrument.number": "siete ocho" }, // sigue sin poder interpretarse
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.instrumentNumber).toMatchObject({
        value: "324965",
        source: "saved",
        compatible: true,
      });
    });

    it("shows the 'needs manual review' state only when nothing was ever saved AND the source is unreadable", () => {
      const result = resolveNotarialMetadataPrefill({
        metadata: null,
        configuration,
        availableFields: fields,
        fieldValues: { "instrument.number": "siete ocho" },
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.instrumentNumber).toMatchObject({
        value: "",
        compatible: false,
        rawValue: "siete ocho",
      });
    });

    it("refreshes an untouched value to the fresh derivation (source changed since last save)", () => {
      const metadata = metadataFixture({
        instrument_number: 7,
        instrument_number_derived_snapshot: 7, // igual al efectivo: nunca se tocó a mano
      });
      const result = resolveNotarialMetadataPrefill({
        metadata,
        configuration,
        availableFields: fields,
        fieldValues: { "instrument.number": "9" },
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.instrumentNumber).toMatchObject({ value: "9", source: "template" });
    });

    it("preserves a manual correction when the source hasn't changed", () => {
      const metadata = metadataFixture({
        protocol_book: "15", // corregido a mano
        protocol_book_derived_snapshot: "9", // lo que ya había cuando se corrigió
      });
      const result = resolveNotarialMetadataPrefill({
        metadata,
        configuration,
        availableFields: fields,
        fieldValues: { "protocol.book": "9" }, // misma fuente, sin cambios
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.protocolBook).toMatchObject({
        value: "15",
        source: "saved",
        sourceChanged: false,
      });
    });

    it("preserves a manual correction AND flags sourceChanged when the source diverged since the correction (Caso D del pedido)", () => {
      const metadata = metadataFixture({
        protocol_book: "15", // corregido a mano
        protocol_book_derived_snapshot: "8", // lo que había cuando se corrigió
      });
      const result = resolveNotarialMetadataPrefill({
        metadata,
        configuration,
        availableFields: fields,
        fieldValues: { "protocol.book": "9" }, // la fuente cambió desde la corrección
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.protocolBook).toMatchObject({
        value: "15",
        source: "saved",
        sourceChanged: true,
      });
    });

    it("treats a pre-migration row (no snapshot ever recorded) as manually set — never silently overwritten", () => {
      const metadata = metadataFixture({
        instrument_number: 7,
        protocol_book: "5",
        initial_folio: "1",
        final_folio: "2",
        act_name_snapshot: "Nombre histórico",
        act_name_override: "Corrección manual",
        generated_parties: "PARTE HISTÓRICA",
        parties_override: "PARTE CORREGIDA",
        // *_derived_snapshot quedan null — fila anterior a la migración.
      });
      const result = resolveNotarialMetadataPrefill({
        metadata,
        configuration,
        availableFields: fields,
        fieldValues: { "instrument.number": "99", "protocol.book": "9" },
        templateName: "Nombre nuevo",
        generatedParties: "PARTE NUEVA",
        suggestions,
      });

      expect(result.instrumentNumber).toMatchObject({ value: "7", source: "saved" });
      expect(result.instrumentNumber.rawValue).toBe("99");
      expect(result.protocolBook).toMatchObject({
        value: "5",
        source: "saved",
        rawValue: "9",
      });
      expect(result.actName).toMatchObject({ value: "Corrección manual", source: "saved" });
      expect(result.parties).toMatchObject({ value: "PARTE CORREGIDA", source: "saved" });
    });

    it("Fecha independently refreshed while Hora manual override is preserved", () => {
      const metadata = metadataFixture({
        authorized_date_derived_snapshot: "2026-07-13",
        authorized_time_derived_snapshot: "10:00",
      });
      // authorized_at combinado: fecha vieja + hora corregida a mano.
      const withCombined: NotarialMetadata = {
        ...metadata,
        authorized_at: costaRicaLocalToIso("2026-07-13T10:30"), // hora CR real
      };
      const result = resolveNotarialMetadataPrefill({
        metadata: withCombined,
        configuration,
        availableFields: fields,
        fieldValues: { "authorized.date": "2026-07-15", "authorized.time": "10:00" },
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      // Fecha: nadie la tocó (guardada == snapshot) -> se refresca a la nueva.
      expect(result.authorizedAt.date).toMatchObject({
        value: "2026-07-15",
        source: "template",
      });
      // Hora: 10:30 guardada != 10:00 snapshot -> corrección manual preservada.
      expect(result.authorizedAt.time).toMatchObject({
        value: "10:30",
        source: "saved",
      });
    });

    it("Option Block variant change updates the derived Hora when untouched", () => {
      const metadata = metadataFixture({
        authorized_time_derived_snapshot: "10:00",
      });
      const withCombined: NotarialMetadata = {
        ...metadata,
        authorized_at: costaRicaLocalToIso("2026-07-15T10:00"),
      };
      const result = resolveNotarialMetadataPrefill({
        metadata: withCombined,
        configuration: {
          ...configuration,
          simpleFields: { ...configuration.simpleFields, authorized_time: null },
          authorizedTimeOptionBlockId: "hora-block",
        },
        availableFields: fields,
        fieldValues: { hora: "10", minutos: "45" },
        templateDocument: timeBlockDocument,
        optionSelections: { "hora-block": "con_minutos" }, // antes era "en_punto" -> 10:00
        templateName: "Compraventa",
        generatedParties: null,
        suggestions,
      });
      expect(result.authorizedAt.time).toMatchObject({
        value: "10:45",
        source: "template",
      });
    });
  });
});
