import { describe, expect, it } from "vitest";
import {
  attrsToDraft,
  buildOptionBlockAttrs,
  extractOptionBlockSummaries,
  generateOptionId,
  parseVariantContentText,
  serializeVariantContentToText,
  type OptionBlockDraft,
} from "./option-blocks";
import { TEMPLATE_DOC_LIMITS } from "./types";
import type { TemplateDocument, TemplateOptionBlockAttrs } from "./types";

describe("parseVariantContentText", () => {
  it("parses text with a single variable placeholder", () => {
    expect(parseVariantContentText("Chasis número {{vehiculo.chasis}}")).toEqual([
      { type: "text", text: "Chasis número " },
      { type: "templateVariable", attrs: { key: "vehiculo.chasis" } },
    ]);
  });

  it("parses the Chasis/VIN/Serie 'todos distintos' example verbatim", () => {
    const content = parseVariantContentText(
      "CHASIS número {{vehiculo.chasis}}, VIN número {{vehiculo.vin}} y SERIE número {{vehiculo.serie}}",
    );
    expect(content).toEqual([
      { type: "text", text: "CHASIS número " },
      { type: "templateVariable", attrs: { key: "vehiculo.chasis" } },
      { type: "text", text: ", VIN número " },
      { type: "templateVariable", attrs: { key: "vehiculo.vin" } },
      { type: "text", text: " y SERIE número " },
      { type: "templateVariable", attrs: { key: "vehiculo.serie" } },
    ]);
  });

  it("returns plain text when there are no placeholders", () => {
    expect(parseVariantContentText("Todos iguales")).toEqual([
      { type: "text", text: "Todos iguales" },
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseVariantContentText("   ")).toEqual([]);
  });

  it("collapses embedded newlines into a single line", () => {
    expect(parseVariantContentText("Línea uno\nLínea dos")).toEqual([
      { type: "text", text: "Línea uno Línea dos" },
    ]);
  });

  it("leaves an invalid placeholder as literal text", () => {
    expect(parseVariantContentText("Valor {{Clave Mala}} fin")).toEqual([
      { type: "text", text: "Valor {{Clave Mala}} fin" },
    ]);
  });
});

describe("serializeVariantContentToText", () => {
  it("round-trips through parseVariantContentText", () => {
    const original = "CHASIS número {{vehiculo.chasis}}, VIN número {{vehiculo.vin}}";
    const content = parseVariantContentText(original);
    expect(serializeVariantContentToText(content)).toBe(original);
  });
});

describe("generateOptionId", () => {
  it("generates distinct ids", () => {
    const a = generateOptionId();
    const b = generateOptionId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

function draft(overrides: Partial<OptionBlockDraft> = {}): OptionBlockDraft {
  return {
    blockId: "block-1",
    name: "Chasis, VIN y Serie",
    variants: [
      { id: "v1", label: "Todos iguales", contentText: "Todos iguales" },
      {
        id: "v2",
        label: "Todos distintos",
        contentText:
          "CHASIS número {{vehiculo.chasis}}, VIN número {{vehiculo.vin}} y SERIE número {{vehiculo.serie}}",
      },
    ],
    defaultVariantId: "v2",
    ...overrides,
  };
}

describe("buildOptionBlockAttrs", () => {
  it("builds valid attrs from a valid draft", () => {
    const result = buildOptionBlockAttrs(draft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attrs.name).toBe("Chasis, VIN y Serie");
    expect(result.attrs.variants).toHaveLength(2);
    expect(result.attrs.defaultVariantId).toBe("v2");
  });

  it("builds all five Chasis/VIN/Serie variants from the spec", () => {
    const block = draft({
      variants: [
        { id: "v1", label: "Todos iguales", contentText: "Todos iguales, número {{vehiculo.numero}}" },
        {
          id: "v2",
          label: "Todos distintos",
          contentText:
            "CHASIS número {{vehiculo.chasis}}, VIN número {{vehiculo.vin}} y SERIE número {{vehiculo.serie}}",
        },
        {
          id: "v3",
          label: "Chasis y VIN iguales; Serie distinta",
          contentText:
            "CHASIS y VIN número {{vehiculo.chasis_vin}}, SERIE número {{vehiculo.serie}}",
        },
        {
          id: "v4",
          label: "Chasis y Serie iguales; VIN distinto",
          contentText:
            "CHASIS y SERIE número {{vehiculo.chasis_serie}}, VIN número {{vehiculo.vin}}",
        },
        {
          id: "v5",
          label: "VIN y Serie iguales; Chasis distinto",
          contentText:
            "VIN y SERIE número {{vehiculo.vin_serie}}, CHASIS número {{vehiculo.chasis}}",
        },
      ],
      defaultVariantId: "v2",
    });
    const result = buildOptionBlockAttrs(block);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attrs.variants).toHaveLength(5);
  });

  // El diálogo ya no edita `structuredOutput` (ver `OptionBlockDialog.tsx` —
  // se configura desde el Índice Notarial, `OptionBlockTimeMappingEditor`):
  // `buildOptionBlockAttrs` solo lo recibe como pass-through y lo poda
  // contra las variantes resultantes.
  describe("structuredOutput pass-through", () => {
    const hourVariants: OptionBlockDraft["variants"] = [
      { id: "en_punto", label: "Hora en punto", contentText: "{{hora.valor}} horas" },
      {
        id: "con_minutos",
        label: "Hora con minutos",
        contentText: "{{hora.valor}} con {{hora.minutos}}",
      },
    ];
    const existing: TemplateOptionBlockAttrs["structuredOutput"] = {
      type: "time",
      variants: [
        { variantId: "en_punto", hourFieldKey: "hora.valor", minuteFieldKey: null },
        {
          variantId: "con_minutos",
          hourFieldKey: "hora.valor",
          minuteFieldKey: "hora.minutos",
        },
      ],
    };

    it("keeps the existing mapping unchanged when every reference still exists", () => {
      const result = buildOptionBlockAttrs(
        draft({ name: "Hora", variants: hourVariants, defaultVariantId: "en_punto" }),
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.attrs.structuredOutput).toEqual(existing);
    });

    it("drops the mapping entry for a variant that no longer exists", () => {
      const result = buildOptionBlockAttrs(
        draft({
          name: "Hora",
          variants: [hourVariants[0]],
          defaultVariantId: "en_punto",
        }),
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.attrs.structuredOutput).toEqual({
          type: "time",
          variants: [
            { variantId: "en_punto", hourFieldKey: "hora.valor", minuteFieldKey: null },
          ],
        });
      }
    });

    it("drops the whole entry when its hour variable no longer exists in the (edited) variant content", () => {
      const result = buildOptionBlockAttrs(
        draft({
          name: "Hora",
          variants: [
            { id: "en_punto", label: "Hora en punto", contentText: "sin variable" },
            hourVariants[1],
          ],
          defaultVariantId: "en_punto",
        }),
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.attrs.structuredOutput).toEqual({
          type: "time",
          variants: [
            {
              variantId: "con_minutos",
              hourFieldKey: "hora.valor",
              minuteFieldKey: "hora.minutos",
            },
          ],
        });
      }
    });

    it("falls back the minute mapping to fixed 00 when only the minute variable no longer exists", () => {
      const result = buildOptionBlockAttrs(
        draft({
          name: "Hora",
          variants: [
            hourVariants[0],
            { id: "con_minutos", label: "Hora con minutos", contentText: "{{hora.valor}}" },
          ],
          defaultVariantId: "en_punto",
        }),
        existing,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.attrs.structuredOutput).toEqual({
          type: "time",
          variants: [
            { variantId: "en_punto", hourFieldKey: "hora.valor", minuteFieldKey: null },
            { variantId: "con_minutos", hourFieldKey: "hora.valor", minuteFieldKey: null },
          ],
        });
      }
    });

    it("is null when there is no existing mapping to pass through", () => {
      const result = buildOptionBlockAttrs(draft());
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.attrs.structuredOutput).toBeNull();
    });
  });

  it("rejects an empty block name", () => {
    expect(buildOptionBlockAttrs(draft({ name: "  " })).ok).toBe(false);
  });

  it("rejects a draft with zero variants", () => {
    expect(buildOptionBlockAttrs(draft({ variants: [] })).ok).toBe(false);
  });

  it("rejects a draft over the variant limit", () => {
    const many = Array.from(
      { length: TEMPLATE_DOC_LIMITS.maxOptionVariantsPerBlock + 1 },
      (_, i) => ({ id: `v${i}`, label: `Variante ${i}`, contentText: "x" }),
    );
    expect(
      buildOptionBlockAttrs(draft({ variants: many, defaultVariantId: "v0" })).ok,
    ).toBe(false);
  });

  it("rejects a variant with an empty label", () => {
    const bad = draft({
      variants: [{ id: "v1", label: "  ", contentText: "x" }],
      defaultVariantId: "v1",
    });
    expect(buildOptionBlockAttrs(bad).ok).toBe(false);
  });

  it("accepts an intentionally empty variant (the clause does not exist, e.g. 'Sin garantía')", () => {
    const result = buildOptionBlockAttrs(
      draft({
        name: "Garantía",
        variants: [
          { id: "v1", label: "Con garantía", contentText: "con garantía de {{garantia.plazo}} meses" },
          { id: "v2", label: "Sin garantía", contentText: "   " },
        ],
        defaultVariantId: "v1",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attrs.variants[1].content).toEqual([]);
  });

  it("rejects a block whose variants are all empty", () => {
    const bad = draft({
      variants: [{ id: "v1", label: "Vacía", contentText: "   " }],
      defaultVariantId: "v1",
    });
    expect(buildOptionBlockAttrs(bad).ok).toBe(false);
  });

  it("rejects a defaultVariantId that does not match any variant", () => {
    expect(
      buildOptionBlockAttrs(draft({ defaultVariantId: "no-existe" })).ok,
    ).toBe(false);
  });
});

describe("attrsToDraft", () => {
  it("round-trips a built block back to an editable draft", () => {
    const built = buildOptionBlockAttrs(draft());
    if (!built.ok) throw new Error("expected ok");
    const roundTripped = attrsToDraft(built.attrs);
    expect(roundTripped.name).toBe("Chasis, VIN y Serie");
    expect(roundTripped.defaultVariantId).toBe("v2");
    expect(roundTripped.variants[1].contentText).toBe(
      "CHASIS número {{vehiculo.chasis}}, VIN número {{vehiculo.vin}} y SERIE número {{vehiculo.serie}}",
    );
  });
});

describe("extractOptionBlockSummaries", () => {
  function documentWithBlock(
    attrs: TemplateOptionBlockAttrs,
  ): TemplateDocument {
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "optionBlock", attrs }] }],
    };
  }

  it("returns every option block, including ones without a structuredOutput mapping", () => {
    const built = buildOptionBlockAttrs(draft());
    if (!built.ok) throw new Error("expected ok");
    const summaries = extractOptionBlockSummaries(documentWithBlock(built.attrs));
    expect(summaries).toHaveLength(1);
    expect(summaries[0].blockId).toBe(built.attrs.blockId);
    expect(summaries[0].structuredOutput).toBeNull();
  });

  it("lists each variant's variable keys, for the Índice's Hora/Minutos selects", () => {
    const built = buildOptionBlockAttrs(
      draft({
        name: "Hora",
        variants: [
          {
            id: "en_punto",
            label: "Hora en punto",
            contentText: "{{hora.valor}} horas",
          },
          {
            id: "con_minutos",
            label: "Hora con minutos",
            contentText: "{{hora.valor}} con {{hora.minutos}}",
          },
        ],
        defaultVariantId: "en_punto",
      }),
    );
    if (!built.ok) throw new Error("expected ok");
    const [summary] = extractOptionBlockSummaries(documentWithBlock(built.attrs));
    expect(summary.variants).toEqual([
      { id: "en_punto", label: "Hora en punto", variableKeys: ["hora.valor"] },
      {
        id: "con_minutos",
        label: "Hora con minutos",
        variableKeys: ["hora.valor", "hora.minutos"],
      },
    ]);
  });

  it("surfaces the current structuredOutput mapping when one is set", () => {
    const existing: TemplateOptionBlockAttrs["structuredOutput"] = {
      type: "time",
      variants: [
        { variantId: "v2", hourFieldKey: "vehiculo.chasis", minuteFieldKey: null },
      ],
    };
    const built = buildOptionBlockAttrs(draft(), existing);
    if (!built.ok) throw new Error("expected ok");
    const [summary] = extractOptionBlockSummaries(documentWithBlock(built.attrs));
    expect(summary.structuredOutput).toEqual(existing);
  });
});
