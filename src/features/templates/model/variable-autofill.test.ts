import { describe, expect, it } from "vitest";
import {
  suggestAutofillSource,
  toVariableAutofillSource,
} from "./variable-autofill";
import { toVariableOutputTransform } from "@/lib/editor/text-transforms";

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
