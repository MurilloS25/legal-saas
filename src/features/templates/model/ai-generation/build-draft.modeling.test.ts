/**
 * Regresiones del modelado de Machotes con IA (pruebas reales con un
 * abogado). Cada caso fija un comportamiento que el prompt puede seguir
 * refinando sin romper: la reconstrucción determinista de LexCR es la que
 * garantiza el resultado, no el modelo.
 */

import { describe, expect, it } from "vitest";
import type {
  TemplateDocument,
  TemplateOptionBlockAttrs,
  TemplateVariantContentNode,
} from "@/lib/editor/types";
import { buildTemplateDraftFromProposal, type AiTemplateDraft } from "./build-draft";
import type { AiProposalVariable, AiTemplateProposal } from "./proposal";
import { validateProposalSemantics } from "./semantic-validation";
import { fakeProposal } from "./test-proposal";

function sequentialIds() {
  let n = 0;
  return () => `id-${++n}`;
}

function build(
  sourceText: string,
  proposal: AiTemplateProposal,
  instructions: string | null = null,
): AiTemplateDraft {
  const result = buildTemplateDraftFromProposal({
    sourceText,
    proposal,
    instructions,
    generateId: sequentialIds(),
  });
  if (!result.ok) throw new Error(`expected a draft, got ${result.code}`);
  return result.draft;
}

function variable(
  key: string,
  semantic: AiProposalVariable["semantic_type"],
  occurrences: AiProposalVariable["occurrences"],
  transform: AiProposalVariable["output_transform"] = "none",
): AiProposalVariable {
  return {
    key,
    label: key,
    semantic_type: semantic,
    output_transform: transform,
    needs_review: false,
    occurrences,
  };
}

function proposalWith(overrides: Partial<AiTemplateProposal>): AiTemplateProposal {
  return fakeProposal({
    variables: [],
    option_blocks: [],
    vehicle_identifiers: null,
    identification_types: [],
    notarial_index: {
      instrument_number_key: null,
      authorized_date_key: null,
      authorized_time_key: null,
      authorized_time_option_block: null,
      protocol_book_key: null,
      initial_folio_key: null,
      party_keys: [],
    },
    warnings: [],
    ...overrides,
  });
}

function blocksOf(document: TemplateDocument): TemplateOptionBlockAttrs[] {
  return document.content.flatMap((paragraph) =>
    (paragraph.content ?? []).flatMap((node) => (node.type === "optionBlock" ? [node.attrs] : [])),
  );
}

function keysIn(content: TemplateVariantContentNode[]): string[] {
  return content.flatMap((node) => (node.type === "templateVariable" ? [node.attrs.key] : []));
}

function textOf(content: TemplateVariantContentNode[]): string {
  return content
    .map((node) => (node.type === "text" ? node.text : node.type === "templateVariable" ? `{{${node.attrs.key}}}` : "\n"))
    .join("");
}

function paragraphText(document: TemplateDocument, index: number): string {
  return (document.content[index].content ?? [])
    .map((node) =>
      node.type === "text"
        ? node.text
        : node.type === "templateVariable"
          ? `{{${node.attrs.key}}}`
          : node.type === "optionBlock"
            ? `[[${node.attrs.name}]]`
            : "\n",
    )
    .join("");
}

// ------------------------------------------------------------------ A

describe("A. Garantía opcional (nota del abogado)", () => {
  const source = [
    "Comparece TEST PERSONA UNO, mayor, soltero, comerciante, como vendedor.",
    "GARANTIA: El vendedor otorga garantia sobre el motor por un plazo de seis meses a partir de la entrega.",
  ].join("\n");
  const clause = source.split("\n")[1];
  const proposal = proposalWith({
    variables: [
      variable("vendedor.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }]),
      variable("garantia.plazo", "quantity", [{ paragraph: 2, text: "seis", occurrence: 1 }], "number_to_words"),
    ],
    option_blocks: [
      {
        name: "Garantía",
        basis: "user_instruction",
        paragraph: 2,
        text: clause,
        occurrence: 1,
        original_variant_label: "Con garantía",
        alternative_variants: [{ label: "Sin garantía", content: "" }],
        time_output: null,
      },
    ],
  });
  const notes = "Puede utilizarse con garantía o sin garantía.";

  it("builds an Option Block with the full clause and an EMPTY 'Sin garantía' variant", () => {
    const draft = build(source, proposal, notes);
    const [block] = blocksOf(draft.document);
    expect(block.name).toBe("Garantía");
    expect(block.variants.map((variant) => variant.label)).toEqual(["Con garantía", "Sin garantía"]);
    expect(block.variants[1].content).toEqual([]);
    expect(block.defaultVariantId).toBe(block.variants[0].id);
  });

  it("keeps {{garantia.plazo}} as a variable INSIDE the 'Con garantía' variant", () => {
    const [block] = blocksOf(build(source, proposal, notes).document);
    expect(keysIn(block.variants[0].content)).toEqual(["garantia.plazo"]);
    expect(textOf(block.variants[0].content)).toBe(
      "GARANTIA: El vendedor otorga garantia sobre el motor por un plazo de {{garantia.plazo}} meses a partir de la entrega.",
    );
  });

  it("never represents 'sin garantía' as a zero term or filler text", () => {
    const draft = build(source, proposal, notes);
    const serialized = JSON.stringify(draft.document);
    expect(serialized).not.toMatch(/"text":"0"|cero meses|no aplica/i);
    expect(draft.variables.find((v) => v.field_key === "garantia.plazo")).toBeDefined();
  });

  it("without the lawyer's note a user_instruction block is not created (no hypothetical options)", () => {
    expect(blocksOf(build(source, proposal, null).document)).toHaveLength(0);
  });
});

// ------------------------------------------------------------------ B

describe("B. Nacionalidad de las Partes siempre variable", () => {
  it("turns a literal nationality after a party name into rol.nacionalidad with the Client autofill source", () => {
    const source = "Comparece TEST PERSONA UNO, mayor, casado, costarricense, abogado, en calidad de fiador.";
    const draft = build(
      source,
      proposalWith({
        variables: [variable("fiador.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }])],
      }),
    );
    expect(paragraphText(draft.document, 0)).toBe(
      "Comparece {{fiador.nombre}}, mayor, casado, {{fiador.nacionalidad}}, abogado, en calidad de fiador.",
    );
    expect(draft.variables.find((v) => v.field_key === "fiador.nacionalidad")).toMatchObject({
      autofill_source: "client_nationality",
      output_transform: "none",
      required: false,
    });
    expect(draft.warnings).toContain("nationality_completed");
  });

  it("assigns each nationality to the closest preceding party (any role, accents included)", () => {
    const source = "Comparecen TEST PERSONA UNO, costarricense, y TEST PERSONA DOS, nicaragüense, como acreedor y deudor.";
    const draft = build(
      source,
      proposalWith({
        variables: [
          variable("acreedor.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }]),
          variable("deudor.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA DOS", occurrence: 1 }]),
        ],
      }),
    );
    expect(paragraphText(draft.document, 0)).toBe(
      "Comparecen {{acreedor.nombre}}, {{acreedor.nacionalidad}}, y {{deudor.nombre}}, {{deudor.nacionalidad}}, como acreedor y deudor.",
    );
  });

  it("keeps the model's own nationality variable and does not duplicate it", () => {
    const source = "Comparece TEST PERSONA UNO, costarricense, como vendedor.";
    const draft = build(
      source,
      proposalWith({
        variables: [
          variable("vendedor.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }]),
          variable("vendedor.nacionalidad", "nationality", [{ paragraph: 1, text: "costarricense", occurrence: 1 }]),
        ],
      }),
    );
    expect(draft.variables.filter((v) => v.field_key.endsWith("nacionalidad"))).toHaveLength(1);
    expect(draft.warnings).not.toContain("nationality_completed");
  });

  it("does not touch a country name or a nationality with no preceding party", () => {
    const source = "El vehículo fue importado de Uruguay. Producto costarricense. Firma TEST PERSONA UNO.";
    const draft = build(
      source,
      proposalWith({
        variables: [variable("vendedor.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }])],
      }),
    );
    expect(draft.variables.map((v) => v.field_key)).toEqual(["vendedor.nombre"]);
  });
});

// ------------------------------------------------------------------ C

describe("C. Datos del abogado/notario permanecen fijos", () => {
  const source =
    "Ante mí, LIC. TEST NOTARIO, notario público con oficina en San José, carné 12345, comparece TEST PERSONA UNO.";
  const proposal = proposalWith({
    variables: [
      variable("notario.nombre", "person_name", [{ paragraph: 1, text: "LIC. TEST NOTARIO", occurrence: 1 }]),
      variable("notario.carne", "identification", [{ paragraph: 1, text: "12345", occurrence: 1 }]),
      variable("comprador.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }]),
    ],
  });

  it("keeps the professional's own data as literal text by default", () => {
    const draft = build(source, proposal);
    expect(paragraphText(draft.document, 0)).toBe(
      "Ante mí, LIC. TEST NOTARIO, notario público con oficina en San José, carné 12345, comparece {{comprador.nombre}}.",
    );
    expect(draft.variables.map((v) => v.field_key)).toEqual(["comprador.nombre"]);
    expect(draft.warnings).toContain("professional_data_kept_fixed");
  });

  it("parametrizes them only when the lawyer's notes ask for it explicitly", () => {
    const draft = build(source, proposal, "El notario autorizante puede cambiar entre escrituras.");
    expect(draft.variables.map((v) => v.field_key)).toEqual([
      "notario.nombre",
      "notario.carne",
      "comprador.nombre",
    ]);
  });
});

// ------------------------------------------------------------------ D

describe("D. Toda variable generada con IA es opcional", () => {
  it("forces required=false, including the Chasis/VIN/Serie variables LexCR declares itself", () => {
    const source = [
      "Comparece TEST PERSONA UNO, como comprador.",
      "El vehiculo con chasis y VIN ABC123 y serie ABC123.",
    ].join("\n");
    const draft = build(
      source,
      proposalWith({
        variables: [
          variable("comprador.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }]),
          variable("vehiculo.vin", "vehicle_identifier", [{ paragraph: 2, text: "ABC123", occurrence: 1 }], "digits_to_words"),
        ],
        vehicle_identifiers: {
          paragraph: 2,
          text: "chasis y VIN ABC123 y serie ABC123",
          occurrence: 1,
          original_case: "all_equal",
          chassis_key: "vehiculo.chasis",
          vin_key: "vehiculo.vin",
          serial_key: "vehiculo.serie",
        },
      }),
    );
    expect(draft.variables.length).toBeGreaterThan(2);
    expect(draft.variables.every((v) => v.required === false)).toBe(true);
  });
});

// ------------------------------------------------------------------ E

describe("E. Hora y minutos coherentes con el Índice", () => {
  const source = "Otorgada en San Jose, a las diez horas con treinta minutos del veinticinco de julio de dos mil veintiseis.";
  const vars = [
    variable("hora", "time_hour", [{ paragraph: 1, text: "diez", occurrence: 1 }], "number_to_words"),
    variable("minutos", "time_minutes", [{ paragraph: 1, text: "treinta", occurrence: 1 }], "number_to_words"),
    variable(
      "fecha_otorgamiento",
      "date",
      [{ paragraph: 1, text: "veinticinco de julio de dos mil veintiseis", occurrence: 1 }],
      "number_to_words",
    ),
  ];
  const timeBlock = (overrides: Partial<AiTemplateProposal["option_blocks"][number]> = {}) => ({
    name: "Hora",
    basis: "known_pattern_time_minutes" as const,
    paragraph: 1,
    text: "a las diez horas con treinta minutos",
    occurrence: 1,
    original_variant_label: "Con minutos",
    alternative_variants: [{ label: "En punto", content: "a las {{hora}} horas" }],
    time_output: {
      original: { hour_key: "hora", minute_key: "minutos" },
      alternatives: [{ hour_key: "hora", minute_key: null }],
    },
    ...overrides,
  });
  const index = (overrides: Partial<AiTemplateProposal["notarial_index"]>) => ({
    ...proposalWith({}).notarial_index,
    authorized_date_key: "fecha_otorgamiento",
    ...overrides,
  });

  it("a coherent block maps hour + minutes and the Índice offers exactly hora and minutos, never the date", () => {
    const proposal = proposalWith({
      variables: vars,
      option_blocks: [timeBlock()],
      notarial_index: index({ authorized_time_option_block: 0 }),
    });
    expect(validateProposalSemantics(proposal, source.split("\n"))).toEqual([]);
    const draft = build(source, proposal);
    const [block] = blocksOf(draft.document);
    expect(keysIn(block.variants[0].content)).toEqual(["hora", "minutos"]);
    expect(keysIn(block.variants[1].content)).toEqual(["hora"]);
    expect(block.structuredOutput?.variants.map((v) => [v.hourFieldKey, v.minuteFieldKey])).toEqual([
      ["hora", "minutos"],
      ["hora", null],
    ]);
    expect(draft.indexPlan.authorizedTimeOptionBlockId).toBe(block.blockId);
    expect(draft.indexPlan.simpleFieldKeys.authorized_date).toBe("fecha_otorgamiento");
  });

  it("the regression case — a block whose 'hour' is the date — is flagged for repair and never saved", () => {
    const broken = proposalWith({
      variables: vars,
      option_blocks: [
        timeBlock({
          // El fragmento corta la hora y abarca la fecha.
          text: "treinta minutos del veinticinco de julio de dos mil veintiseis",
          time_output: {
            original: { hour_key: "fecha_otorgamiento", minute_key: "minutos" },
            alternatives: [{ hour_key: "fecha_otorgamiento", minute_key: null }],
          },
          alternative_variants: [{ label: "En punto", content: "del {{fecha_otorgamiento}}" }],
        }),
      ],
      notarial_index: index({ authorized_time_option_block: 0 }),
    });
    expect(validateProposalSemantics(broken, source.split("\n"))).toContainEqual({
      code: "time_block_incoherent",
      path: "option_blocks[0]",
      severity: "repair",
    });
    const draft = build(source, broken);
    expect(blocksOf(draft.document)).toHaveLength(0);
    expect(draft.indexPlan.authorizedTimeOptionBlockId).toBeNull();
    expect(draft.warnings).toContain("time_block_discarded");
    // Las variables siguen en el texto como variables normales.
    expect(draft.variables.map((v) => v.field_key)).toEqual(
      expect.arrayContaining(["hora", "minutos", "fecha_otorgamiento"]),
    );
  });

  it("a date proposed as the Índice time never steals the date mapping", () => {
    const draft = build(
      source,
      proposalWith({ variables: vars, notarial_index: index({ authorized_time_key: "fecha_otorgamiento" }) }),
    );
    expect(draft.indexPlan.simpleFieldKeys).toMatchObject({
      authorized_date: "fecha_otorgamiento",
      authorized_time: null,
    });
  });

  it("flags an Índice time that points to the date", () => {
    const proposal = proposalWith({
      variables: vars,
      notarial_index: index({ authorized_time_key: "fecha_otorgamiento" }),
    });
    expect(validateProposalSemantics(proposal, source.split("\n"))).toContainEqual({
      code: "index_time_is_date",
      path: "notarial_index.authorized_time_key",
      severity: "repair",
    });
  });
});

// ------------------------------------------------------------------ F

describe("F. Documento de identificación: Cédula / DIMEX / Pasaporte (patrón canónico)", () => {
  const source = "Comparece TEST PERSONA UNO, portador de la cédula de identidad número 1-0234-0567, como comprador.";
  const buyerVariables = [
    variable("comprador.nombre", "person_name", [{ paragraph: 1, text: "TEST PERSONA UNO", occurrence: 1 }]),
    variable(
      "comprador.identificacion",
      "identification",
      [{ paragraph: 1, text: "1-0234-0567", occurrence: 1 }],
      "digits_to_words",
    ),
  ];
  const expectedTexts = (key: string) => [
    `cédula de identidad número {{${key}}}`,
    `DIMEX número {{${key}}}`,
    `pasaporte número {{${key}}}`,
  ];

  it("a document with ONLY 'cédula de identidad' and empty notes ends up with the three variants (same variable)", () => {
    // El modelo ni siquiera propuso `identification_types`: la detección
    // determinista de LexCR prepara el Machote igual.
    const draft = build(source, proposalWith({ variables: buyerVariables }), null);
    const [block] = blocksOf(draft.document);
    expect(block.name).toBe("Tipo de identificación");
    expect(block.variants.map((variant) => variant.label)).toEqual([
      "Cédula (según el documento)",
      "DIMEX",
      "Pasaporte",
    ]);
    expect(block.variants.map((variant) => textOf(variant.content))).toEqual(
      expectedTexts("comprador.identificacion"),
    );
    expect(paragraphText(draft.document, 0)).toBe(
      "Comparece {{comprador.nombre}}, portador de la [[Tipo de identificación]], como comprador.",
    );
  });

  it("the model's own proposal and LexCR's detection produce a single block", () => {
    const draft = build(
      source,
      proposalWith({
        variables: buyerVariables,
        identification_types: [
          {
            paragraph: 1,
            text: "cédula de identidad número 1-0234-0567",
            occurrence: 1,
            identification_key: "comprador.identificacion",
            original_type: "cedula",
          },
        ],
      }),
    );
    expect(blocksOf(draft.document)).toHaveLength(1);
  });

  it("works for any role, adapting only the document name (no added legal content)", () => {
    const multi = [
      "Comparece TEST PERSONA UNO, cédula número 1-0234-0567, como otorgante,",
      "y TEST PERSONA DOS, pasaporte número A1234567, como apoderada del acreedor.",
    ].join("\n");
    const draft = build(
      multi,
      proposalWith({
        variables: [
          variable("otorgante.cedula", "identification", [{ paragraph: 1, text: "1-0234-0567", occurrence: 1 }]),
          variable("apoderado.identificacion", "identification", [{ paragraph: 2, text: "A1234567", occurrence: 1 }]),
        ],
      }),
    );
    const blocks = blocksOf(draft.document);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].variants.map((variant) => textOf(variant.content))).toEqual([
      "cédula número {{otorgante.cedula}}",
      "DIMEX número {{otorgante.cedula}}",
      "pasaporte número {{otorgante.cedula}}",
    ]);
    expect(blocks[1].variants.map((variant) => variant.label)).toEqual([
      "Pasaporte (según el documento)",
      "Cédula",
      "DIMEX",
    ]);
    expect(blocks[1].variants.map((variant) => textOf(variant.content))).toEqual([
      "pasaporte número {{apoderado.identificacion}}",
      "cédula de identidad número {{apoderado.identificacion}}",
      "DIMEX número {{apoderado.identificacion}}",
    ]);
    const serialized = JSON.stringify(blocks);
    expect(serialized).not.toMatch(/residencia|vigente|migratori|permiso/i);
  });

  it("the lawyer's notes can switch it off explicitly", () => {
    for (const notes of [
      "Solo cédula de identidad.",
      "Sin DIMEX ni pasaporte.",
      "No agregues opciones de tipo de identificación.",
    ]) {
      expect(blocksOf(build(source, proposalWith({ variables: buyerVariables }), notes).document)).toHaveLength(0);
    }
  });

  it("notes that merely mention another topic do not switch it off", () => {
    const draft = build(
      source,
      proposalWith({ variables: buyerVariables }),
      "El comprador no es costarricense; la venta puede ser con o sin garantía.",
    );
    expect(blocksOf(draft.document)).toHaveLength(1);
  });

  it("never applies to a legal entity: cédula jurídica, a legal-entity role or a 3-XXX-XXXXXX number", () => {
    const company =
      "Comparece INVERSIONES TEST S.A., cédula jurídica número 3-101-123456, representada por TEST PERSONA UNO.";
    const draft = build(
      company,
      proposalWith({
        variables: [
          variable("vendedor.nombre", "person_name", [{ paragraph: 1, text: "INVERSIONES TEST S.A.", occurrence: 1 }]),
          variable("vendedor.identificacion", "identification", [{ paragraph: 1, text: "3-101-123456", occurrence: 1 }]),
        ],
        identification_types: [
          {
            paragraph: 1,
            text: "cédula jurídica número 3-101-123456",
            occurrence: 1,
            identification_key: "vendedor.identificacion",
            original_type: "cedula",
          },
        ],
      }),
    );
    expect(blocksOf(draft.document)).toHaveLength(0);
    expect(paragraphText(draft.document, 0)).toContain("cédula jurídica número {{vendedor.identificacion}}");

    const byRole = build(
      "Comparece la sociedad, cédula número 3101123456.",
      proposalWith({
        variables: [variable("sociedad.cedula", "identification", [{ paragraph: 1, text: "3101123456", occurrence: 1 }])],
      }),
    );
    expect(blocksOf(byRole.document)).toHaveLength(0);
  });
});
