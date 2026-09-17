import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentSheet } from "./DocumentSheet";
import type { DocumentModel } from "@/lib/editor/render";

describe("DocumentSheet input boundaries", () => {
  it("renders template text, variable values, labels and option labels as escaped text", () => {
    const payload = `<img src=x onerror="globalThis.pwned=1"><script>alert(1)</script>`;
    const model: DocumentModel = [
      {
        kind: "paragraph",
        runs: [
          { kind: "text", text: payload, marks: { bold: false, italic: false, underline: false } },
          {
            kind: "variable",
            nodeId: "variable-1",
            key: "cliente.nombre",
            label: payload,
            resolved: true,
            value: payload,
          },
          {
            kind: "optionBlock",
            blockId: "block-1",
            name: payload,
            selectedVariantId: "variant-1",
            variants: [{ id: "variant-1", label: payload }],
            runs: [{ kind: "text", text: payload, marks: { bold: false, italic: false, underline: false } }],
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(<DocumentSheet model={model} />);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
