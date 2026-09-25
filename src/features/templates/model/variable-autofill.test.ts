import { describe, expect, it } from "vitest";
import {
  inferAutofillSource,
  normalizeVariableDataKey,
  resolveAutofillSource,
  stripDiacritics,
  suggestAutofillSource,
  toVariableAutofillSource,
} from "./variable-autofill";
import { toVariableOutputTransform } from "@/lib/editor/text-transforms";

describe("stripDiacritics", () => {
  it("removes accents while preserving the base letters", () => {
    expect(stripDiacritics("Número Identificación")).toBe(
      "Numero Identificacion",
    );
  });

  it("leaves plain ASCII text unchanged", () => {
    expect(stripDiacritics("nombre_completo")).toBe("nombre_completo");
  });
});

describe("normalizeVariableDataKey", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeVariableDataKey("Número Identificación")).toBe(
      "numero_identificacion",
    );
  });

  it("splits camelCase into snake_case", () => {
    expect(normalizeVariableDataKey("nombreCompleto")).toBe(
      "nombre_completo",
    );
  });

  it("converts dashes to underscores", () => {
    expect(normalizeVariableDataKey("nombre-completo")).toBe(
      "nombre_completo",
    );
  });

  it("converts spaces to underscores", () => {
    expect(normalizeVariableDataKey("nombre completo")).toBe(
      "nombre_completo",
    );
  });

  it("collapses repeated separators", () => {
    expect(normalizeVariableDataKey("nombre__completo")).toBe(
      "nombre_completo",
    );
  });

  it("treats already-normalized input as a no-op", () => {
    expect(normalizeVariableDataKey("direccion_exacta")).toBe(
      "direccion_exacta",
    );
  });
});

describe("inferAutofillSource", () => {
  const cases: [string, ReturnType<typeof inferAutofillSource>][] = [
    ["nombre", "client_full_name"],
    ["nombre_completo", "client_full_name"],
    ["full_name", "client_full_name"],
    ["nombreCompleto", "client_full_name"],
    ["Nombre Completo", "client_full_name"],
    ["cedula", "client_identification"],
    ["identificacion", "client_identification"],
    ["numero_identificacion", "client_identification"],
    ["direccion", "client_address"],
    ["domicilio", "client_address"],
    ["direccion_exacta", "client_address"],
    ["estado_civil", "client_marital_status"],
    ["Estado Civil", "client_marital_status"],
    ["estadoCivil", "client_marital_status"],
    ["ocupacion", "client_occupation"],
    ["ocupación", "client_occupation"],
    ["profesion", "client_occupation"],
    ["profesión", "client_occupation"],
    ["oficio", "client_occupation"],
    ["profesion_u_oficio", "client_occupation"],
    ["nacionalidad", "client_nationality"],
    ["razon_social", "client_full_name"],
    ["cedula_juridica", "client_identification"],
  ];

  for (const [dato, expected] of cases) {
    it(`infers "${dato}" as ${expected}`, () => {
      expect(inferAutofillSource(dato)).toBe(expected);
    });
  }

  it("does not invent client_email/client_phone even for correo/telefono aliases", () => {
    expect(inferAutofillSource("correo")).toBe("none");
    expect(inferAutofillSource("email")).toBe("none");
    expect(inferAutofillSource("telefono")).toBe("none");
    expect(inferAutofillSource("celular")).toBe("none");
  });

  it("does not use fuzzy matching for unrecognized aliases", () => {
    expect(inferAutofillSource("dato")).toBe("none");
    expect(inferAutofillSource("informacion")).toBe("none");
    expect(inferAutofillSource("valor")).toBe("none");
    expect(inferAutofillSource("campo1")).toBe("none");
    expect(inferAutofillSource("general")).toBe("none");
  });
});

describe("resolveAutofillSource", () => {
  it("prefers explicit configuration over automatic detection", () => {
    expect(
      resolveAutofillSource("comprador.nombre", "client_address"),
    ).toBe("client_address");
  });

  it("falls back to automatic detection when explicit is none", () => {
    expect(resolveAutofillSource("comprador.cedula", "none")).toBe(
      "client_identification",
    );
  });

  it("returns none for a key without a dot", () => {
    expect(resolveAutofillSource("precio", "none")).toBe("none");
  });

  it("returns none for an unrecognized dato", () => {
    expect(resolveAutofillSource("vehiculo.vin", "none")).toBe("none");
  });
});

describe("suggestAutofillSource", () => {
  it("suggests client_full_name for *.nombre", () => {
    expect(suggestAutofillSource("comprador.nombre")).toBe("client_full_name");
  });

  it("suggests client_identification for *.cedula and *.identificacion", () => {
    expect(suggestAutofillSource("comprador.cedula")).toBe(
      "client_identification",
    );
    expect(suggestAutofillSource("vendedor.identificacion")).toBe(
      "client_identification",
    );
  });

  it("suggests client_address for *.direccion", () => {
    expect(suggestAutofillSource("compareciente.direccion")).toBe(
      "client_address",
    );
  });

  it("does not suggest anything for *.correo or *.telefono (out of scope)", () => {
    expect(suggestAutofillSource("comprador.correo")).toBe("none");
    expect(suggestAutofillSource("comprador.telefono")).toBe("none");
  });

  it("returns none for a key without a dot", () => {
    expect(suggestAutofillSource("precio")).toBe("none");
  });

  it("returns none for an unrecognized 'dato' segment", () => {
    expect(suggestAutofillSource("vehiculo.vin")).toBe("none");
  });
});

describe("toVariableAutofillSource", () => {
  it("passes through a known value", () => {
    expect(toVariableAutofillSource("client_full_name")).toBe(
      "client_full_name",
    );
  });

  it("falls back to none for an unknown value", () => {
    expect(toVariableAutofillSource("client_email")).toBe("none");
    expect(toVariableAutofillSource("")).toBe("none");
  });
});

describe("toVariableOutputTransform", () => {
  it("passes through a known value", () => {
    expect(toVariableOutputTransform("digits_to_words")).toBe(
      "digits_to_words",
    );
  });

  it("falls back to none for an unknown value", () => {
    expect(toVariableOutputTransform("amount_to_words")).toBe("none");
  });
});
