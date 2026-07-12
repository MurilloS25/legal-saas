/**
 * Factories de datos de prueba para los E2E autenticados.
 *
 * Cada factory crea la fila vía REST con el usuario de prueba (RLS aplica),
 * la registra en el CleanupRegistry del spec y devuelve su id. Los nombres
 * llevan el prefijo `e2e-<spec>-` más un fragmento de UUID, de modo que
 * sean únicos incluso con ejecución en paralelo.
 */

import { randomUUID } from "node:crypto";
import {
  CleanupRegistry,
  formatCleanupFailures,
  type CleanupTable,
} from "./cleanup-registry";
import {
  getTestUserAuth,
  restDelete,
  restFindIdBy,
  restInsert,
  restUpdate,
} from "./supabase-api";

export { CleanupRegistry };

export function uniqueName(specSlug: string, label: string): string {
  return `e2e-${specSlug}-${label}-${randomUUID().slice(0, 8)}`;
}

// ------------------------------------------------------------------ factories

export async function createTestTemplate(
  registry: CleanupRegistry,
  options: {
    name: string;
    content: string;
    description?: string;
    status?: "draft" | "active" | "archived";
    /**
     * Documento estructurado opcional (formato Tiptap JSON). Cuando se
     * pasa, content_json queda como { text: content, doc } — la misma
     * forma que persiste el workspace.
     */
    doc?: unknown;
  },
): Promise<{ id: string; name: string }> {
  const { userId } = getTestUserAuth();
  const id = await restInsert("templates", {
    owner_id: userId,
    name: options.name,
    description: options.description ?? null,
    status: options.status ?? "draft",
    content_json: options.doc
      ? { text: options.content, doc: options.doc }
      : { text: options.content },
    text_preview: options.content.slice(0, 300),
  });
  registry.register("templates", id);
  return { id, name: options.name };
}

/**
 * Reemplaza el contenido legacy de un machote de prueba. Útil para simular
 * que el machote cambió después de crear borradores (valores históricos).
 */
export async function updateTestTemplateContent(
  templateId: string,
  content: string,
): Promise<void> {
  await restUpdate("templates", templateId, {
    content_json: { text: content },
    text_preview: content.slice(0, 300),
  });
}

export async function createTestTemplateField(
  registry: CleanupRegistry,
  templateId: string,
  options: {
    field_key: string;
    label: string;
    required?: boolean;
    sort_order?: number;
  },
): Promise<{ id: string }> {
  const { userId } = getTestUserAuth();
  const id = await restInsert("template_fields", {
    owner_id: userId,
    template_id: templateId,
    field_key: options.field_key,
    label: options.label,
    field_type: "text",
    required: options.required ?? false,
    sort_order: options.sort_order ?? 0,
    source: "manual",
  });
  registry.register("template_fields", id);
  return { id };
}

export async function createTestClient(
  registry: CleanupRegistry,
  options: { full_name: string; identification_number?: string },
): Promise<{ id: string }> {
  const { userId } = getTestUserAuth();
  const id = await restInsert("clients", {
    owner_id: userId,
    full_name: options.full_name,
    identification_type: "cedula_fisica",
    identification_number: options.identification_number ?? "0-0000-0000",
    marital_status: "single",
    nationality: "Costa Rican",
    occupation: "Tester",
    exact_address: "Fake test address",
  });
  registry.register("clients", id);
  return { id };
}

export async function createTestDocument(
  registry: CleanupRegistry,
  templateId: string,
  options: {
    title: string;
    field_values?: Record<string, string>;
    rendered_content?: string;
  },
): Promise<{ id: string }> {
  const { userId } = getTestUserAuth();
  const id = await restInsert("documents", {
    owner_id: userId,
    template_id: templateId,
    title: options.title,
    status: "draft",
    field_values: options.field_values ?? {},
    rendered_content: options.rendered_content ?? "",
  });
  registry.register("documents", id);
  return { id };
}

// ------------------------------------------------------------------ UI-created rows

/**
 * Registra para cleanup una fila creada a través de la UI, buscándola por
 * una columna con valor único (p. ej. el nombre generado con uniqueName).
 */
export async function registerCreatedViaUi(
  registry: CleanupRegistry,
  table: CleanupTable,
  column: string,
  value: string,
): Promise<string | null> {
  try {
    const id = await restFindIdBy(table, column, value);
    if (id) registry.register(table, id);
    return id;
  } catch (error) {
    // El registro para cleanup nunca debe tumbar la suite.
    console.warn(
      `[e2e-cleanup] lookup failed for ${table}.${column}=${value}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

// ------------------------------------------------------------------ cleanup

/**
 * Ejecuta el cleanup del spec. Las filas ya eliminadas por la UI son válidas,
 * pero los errores reales hacen fallar la suite para evitar acumulación
 * silenciosa de datos E2E.
 */
export async function runCleanup(
  registry: CleanupRegistry,
  specSlug: string,
): Promise<void> {
  const report = await registry.cleanup(restDelete);
  const failureMessage = formatCleanupFailures(report, specSlug);

  if (failureMessage) {
    console.warn(failureMessage);
    throw new Error(failureMessage);
  }
}
