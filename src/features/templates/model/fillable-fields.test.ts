import { describe, expect, it } from "vitest";
import { buildFillableFields } from "./fillable-fields";

const field = (
  field_key: string,
  overrides: Partial<{ label: string; required: boolean; field_type: string }> = {},
) => ({
  field_key,
  label: overrides.label ?? `Etiqueta ${field_key}`,
  required: overrides.required ?? false,
  field_type: overrides.field_type,
});

describe("buildFillableFields", () => {
  it("keeps configured fields with their label, required flag and order", () => {
    const result = buildFillableFields(
      [
        field("comprador.nombre", { label: "Nombre del comprador", required: true }),
        field("vendedor.nombre", { label: "Nombre del vendedor" }),
      ],
      "Comparecen {{comprador.nombre}} y {{vendedor.nombre}}.",
    );

    expect(result).toEqual([
      {
        field_key: "comprador.nombre",
        label: "Nombre del comprador",
        required: true,
        field_type: "text",
        derived: false,
        autofill_source: "none",
        output_transform: "none",
      },
      {
        field_key: "vendedor.nombre",
        label: "Nombre del vendedor",
        required: false,
        field_type: "text",
        derived: false,
        autofill_source: "none",
        output_transform: "none",
      },
    ]);
  });

  it("carries through a configured autofill_source and output_transform", () => {
    const result = buildFillableFields(
      [
        {
          ...field("comprador.cedula"),
          autofill_source: "client_identification",
          output_transform: "digits_to_words",
        },
      ],
      "{{comprador.cedula}}",
    );
    expect(result[0].autofill_source).toBe("client_identification");
    expect(result[0].output_transform).toBe("digits_to_words");
  });

  it("derives optional fields for content variables without configuration", () => {
    const result = buildFillableFields(
      [],
      "Comparece {{comprador.nombre}}, placa {{vehiculo.placa}}.",
    );

    expect(result).toEqual([
      {
        field_key: "comprador.nombre",
        label: "comprador.nombre",
        required: false,
        field_type: "text",
        derived: true,
        autofill_source: "none",
        output_transform: "none",
      },
      {
        field_key: "vehiculo.placa",
        label: "vehiculo.placa",
        required: false,
        field_type: "text",
        derived: true,
        autofill_source: "none",
        output_transform: "none",
      },
    ]);
  });

  it("merges configured fields first and derived variables after", () => {
    const result = buildFillableFields(
      [field("comprador.nombre", { required: true })],
      "{{vehiculo.placa}} de {{comprador.nombre}}",
    );

    expect(result.map((f) => f.field_key)).toEqual([
      "comprador.nombre",
      "vehiculo.placa",
    ]);
    expect(result[0].derived).toBe(false);
    expect(result[1].derived).toBe(true);
  });

  it("does not duplicate a variable that is already configured", () => {
    const result = buildFillableFields(
      [field("comprador.nombre")],
      "{{comprador.nombre}} y otra vez {{comprador.nombre}}",
    );

    expect(result).toHaveLength(1);
  });

  it("ignores invalid placeholders in the content", () => {
    const result = buildFillableFields(
      [],
      "Texto con {{Mayúscula}} y {{con espacios malos x}} y {{}}.",
    );

    expect(result).toEqual([]);
  });

  it("keeps unused configured fields so their values stay editable", () => {
    const result = buildFillableFields(
      [field("clausula.extra")],
      "Contenido sin esa variable.",
    );

    expect(result.map((f) => f.field_key)).toEqual(["clausula.extra"]);
  });

  it("returns an empty list for a template without fields or variables", () => {
    expect(buildFillableFields([], "Texto estático sin variables.")).toEqual([]);
  });

  it("preserves a legacy textarea field_type for the configured field UI", () => {
    const result = buildFillableFields(
      [field("clausulas", { field_type: "textarea" })],
      "{{clausulas}}",
    );

    expect(result[0].field_type).toBe("textarea");
  });
});
