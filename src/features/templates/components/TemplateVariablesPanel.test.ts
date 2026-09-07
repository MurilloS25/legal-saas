import { describe, expect, it } from "vitest";
import { buildVariableRows } from "./TemplateVariablesPanel";

const variable = (field_key: string, required = false) => ({
  field_key,
  label: `Etiqueta ${field_key}`,
  required,
  autofill_source: "none" as const,
  output_transform: "none" as const,
});

describe("buildVariableRows", () => {
  it("marks configured-and-used variables as configured", () => {
    const rows = buildVariableRows([variable("a", true)], ["a"]);
    expect(rows).toEqual([
      {
        field_key: "a",
        label: "Etiqueta a",
        required: true,
        status: "configured",
        autofill_source: "none",
        output_transform: "none",
      },
    ]);
  });

  it("marks content variables without configuration as pending", () => {
    const rows = buildVariableRows([], ["a"]);
    expect(rows).toEqual([
      {
        field_key: "a",
        required: false,
        status: "pending",
        autofill_source: "none",
        output_transform: "none",
      },
    ]);
  });

  it("suggests an autofill source for a pending variable from its 'dato' segment", () => {
    const rows = buildVariableRows([], ["comprador.nombre"]);
    expect(rows[0].autofill_source).toBe("client_full_name");
  });

  it("omits a configured variable entirely once its last reference is gone from the content", () => {
    const rows = buildVariableRows([variable("a")], []);
    expect(rows).toEqual([]);
  });

  it("keeps configured order first and appends pending in content order, dropping orphaned configured keys", () => {
    const rows = buildVariableRows(
      [variable("b"), variable("a")],
      ["c", "a", "d"],
    );
    expect(rows.map((row) => `${row.field_key}:${row.status}`)).toEqual([
      "a:configured",
      "c:pending",
      "d:pending",
    ]);
  });

  it("never duplicates a key present in both sources", () => {
    const rows = buildVariableRows([variable("a")], ["a", "a"]);
    expect(rows).toHaveLength(1);
  });
});
