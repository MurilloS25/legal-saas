import { describe, expect, it } from "vitest";
import {
  detectLegacyVariables,
  humanizeLegacyLabel,
  stripInvisibleCharacters,
} from "./legacy-variables";

describe("detectLegacyVariables", () => {
  it("detects an uppercase legacy placeholder", () => {
    const matches = detectLegacyVariables("Tomo {{TOMO_NUMERO}} del protocolo.");
    expect(matches).toEqual([
      { raw: "TOMO_NUMERO", key: "tomo_numero", label: "Tomo numero" },
    ]);
  });

  it("detects every distinct uppercase placeholder from a real legacy block", () => {
    const text =
      "Comparece {{NOMBRE_COMPARECIENTE}}, de nacionalidad " +
      "{{NACIONALIDAD_COMPARECIENTE}}, propietario de un vehículo placas " +
      "{{PLACAS}}, marca {{MARCA}}, combustible {{COMBUSTIBLE}}.";
    const matches = detectLegacyVariables(text).map((m) => m.key);
    expect(matches).toEqual([
      "nombre_compareciente",
      "nacionalidad_compareciente",
      "placas",
      "marca",
      "combustible",
    ]);
  });

  it("does not report placeholders that already use the canonical syntax", () => {
    expect(detectLegacyVariables("{{comprador.nombre}}")).toEqual([]);
  });

  it("ignores a mixed batch's canonical placeholders but reports the legacy ones", () => {
    const matches = detectLegacyVariables(
      "{{comprador.nombre}} y {{VENDEDOR_NOMBRE}}",
    );
    expect(matches).toEqual([
      { raw: "VENDEDOR_NOMBRE", key: "vendedor_nombre", label: "Vendedor nombre" },
    ]);
  });

  it("normalizes a mixed-case dotted key", () => {
    const matches = detectLegacyVariables("{{NUMERO_ESCRITURA.numero}}");
    expect(matches).toEqual([
      {
        raw: "NUMERO_ESCRITURA.numero",
        key: "numero_escritura.numero",
        label: "Numero escritura numero",
      },
    ]);
  });

  it("does not treat a colon-delimited smart-block token as a variable", () => {
    expect(detectLegacyVariables("{{SMART:block_fda924b2}}")).toEqual([]);
  });

  it("does not treat a placeholder with spaces as a variable", () => {
    expect(detectLegacyVariables("{{Clave Invalida}}")).toEqual([]);
  });

  it("deduplicates repeated occurrences of the same legacy key", () => {
    const matches = detectLegacyVariables("{{TOMO_NUMERO}} ... {{TOMO_NUMERO}}");
    expect(matches).toHaveLength(1);
  });

  it("ignores invisible zero-width characters inserted inside a placeholder", () => {
    const withInvisible = "{{TOMO​_NUMERO}}";
    const matches = detectLegacyVariables(withInvisible);
    expect(matches).toEqual([
      { raw: "TOMO_NUMERO", key: "tomo_numero", label: "Tomo numero" },
    ]);
  });

  it("returns no matches for plain text", () => {
    expect(detectLegacyVariables("texto sin variables")).toEqual([]);
  });
});

describe("humanizeLegacyLabel", () => {
  it("converts underscores to spaces and capitalizes only the first letter", () => {
    expect(humanizeLegacyLabel("NOMBRE_DEL_COMPRADOR")).toBe(
      "Nombre del comprador",
    );
  });

  it("converts dots to spaces too", () => {
    expect(humanizeLegacyLabel("NUMERO_ESCRITURA.numero")).toBe(
      "Numero escritura numero",
    );
  });
});

describe("stripInvisibleCharacters", () => {
  it("removes zero-width and BOM characters", () => {
    expect(stripInvisibleCharacters("a​b﻿c")).toBe("abc");
  });
});
