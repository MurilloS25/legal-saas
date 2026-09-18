import "server-only";

import { requireWorkspace } from "@/lib/server/auth";
import { throwDataAccessError } from "@/lib/server/errors";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/server/permissions";
import type { ReceivableActivityEvent } from "../model/activity-format";
import type { ReceivableEntry, ReceivableRow } from "../model/types";
import {
  ENTRY_COLUMNS,
  mapReceivableEntries,
  mapReceivableEntry,
  normalizeAmount,
  type ReceivableTableRow,
} from "./mappers";

const ACTIVITY_LIMIT = 50;
export const RELATED_RECEIVABLES_LIMIT = 10;

export async function getReceivableEntry(
  id: string,
): Promise<ReceivableEntry | null> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throwDataAccessError("get receivable entry", error);
  return data ? mapReceivableEntry(data) : null;
}

export async function getReceivableForEdit(
  id: string,
): Promise<ReceivableRow | null> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("receivables")
    .select(
      "id, client_id, client_name_snapshot, document_id, concept, currency, amount_total, issued_at, due_at, notes",
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throwDataAccessError("get receivable for edit", error);
  if (!data) return null;
  const row: ReceivableTableRow = data;
  return { ...row, amount_total: normalizeAmount(row.amount_total) };
}

export async function listReceivablesByClient(
  clientId: string,
): Promise<ReceivableEntry[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(RELATED_RECEIVABLES_LIMIT);

  if (error) throwDataAccessError("list receivables by client", error);
  return mapReceivableEntries(data);
}

export async function listReceivablesByDocument(
  documentId: string,
): Promise<ReceivableEntry[]> {
  const { supabase, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("receivable_entries")
    .select(ENTRY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(RELATED_RECEIVABLES_LIMIT);

  if (error) throwDataAccessError("list receivables by document", error);
  return mapReceivableEntries(data);
}

export async function listReceivableActivity(
  receivableId: string,
): Promise<ReceivableActivityEvent[]> {
  const { supabase, user, workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("receivable_activity")
    .select(
      "id, event_type, metadata, created_at, actor_user_id, actor_name_snapshot, actor_role_snapshot",
    )
    .eq("receivable_id", receivableId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ACTIVITY_LIMIT);

  if (error) throwDataAccessError("list receivable activity", error);

  return (data ?? []).map((row) => {
    const roleLabel =
      ROLE_LABELS[row.actor_role_snapshot as WorkspaceRole] ?? row.actor_role_snapshot;
    return {
      id: row.id,
      event_type: row.event_type,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: row.created_at,
      actor_user_id: row.actor_user_id,
      actorName:
        row.actor_user_id === user.id ? "Tú" : `${row.actor_name_snapshot} (${roleLabel})`,
    };
  });
}
