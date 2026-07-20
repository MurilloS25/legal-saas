import { describe, expect, it } from "vitest";
import {
  fieldsToOverwrite,
  groupVariablesByRole,
  mapClientToRoleVariables,
} from "./role-autofill";
import type { FillableTemplateField } from "@/features/templates";

function field(
  field_key: string,
  overrides: Partial<FillableTemplateField> = {},
): FillableTemplateField {
  return {
    field_key,
    label: field_key,
    required: false,
    field_type: "text",
    derived: false,
    autofill_source: "none",
    output_transform: "none",
    ...overrides,
  };
}

describe("groupVariablesByRole", () => {
  it("groups variables that follow the rol.dato convention", () => {
    const groups = groupVariablesByRole([
      field("comprador.nombre"),
      field("comprador.cedula"),
      field("vendedor.nombre"),
    ]);
    expect(groups.map((g) => g.role)).toEqual(["comprador", "vendedor"]);
    expect(groups[0].variables.map((v) => v.field_key)).toEqual([
      "comprador.nombre",
      "comprador.cedula",
    ]);
  });

  it("does not group a variable without a dot", () => {
    const groups = groupVariablesByRole([field("precio"), field("comprador.nombre")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe("comprador");
  });

  it("does not group a key with a leading dot", () => {
    const groups = groupVariablesByRole([field(".nombre")]);
    expect(groups).toHaveLength(0);
  });

  it("marks hasClientAutofill only when at least one variable has a configured source", () => {
    const withAutofill = groupVariablesByRole([
      field("comprador.nombre", { autofill_source: "client_full_name" }),
      field("comprador.vin"),
    ]);
    expect(withAutofill[0].hasClientAutofill).toBe(true);

    const withoutAutofill = groupVariablesByRole([
      field("vehiculo.vin"),
      field("vehiculo.placa"),
    ]);
    expect(withoutAutofill[0].hasClientAutofill).toBe(false);
  });

  it("preserves the original field order across roles", () => {
    const groups = groupVariablesByRole([
      field("vendedor.nombre"),
      field("comprador.nombre"),
      field("vendedor.cedula"),
    ]);
    expect(groups.map((g) => g.role)).toEqual(["vendedor", "comprador"]);
  });
});

describe("mapClientToRoleVariables", () => {
  const client = {
    full_name: "María Rodríguez",
    identification_number: "208390123",
    exact_address: "San José, Costa Rica",
  };

  it("copies only fields with a configured client source", () => {
    const result = mapClientToRoleVariables(client, [
      field("comprador.nombre", { autofill_source: "client_full_name" }),
      field("comprador.vin"),
    ]);
    expect(result.values).toEqual({ "comprador.nombre": "María Rodríguez" });
    expect(result.incomplete).toEqual([]);
  });

  it("maps every supported autofill source", () => {
    const result = mapClientToRoleVariables(client, [
      field("comprador.nombre", { autofill_source: "client_full_name" }),
      field("comprador.cedula", { autofill_source: "client_identification" }),
      field("comprador.direccion", { autofill_source: "client_address" }),
    ]);
    expect(result.values).toEqual({
      "comprador.nombre": "María Rodríguez",
      "comprador.cedula": "208390123",
      "comprador.direccion": "San José, Costa Rica",
    });
  });

  it("does not apply any transform — copies the raw client value", () => {
    const result = mapClientToRoleVariables(client, [
      field("comprador.cedula", {
        autofill_source: "client_identification",
        output_transform: "digits_to_words",
      }),
    ]);
    expect(result.values["comprador.cedula"]).toBe("208390123");
  });

  it("reports an empty client field as incomplete instead of copying an empty string", () => {
    const result = mapClientToRoleVariables(
      { ...client, exact_address: "  " },
      [field("comprador.direccion", { autofill_source: "client_address" })],
    );
    expect(result.values).toEqual({});
    expect(result.incomplete).toEqual(["comprador.direccion"]);
  });
});

describe("fieldsToOverwrite", () => {
  it("returns keys where the current value is non-empty", () => {
    const overwritten = fieldsToOverwrite(
      { "comprador.nombre": "María", "comprador.cedula": "1" },
      { "comprador.nombre": "Valor manual existente", "comprador.cedula": "" },
    );
    expect(overwritten).toEqual(["comprador.nombre"]);
  });

  it("returns an empty list when nothing would be overwritten", () => {
    const overwritten = fieldsToOverwrite(
      { "comprador.nombre": "María" },
      { "comprador.nombre": "" },
    );
    expect(overwritten).toEqual([]);
  });
});
