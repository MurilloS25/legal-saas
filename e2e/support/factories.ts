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
  restDeleteOwnRows,
  restFindIdBy,
  restInsert,
  restRpc,
  restSelect,
  restUpdate,
  restUpsert,
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
    // Activo por default: la mayoría de specs crean un machote y de
    // inmediato lo usan para crear una escritura (solo permitido desde
    // machotes activos). Los tests que necesitan un borrador lo piden
    // explícito con `status: "draft"`.
    status: options.status ?? "active",
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
    autofill_source?:
      | "none"
      | "client_full_name"
      | "client_identification"
      | "client_address";
    output_transform?: "none" | "digits_to_words" | "number_to_words";
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
    autofill_source: options.autofill_source ?? "none",
    output_transform: options.output_transform ?? "none",
  });
  registry.register("template_fields", id);
  return { id };
}

export async function createTestClient(
  registry: CleanupRegistry,
  options: {
    full_name: string;
    identification_number?: string;
    exact_address?: string;
  },
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
    exact_address: options.exact_address ?? "Fake test address",
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
    option_selections?: Record<string, string>;
    rendered_content?: string;
    client_id?: string;
    status?: "draft" | "ready" | "final";
    /**
     * Fija `created_at` en vez de dejarlo en "ahora". Necesario para
     * fixtures sin `authorized_at` que dependan de una quincena concreta:
     * `effective_index_date` (notarial_index_entries) cae a `created_at`
     * como resguardo — sin este override, esas filas quedarían ubicadas en
     * la quincena real de ejecución del test, no en la esperada por el
     * fixture.
     */
    created_at?: string;
  },
): Promise<{ id: string }> {
  const { userId } = getTestUserAuth();
  const id = await restInsert("documents", {
    owner_id: userId,
    template_id: templateId,
    client_id: options.client_id ?? null,
    title: options.title,
    status: options.status ?? "draft",
    field_values: options.field_values ?? {},
    option_selections: options.option_selections ?? {},
    rendered_content: options.rendered_content ?? "",
    ...(options.created_at ? { created_at: options.created_at } : {}),
  });
  registry.register("documents", id);
  return { id };
}

export async function createTestReceivable(
  registry: CleanupRegistry,
  options: {
    client_id: string;
    concept: string;
    currency?: "CRC" | "USD";
    amount_total?: string;
    issued_at?: string;
    due_at?: string;
    document_id?: string;
  },
): Promise<{ id: string }> {
  const { userId } = getTestUserAuth();
  const id = await restInsert("receivables", {
    owner_id: userId,
    client_id: options.client_id,
    document_id: options.document_id ?? null,
    concept: options.concept,
    currency: options.currency ?? "CRC",
    amount_total: options.amount_total ?? "100000.00",
    issued_at: options.issued_at ?? "2026-07-13",
    due_at: options.due_at ?? null,
  });
  registry.register("receivables", id);
  return { id };
}

export async function registerTestReceivablePayment(
  receivableId: string,
  options: {
    amount: number;
    paidAt?: string;
    method?: "cash" | "bank_transfer" | "sinpe" | "card" | "other";
    reference?: string;
  },
): Promise<string> {
  return restRpc<string>("register_receivable_payment", {
    p_receivable_id: receivableId,
    p_amount: options.amount,
    p_paid_at: options.paidAt ?? null,
    p_method: options.method ?? "cash",
    p_reference: options.reference ?? null,
  });
}

export async function voidActiveTestReceivablePayments(
  receivableId: string,
): Promise<void> {
  const payments = await restSelect<{ id: string }>(
    `receivable_payments?select=id&receivable_id=eq.${receivableId}&status=eq.active`,
  );

  for (const payment of payments) {
    await restRpc("void_receivable_payment", {
      p_payment_id: payment.id,
      p_reason: "E2E cleanup",
    });
  }
}

/**
 * Crea metadata notarial para una Escritura (aún editable). Cascada con el
 * documento, así que no necesita registro de cleanup propio.
 */
export async function createTestNotarialMetadata(
  documentId: string,
  options: {
    instrument_number?: number;
    authorized_at?: string;
    act_type?: string;
    appearing_parties_summary?: string;
    notes?: string;
  },
): Promise<void> {
  const { userId } = getTestUserAuth();
  await restInsert("document_notarial_metadata", {
    owner_id: userId,
    document_id: documentId,
    instrument_number: options.instrument_number ?? null,
    authorized_at: options.authorized_at ?? null,
    protocol_book: "08",
    initial_folio: "23F",
    final_folio: "23V",
    act_name_snapshot: options.act_type ?? null,
    generated_parties: options.appearing_parties_summary ?? null,
    notes: options.notes ?? null,
  });
}

/** Cambia el estado de una Escritura de prueba (p. ej. finalizarla). */
export async function setTestDocumentStatus(
  documentId: string,
  status: "draft" | "ready" | "final",
): Promise<void> {
  await restUpdate("documents", documentId, { status });
}

/** Cambia la pertenencia al Índice Notarial de una Escritura de prueba. */
export async function setTestDocumentInclusion(
  documentId: string,
  includeInNotarialIndex: boolean,
): Promise<void> {
  await restUpdate("documents", documentId, {
    include_in_notarial_index: includeInNotarialIndex,
  });
}

/**
 * Limpia las filas de auditoría de exportaciones del índice del usuario de
 * prueba (no se eliminan en cascada con documents).
 */
export async function cleanupNotarialExports(): Promise<void> {
  await restDeleteOwnRows("notarial_index_exports");
}

export type TestLawyerProfile = {
  full_name: string;
  professional_code: string | null;
  email: string | null;
  phone: string | null;
};

export async function replaceTestLawyerProfile(
  fullName: string,
): Promise<TestLawyerProfile | null> {
  const { userId } = getTestUserAuth();
  const previous = await restSelect<TestLawyerProfile>(
    `lawyer_profiles?select=full_name,professional_code,email,phone&owner_id=eq.${userId}&limit=1`,
  );
  await restUpsert(
    "lawyer_profiles",
    {
      // El usuario de prueba compartido siempre es propietario de su
      // propio Workspace (nunca invitado a otro) — su bootstrap deja
      // workspaces.id === auth.users.id, así que workspace_id === userId
      // aquí. lawyer_profiles_workspace_id_key es el unique constraint
      // real (lawyer_profiles_owner_id_key se eliminó al pasar a
      // Workspaces — ver 20260804210000_workspace_roles_and_invitations.sql).
      owner_id: userId,
      workspace_id: userId,
      full_name: fullName,
      professional_code: previous[0]?.professional_code ?? null,
      email: previous[0]?.email ?? null,
      phone: previous[0]?.phone ?? null,
    },
    "workspace_id",
  );
  return previous[0] ?? null;
}

export async function restoreTestLawyerProfile(
  previous: TestLawyerProfile | null,
): Promise<void> {
  const { userId } = getTestUserAuth();
  if (!previous) {
    await restDeleteOwnRows("lawyer_profiles");
    return;
  }
  await restUpsert(
    "lawyer_profiles",
    { owner_id: userId, workspace_id: userId, ...previous },
    "workspace_id",
  );
}

export async function removeTestLawyerProfile(): Promise<void> {
  await restDeleteOwnRows("lawyer_profiles");
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
