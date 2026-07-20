/**
 * Autollenado por roles: agrupa las variables `rol.dato` de una Escritura y
 * copia datos de un Cliente registrado hacia el rol correspondiente.
 *
 * El Cliente elegido solo sirve para copiar datos una vez: no crea una
 * relación formal por rol, no reemplaza el `client_id` principal de la
 * Escritura y no genera actualizaciones automáticas futuras. Los valores
 * copiados quedan como un snapshot editable dentro de la Escritura.
 */

import type { FillableTemplateField } from "@/features/templates";

export type RoleVariableGroup = {
  role: string;
  variables: FillableTemplateField[];
  /** true si al menos una variable del grupo tiene un origen de Cliente configurado. */
  hasClientAutofill: boolean;
};

/**
 * Agrupa las variables cuya clave sigue la convención `rol.dato`. Las
 * variables sin punto, o con el punto al inicio, no se agrupan (no se asume
 * ningún primer segmento como persona/rol por defecto).
 */
export function groupVariablesByRole(
  fields: FillableTemplateField[],
): RoleVariableGroup[] {
  const order: string[] = [];
  const groups = new Map<string, FillableTemplateField[]>();

  for (const field of fields) {
    const dotIndex = field.field_key.indexOf(".");
    if (dotIndex <= 0) continue;
    const role = field.field_key.slice(0, dotIndex);
    const existing = groups.get(role);
    if (existing) {
      existing.push(field);
    } else {
      groups.set(role, [field]);
      order.push(role);
    }
  }

  return order.map((role) => {
    const variables = groups.get(role)!;
    return {
      role,
      variables,
      hasClientAutofill: variables.some((v) => v.autofill_source !== "none"),
    };
  });
}

export type AutofillClient = {
  full_name: string;
  identification_number: string;
  exact_address: string;
};

/** Cliente listado en el selector de la Escritura, con los campos copiables. */
export type DocumentClientOption = AutofillClient & { id: string };

export type ClientAutofillResult = {
  /** Solo las variables cuyo campo de Cliente configurado tiene un valor. */
  values: Record<string, string>;
  /**
   * Variables cuyo origen de Cliente configurado está vacío: se dejan fuera
   * de `values` (no se copia nada, no se borra un valor manual existente).
   */
  incomplete: string[];
};

function clientFieldFor(
  source: FillableTemplateField["autofill_source"],
  client: AutofillClient,
): string | null {
  switch (source) {
    case "client_full_name":
      return client.full_name;
    case "client_identification":
      return client.identification_number;
    case "client_address":
      return client.exact_address;
    case "none":
      return null;
  }
}

/**
 * Copia los campos configurados del Cliente hacia las variables del rol.
 * Solo copia los campos con un origen de Cliente configurado (`!== "none"`);
 * el resto de las variables del rol no se tocan. No aplica ninguna
 * transformación aquí — la transformación de salida se aplica de forma
 * determinística en el render (ver `applyVariableTransform`), así que el
 * valor copiado es siempre el dato crudo del Cliente.
 */
export function mapClientToRoleVariables(
  client: AutofillClient,
  variables: FillableTemplateField[],
): ClientAutofillResult {
  const values: Record<string, string> = {};
  const incomplete: string[] = [];

  for (const variable of variables) {
    const raw = clientFieldFor(variable.autofill_source, client);
    if (raw === null) continue;
    const trimmed = raw.trim();
    if (trimmed === "") {
      incomplete.push(variable.field_key);
    } else {
      values[variable.field_key] = trimmed;
    }
  }

  return { values, incomplete };
}

/**
 * De las claves que se proponen copiar, cuáles ya tienen un valor no vacío
 * en la Escritura — esas son las que requieren confirmación antes de
 * sobrescribirse.
 */
export function fieldsToOverwrite(
  proposedValues: Record<string, string>,
  currentValues: Record<string, string>,
): string[] {
  return Object.keys(proposedValues).filter(
    (key) => (currentValues[key] ?? "").trim() !== "",
  );
}
