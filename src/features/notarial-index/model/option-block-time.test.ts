import { describe, expect, it } from "vitest";
import type { TemplateDocument } from "@/lib/editor/types";
import { resolveOptionBlockTime } from "./option-block-time";

const document: TemplateDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "optionBlock",
          attrs: {
            blockId: "hora",
            name: "Hora",
            defaultVariantId: "en_punto",
            variants: [
              {
                id: "en_punto",
                label: "Hora en punto",
                content: [
                  { type: "templateVariable", attrs: { key: "hora" } },
                  { type: "text", text: " horas" },
                ],
              },
              {
                id: "con_minutos",
                label: "Hora y minutos",
                content: [
                  { type: "templateVariable", attrs: { key: "hora" } },
                  { type: "text", text: " horas con " },
                  { type: "templateVariable", attrs: { key: "minutos" } },
                  { type: "text", text: " minutos" },
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

describe("resolveOptionBlockTime", () => {
  it.each([
    ["en_punto", { hora: "10" }, "10:00"],
    ["en_punto", { hora: "diez" }, "10:00"],
    ["con_minutos", { hora: "10", minutos: "20" }, "10:20"],
    ["con_minutos", { hora: "diez", minutos: "veinte" }, "10:20"],
  ])("resolves %s deterministically", (variantId, values, expected) => {
    expect(
      resolveOptionBlockTime(document, "hora", { hora: variantId }, values),
    ).toMatchObject({
      ok: true,
      value: expected,
      blockName: "Hora",
    });
  });

  it.each([
    ["en_punto", { hora: "25" }],
    ["con_minutos", { hora: "10", minutos: "90" }],
    ["en_punto", { hora: "siete ocho" }],
  ])("rejects invalid components for %s", (variantId, values) => {
    expect(
      resolveOptionBlockTime(document, "hora", { hora: variantId }, values),
    ).toMatchObject({ ok: false });
  });
});
