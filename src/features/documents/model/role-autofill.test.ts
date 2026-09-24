import { describe, expect, it } from "vitest";
import {
  fieldsToOverwrite,
  groupVariablesByRole,
  mapClientToRoleVariables,
  matchesClientSearch,
  planRoleAutofill,
  toAutofillClientOption,
  type AutofillClient,
} from "./role-autofill";
import type { FillableTemplateField } from "@/features/templates/domain";

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
  const client: AutofillClient = {
    identification_type: "cedula_fisica",
    full_name: "María Rodríguez",
    identification_number: "208390123",
    exact_address: "San José, Costa Rica",
    marital_status: "Casado/a",
    occupation: "Abogada",
    nationality: "costarricense",
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

describe("mapClientToRoleVariables — persona física (todos los datos)", () => {
  const juan: AutofillClient = {
    identification_type: "cedula_fisica",
    full_name: "Juan Pérez",
    identification_number: "108880777",
    exact_address: "Heredia, Barva",
    marital_status: "Casado/a una vez",
    occupation: "Abogado",
    nationality: "costarricense",
  };

  it("fills nombre, identificación, estado civil, ocupación, nacionalidad and dirección of any role", () => {
    for (const role of ["comprador", "vendedor", "apoderado"]) {
      const [group] = groupVariablesByRole([
        field(`${role}.nombre`),
        field(`${role}.identificacion`),
        field(`${role}.estado_civil`),
        field(`${role}.ocupacion`),
        field(`${role}.nacionalidad`),
        field(`${role}.direccion`),
      ]);
      const result = mapClientToRoleVariables(juan, group.variables);
      expect(result.values).toEqual({
        [`${role}.nombre`]: "Juan Pérez",
        [`${role}.identificacion`]: "108880777",
        [`${role}.estado_civil`]: "Casado/a una vez",
        [`${role}.ocupacion`]: "Abogado",
        [`${role}.nacionalidad`]: "costarricense",
        [`${role}.direccion`]: "Heredia, Barva",
      });
      expect(result.incomplete).toEqual([]);
      expect(result.notApplicable).toEqual([]);
    }
  });

  it("fills *.profesion from the client occupation", () => {
    const [group] = groupVariablesByRole([field("vendedor.profesion")]);
    expect(mapClientToRoleVariables(juan, group.variables).values).toEqual({
      "vendedor.profesion": "Abogado",
    });
  });

  it("honors an explicit marital status / occupation mapping on a non-standard key", () => {
    const [group] = groupVariablesByRole([
      field("comprador.ec", { autofill_source: "client_marital_status" }),
      field("comprador.oficio_actual", { autofill_source: "client_occupation" }),
    ]);
    expect(mapClientToRoleVariables(juan, group.variables).values).toEqual({
      "comprador.ec": "Casado/a una vez",
      "comprador.oficio_actual": "Abogado",
    });
  });

  it.each([
    ["Casado/a", "Casado/a una vez"],
    ["casada", "Casado/a una vez"],
    ["Libre", "Unión libre"],
    ["union_libre", "Unión libre"],
    ["Casada dos veces", "Casado/a dos veces"],
  ])("copies the canonical form of a legacy stored marital status %s → %s", (stored, expected) => {
    const [group] = groupVariablesByRole([field("apoderado.estado_civil")]);
    expect(
      mapClientToRoleVariables({ ...juan, marital_status: stored }, group.variables)
        .values,
    ).toEqual({ "apoderado.estado_civil": expected });
  });

  it("copies an unrecognized stored marital status as-is (never drops it)", () => {
    const [group] = groupVariablesByRole([field("comprador.estado_civil")]);
    expect(
      mapClientToRoleVariables({ ...juan, marital_status: "single" }, group.variables)
        .values,
    ).toEqual({ "comprador.estado_civil": "single" });
  });

  it("reports an empty marital status as incomplete", () => {
    const [group] = groupVariablesByRole([field("comprador.estado_civil")]);
    const result = mapClientToRoleVariables(
      { ...juan, marital_status: "" },
      group.variables,
    );
    expect(result.values).toEqual({});
    expect(result.incomplete).toEqual(["comprador.estado_civil"]);
  });
});

describe("mapClientToRoleVariables — persona jurídica", () => {
  const sociedad: AutofillClient = {
    identification_type: "cedula_juridica",
    full_name: "Inversiones Ejemplo Sociedad Anónima",
    identification_number: "3-101-123456",
    exact_address: "San José, Escazú",
    marital_status: null,
    occupation: null,
    nationality: null,
  };

  it("fills razón social, cédula jurídica (with hyphens) and domicilio", () => {
    const [group] = groupVariablesByRole([
      field("vendedor.nombre"),
      field("vendedor.cedula_juridica"),
      field("vendedor.domicilio"),
    ]);
    const result = mapClientToRoleVariables(sociedad, group.variables);
    expect(result.values).toEqual({
      "vendedor.nombre": "Inversiones Ejemplo Sociedad Anónima",
      "vendedor.cedula_juridica": "3-101-123456",
      "vendedor.domicilio": "San José, Escazú",
    });
  });

  it("keeps the hyphens even when the variable has a digits_to_words transform (raw value only)", () => {
    const [group] = groupVariablesByRole([
      field("vendedor.cedula", { output_transform: "digits_to_words" }),
    ]);
    expect(
      mapClientToRoleVariables(sociedad, group.variables).values["vendedor.cedula"],
    ).toBe("3-101-123456");
  });

  it("never invents marital status, occupation or nationality", () => {
    const [group] = groupVariablesByRole([
      field("vendedor.nombre"),
      field("vendedor.estado_civil"),
      field("vendedor.ocupacion"),
      field("vendedor.nacionalidad"),
    ]);
    const result = mapClientToRoleVariables(sociedad, group.variables);
    expect(result.values).toEqual({
      "vendedor.nombre": "Inversiones Ejemplo Sociedad Anónima",
    });
    expect(result.notApplicable).toEqual([
      "vendedor.estado_civil",
      "vendedor.ocupacion",
      "vendedor.nacionalidad",
    ]);
    expect(result.incomplete).toEqual([]);
  });

  it("ignores stale personal data even if present on a legal entity", () => {
    const [group] = groupVariablesByRole([field("vendedor.estado_civil")]);
    const result = mapClientToRoleVariables(
      { ...sociedad, marital_status: "Casado/a" },
      group.variables,
    );
    expect(result.values).toEqual({});
    expect(result.notApplicable).toEqual(["vendedor.estado_civil"]);
  });
});

describe("toAutofillClientOption", () => {
  it("keeps every autofill-relevant column of a client row", () => {
    expect(
      toAutofillClientOption({
        id: "c1",
        identification_type: "cedula_fisica",
        full_name: "Juan Pérez",
        identification_number: "108880777",
        exact_address: "Heredia",
        marital_status: "Casado/a",
        occupation: "Abogado",
        nationality: "costarricense",
      }),
    ).toEqual({
      id: "c1",
      identification_type: "cedula_fisica",
      full_name: "Juan Pérez",
      identification_number: "108880777",
      exact_address: "Heredia",
      marital_status: "Casado/a",
      occupation: "Abogado",
      nationality: "costarricense",
    });
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

describe("planRoleAutofill — reemplazar una persona física por una sociedad", () => {
  const juan: AutofillClient = {
    identification_type: "cedula_fisica",
    full_name: "Juan Pérez",
    identification_number: "108880777",
    exact_address: "Heredia",
    marital_status: "Casado/a una vez",
    occupation: "Abogado",
    nationality: "costarricense",
  };
  const sociedad: AutofillClient = {
    identification_type: "cedula_juridica",
    full_name: "Inversiones Ejemplo S.A.",
    identification_number: "3-101-123456",
    exact_address: "San José, Escazú",
    marital_status: null,
    occupation: null,
    nationality: null,
  };
  const keys = [
    "vendedor.nombre",
    "vendedor.cedula",
    "vendedor.estado_civil",
    "vendedor.ocupacion",
    "vendedor.nacionalidad",
    "vendedor.domicilio",
  ];

  it("clears personal data left by the previous person instead of attributing it to the sociedad", () => {
    const [group] = groupVariablesByRole(keys.map((key) => field(key)));
    const current = mapClientToRoleVariables(juan, group.variables).values;
    const plan = planRoleAutofill(sociedad, group.variables, current);
    expect(plan.values).toEqual({
      "vendedor.nombre": "Inversiones Ejemplo S.A.",
      "vendedor.cedula": "3-101-123456",
      "vendedor.domicilio": "San José, Escazú",
      "vendedor.estado_civil": "",
      "vendedor.ocupacion": "",
      "vendedor.nacionalidad": "",
    });
    expect(plan.clearedFields).toEqual([
      "vendedor.estado_civil",
      "vendedor.ocupacion",
      "vendedor.nacionalidad",
    ]);
    // Reemplazar o vaciar valores existentes siempre pide confirmación.
    expect(plan.overwriteFields).toEqual(keys);
  });

  it("does not touch not-applicable fields that are already empty", () => {
    const [group] = groupVariablesByRole(keys.map((key) => field(key)));
    const plan = planRoleAutofill(sociedad, group.variables, {});
    expect(plan.clearedFields).toEqual([]);
    expect(plan.overwriteFields).toEqual([]);
    expect(plan.values).not.toHaveProperty("vendedor.estado_civil");
    expect(plan.notApplicable).toEqual([
      "vendedor.estado_civil",
      "vendedor.ocupacion",
      "vendedor.nacionalidad",
    ]);
  });

  it("works the same for any role", () => {
    const [group] = groupVariablesByRole([field("apoderado.nombre"), field("apoderado.estado_civil")]);
    const plan = planRoleAutofill(sociedad, group.variables, {
      "apoderado.estado_civil": "Soltero/a",
    });
    expect(plan.values).toEqual({
      "apoderado.nombre": "Inversiones Ejemplo S.A.",
      "apoderado.estado_civil": "",
    });
  });

  it("a persona física keeps filling every field (no regression)", () => {
    const [group] = groupVariablesByRole(keys.map((key) => field(key)));
    const plan = planRoleAutofill(juan, group.variables, {});
    expect(plan.clearedFields).toEqual([]);
    expect(plan.values["vendedor.estado_civil"]).toBe("Casado/a una vez");
    expect(plan.values["vendedor.ocupacion"]).toBe("Abogado");
  });
});

describe("matchesClientSearch", () => {
  const sociedad = { full_name: "Inversiones Ejemplo S.A.", identification_number: "3-101-123456" };
  const juan = { full_name: "Juan Pérez", identification_number: "108880777" };

  it.each(["3-101-123456", "3101123456", "3 101 123456", "101-1234", "1011234"])(
    "finds a sociedad by cédula jurídica typed as %j",
    (query) => {
      expect(matchesClientSearch(sociedad, query)).toBe(true);
    },
  );

  it.each(["1-0888-0777", "108880777", "0888"])(
    "finds a persona física by cédula typed as %j",
    (query) => {
      expect(matchesClientSearch(juan, query)).toBe(true);
    },
  );

  it("matches names ignoring case and accents", () => {
    expect(matchesClientSearch(juan, "perez")).toBe(true);
    expect(matchesClientSearch(sociedad, "INVERSIONES")).toBe(true);
  });

  it("does not match unrelated text or separators alone", () => {
    expect(matchesClientSearch(juan, "sociedad")).toBe(false);
    expect(matchesClientSearch(juan, "-")).toBe(false);
  });

  it("an empty query matches everything", () => {
    expect(matchesClientSearch(juan, "  ")).toBe(true);
  });
});
