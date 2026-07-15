import { describe, expect, it } from "vitest";
import { buildVariableRows } from "./TemplateVariablesPanel";

const variable = (field_key: string, required = false) => ({
  field_key,
  label: `Etiqueta ${field_key}`,
  required,
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
      },
    ]);
  });

  it("marks content variables without configuration as pending", () => {
    const rows = buildVariableRows([], ["a"]);
    expect(rows).toEqual([
      { field_key: "a", required: false, status: "pending" },
    ]);
  });

  it("marks configured variables missing from the content as unused", () => {
    const rows = buildVariableRows([variable("a")], []);
    expect(rows[0].status).toBe("unused");
  });

  it("keeps configured order first and appends pending in content order", () => {
    const rows = buildVariableRows(
      [variable("b"), variable("a")],
      ["c", "a", "d"],
    );
    expect(rows.map((row) => `${row.field_key}:${row.status}`)).toEqual([
      "b:unused",
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
