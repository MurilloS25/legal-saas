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

  it("does not require any closed list of roles — any first segment forms its own group", () => {
    const groups = groupVariablesByRole([
      field("otorgante.nombre"),
      field("apoderado.nombre"),
      field("acreedor.nombre"),
      field("deudor.nombre"),
      field("representante.nombre"),
    ]);
    expect(groups.map((g) => g.role)).toEqual([
      "otorgante",
      "apoderado",
      "acreedor",
      "deudor",
      "representante",
    ]);
  });

  it("marks hasClientAutofill from automatic detection even without explicit configuration", () => {
    const groups = groupVariablesByRole([
      field("comprador.nombre"),
      field("comprador.vin"),
    ]);
    expect(groups[0].hasClientAutofill).toBe(true);
    expect(groups[0].variables[0].resolvedAutofillSource).toBe(
      "client_full_name",
    );
    expect(groups[0].variables[1].resolvedAutofillSource).toBe("none");
  });

  it("detects nombre_completo, cedula, identificacion, direccion and domicilio automatically", () => {
    const groups = groupVariablesByRole([
      field("vendedor.nombre_completo"),
      field("comprador.cedula"),
      field("compareciente.identificacion"),
      field("comprador.direccion"),
      field("vendedor.domicilio"),
    ]);
    const bySource = Object.fromEntries(
      groups.flatMap((g) => g.variables).map((v) => [v.field_key, v.resolvedAutofillSource]),
    );
    expect(bySource["vendedor.nombre_completo"]).toBe("client_full_name");
    expect(bySource["comprador.cedula"]).toBe("client_identification");
    expect(bySource["compareciente.identificacion"]).toBe(
      "client_identification",
    );
    expect(bySource["comprador.direccion"]).toBe("client_address");
    expect(bySource["vendedor.domicilio"]).toBe("client_address");
  });

  it("does not group a role with no recognizable data as autofillable", () => {
    const groups = groupVariablesByRole([
      field("vehiculo.vin"),
      field("vehiculo.placa"),
    ]);
    expect(groups[0].hasClientAutofill).toBe(false);
  });

  it("gives explicit configuration priority over automatic detection", () => {
    const groups = groupVariablesByRole([
      field("comprador.nombre", { autofill_source: "client_address" }),
    ]);
    expect(groups[0].variables[0].resolvedAutofillSource).toBe(
      "client_address",
    );
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

  it("copies only fields whose resolved source maps to a client field", () => {
    const [group] = groupVariablesByRole([
      field("comprador.nombre"),
      field("comprador.vin"),
    ]);
    const result = mapClientToRoleVariables(client, group.variables);
    expect(result.values).toEqual({ "comprador.nombre": "María Rodríguez" });
    expect(result.incomplete).toEqual([]);
  });

  it("maps every supported autofill source via automatic detection", () => {
    const [group] = groupVariablesByRole([
      field("comprador.nombre"),
      field("comprador.cedula"),
      field("comprador.direccion"),
    ]);
    const result = mapClientToRoleVariables(client, group.variables);
    expect(result.values).toEqual({
      "comprador.nombre": "María Rodríguez",
      "comprador.cedula": "208390123",
      "comprador.direccion": "San José, Costa Rica",
    });
  });

  it("does not apply any transform — copies the raw client value", () => {
    const [group] = groupVariablesByRole([
      field("comprador.cedula", { output_transform: "digits_to_words" }),
    ]);
    const result = mapClientToRoleVariables(client, group.variables);
    expect(result.values["comprador.cedula"]).toBe("208390123");
  });

  it("reports an empty client field as incomplete instead of copying an empty string", () => {
    const [group] = groupVariablesByRole([field("comprador.direccion")]);
    const result = mapClientToRoleVariables(
      { ...client, exact_address: "  " },
      group.variables,
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
