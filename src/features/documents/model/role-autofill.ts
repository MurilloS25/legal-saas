/**
 * Autollenado por roles: agrupa las variables `rol.dato` de una Escritura y
 * copia datos de un Cliente registrado hacia el rol correspondiente.
 *
 * El Cliente elegido solo sirve para copiar datos una vez: no crea una
 * relación formal por rol, no reemplaza el `client_id` principal de la
 * Escritura y no genera actualizaciones automáticas futuras. Los valores
 * copiados quedan como un snapshot editable dentro de la Escritura.
 */

import {
  isLegalEntityType,
  resolveMaritalStatus,
} from "@/features/clients/domain";
import type { FillableTemplateField } from "@/features/templates/domain";
import {
  NATURAL_PERSON_ONLY_AUTOFILL_SOURCES,
  resolveAutofillSource,
  stripDiacritics,
  type VariableAutofillSource,
} from "@/features/templates/domain";

/**
 * Variable de un rol con su origen de autollenado ya resuelto: configuración
 * explícita del Machote si existe, si no la detección automática por alias
 * (ver `resolveAutofillSource`). Nunca requiere que el Machote configure
 * manualmente nombres comunes de campo.
 */
export type ResolvedRoleVariable = FillableTemplateField & {
  resolvedAutofillSource: VariableAutofillSource;
};

export type RoleVariableGroup = {
  role: string;
  variables: ResolvedRoleVariable[];
  /** true si al menos una variable del grupo resuelve a un origen de Cliente. */
  hasClientAutofill: boolean;
};

/**
 * Agrupa las variables cuya clave sigue la convención `rol.dato`. Las
 * variables sin punto, o con el punto al inicio, no se agrupan (no se asume
 * ningún primer segmento como persona/rol por defecto). No hay una lista
 * cerrada de roles: cualquier primer segmento válido forma su propio grupo.
 */
export function groupVariablesByRole(
  fields: FillableTemplateField[],
): RoleVariableGroup[] {
  const order: string[] = [];
  const groups = new Map<string, ResolvedRoleVariable[]>();

  for (const field of fields) {
    const dotIndex = field.field_key.indexOf(".");
    if (dotIndex <= 0) continue;
    const role = field.field_key.slice(0, dotIndex);
    const resolved: ResolvedRoleVariable = {
      ...field,
      resolvedAutofillSource: resolveAutofillSource(
        field.field_key,
        field.autofill_source,
      ),
    };
    const existing = groups.get(role);
    if (existing) {
      existing.push(resolved);
    } else {
      groups.set(role, [resolved]);
      order.push(role);
    }
  }

  return order.map((role) => {
    const variables = groups.get(role)!;
    return {
      role,
      variables,
      hasClientAutofill: variables.some(
        (v) => v.resolvedAutofillSource !== "none",
      ),
    };
  });
}

/**
 * Datos del Cliente que el autollenado puede copiar. Estado civil,
 * ocupación y nacionalidad son `null` en una persona jurídica.
 */
export type AutofillClient = {
  identification_type: string;
  full_name: string;
  identification_number: string;
  exact_address: string;
  marital_status: string | null;
  occupation: string | null;
  nationality: string | null;
};

/** Cliente listado en el selector de la Escritura, con los campos copiables. */
export type DocumentClientOption = AutofillClient & { id: string };

/**
 * Única proyección de una fila de Cliente a opción del selector de la
 * Escritura: así las páginas de creación y edición nunca olvidan un campo
 * copiable (la causa de que estado civil/ocupación no llegaran al rol).
 */
export function toAutofillClientOption(
  client: DocumentClientOption,
): DocumentClientOption {
  return {
    id: client.id,
    identification_type: client.identification_type,
    full_name: client.full_name,
    identification_number: client.identification_number,
    exact_address: client.exact_address,
    marital_status: client.marital_status,
    occupation: client.occupation,
    nationality: client.nationality,
  };
}

export type ClientAutofillResult = {
  /** Solo las variables cuyo campo de Cliente configurado tiene un valor. */
  values: Record<string, string>;
  /**
   * Variables cuyo origen de Cliente configurado está vacío: se dejan fuera
   * de `values` (no se copia nada, no se borra un valor manual existente).
   */
  incomplete: string[];
  /**
   * Variables de datos personales (estado civil, ocupación, nacionalidad)
   * cuando el Cliente es una persona jurídica: no aplican, no se copia nada
   * y el valor de la Escritura queda como esté.
   */
  notApplicable: string[];
};

function clientFieldFor(
  source: VariableAutofillSource,
  client: AutofillClient,
): string | null {
  switch (source) {
    case "client_full_name":
      return client.full_name;
    case "client_identification":
      return client.identification_number;
    case "client_address":
      return client.exact_address;
    case "client_marital_status":
      // Forma canónica ("Casado/a" guardado antes -> "Casado/a una vez").
      return resolveMaritalStatus(client.marital_status);
    case "client_occupation":
      return client.occupation ?? "";
    case "client_nationality":
      return client.nationality ?? "";
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
 * valor copiado es siempre el dato crudo del Cliente (una cédula jurídica
 * llega con sus guiones).
 */
export function mapClientToRoleVariables(
  client: AutofillClient,
  variables: ResolvedRoleVariable[],
): ClientAutofillResult {
  const values: Record<string, string> = {};
  const incomplete: string[] = [];
  const notApplicable: string[] = [];
  const legalEntity = isLegalEntityType(client.identification_type);

  for (const variable of variables) {
    const source = variable.resolvedAutofillSource;
    if (legalEntity && NATURAL_PERSON_ONLY_AUTOFILL_SOURCES.has(source)) {
      notApplicable.push(variable.field_key);
      continue;
    }
    const raw = clientFieldFor(source, client);
    if (raw === null) continue;
    const trimmed = raw.trim();
    if (trimmed === "") {
      incomplete.push(variable.field_key);
    } else {
      values[variable.field_key] = trimmed;
    }
  }

  return { values, incomplete, notApplicable };
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

export type RoleAutofillPlan = ClientAutofillResult & {
  /**
   * Variables de datos personales que se vacían porque el Cliente elegido
   * es una persona jurídica y el rol tenía un valor (p. ej. el estado civil
   * de la persona física seleccionada antes): nunca se deja un dato
   * personal ajeno atribuido a una sociedad.
   */
  clearedFields: string[];
  /** Variables con valor actual que se reemplazan o vacían: requieren confirmación. */
  overwriteFields: string[];
};

/**
 * Plan completo de autollenado de un rol: los valores a copiar del Cliente
 * y, si es una persona jurídica, el vaciado de los datos personales que
 * no le aplican pero que el rol todavía contiene. Todo reemplazo o vaciado
 * de un valor existente pasa por la misma confirmación.
 */
export function planRoleAutofill(
  client: AutofillClient,
  variables: ResolvedRoleVariable[],
  currentValues: Record<string, string>,
): RoleAutofillPlan {
  const result = mapClientToRoleVariables(client, variables);
  const clearedFields = result.notApplicable.filter(
    (key) => (currentValues[key] ?? "").trim() !== "",
  );
  const values = { ...result.values };
  for (const key of clearedFields) values[key] = "";

  const overwriteFields = variables
    .map((variable) => variable.field_key)
    .filter((key) => key in values && (currentValues[key] ?? "").trim() !== "");

  return { ...result, values, clearedFields, overwriteFields };
}

function comparableIdentification(value: string): string {
  return value.toLowerCase().replace(/[-\s]/g, "");
}

/**
 * Búsqueda del selector de Clientes: por nombre (sin distinguir mayúsculas
 * ni tildes) o por identificación sin importar guiones ni espacios — una
 * cédula jurídica guardada como "3-101-123456" se encuentra escribiendo
 * "3101123456", y una física guardada sin guiones con "1-0888-0777".
 */
export function matchesClientSearch(
  client: Pick<AutofillClient, "full_name" | "identification_number">,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (trimmed === "") return true;
  const normalizedQuery = stripDiacritics(trimmed).toLowerCase();
  if (stripDiacritics(client.full_name).toLowerCase().includes(normalizedQuery)) {
    return true;
  }
  const idQuery = comparableIdentification(trimmed);
  return (
    idQuery !== "" &&
    comparableIdentification(client.identification_number).includes(idQuery)
  );
}
