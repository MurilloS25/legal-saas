import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  beforeUpdate: undefined as (() => void) | undefined,
  version: 1,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./client-actions", () => ({ resolveOptionalClientId: async () => ({ clientId: null }) }));
vi.mock("@/lib/server/auth", () => ({
  requireWorkspace: async () => ({
    workspaceId: "workspace", role: "propietario",
    supabase: { from(table: string) {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      let patch: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
        neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return query; },
        update: (value: Record<string, unknown>) => { patch = value; return query; },
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => {
          if (table === "templates") return { data: { content_json: { text: "Texto fijo." } }, error: null };
          if (patch) {
            db.beforeUpdate?.();
            db.beforeUpdate = undefined;
          }
          if (!filters.every(filter => filter(db.row))) return { data: null, error: null };
          if (patch) Object.assign(db.row, patch, { updated_at: `2026-09-09T00:00:0${++db.version}.000Z` });
          return { data: { ...db.row }, error: null };
        },
      };
      return query;
    } },
  }),
}));

import { updateDocumentDraftAction } from "./content-actions";
import { markDocumentFinalAction } from "./lifecycle-actions";

const id = "00000000-0000-4000-8000-000000000001";
const originalVersion = "2026-09-09T00:00:01.000Z";
function form(title = "Edición A", version = originalVersion) {
  const data = new FormData();
  data.set("title", title);
  data.set("expected_updated_at", version);
  return data;
}
beforeEach(() => {
  db.version = 1;
  db.beforeUpdate = undefined;
  db.row = { id, workspace_id: "workspace", template_id: id, title: "Original", status: "draft", field_values: {}, option_selections: {}, updated_at: originalVersion };
});

describe("document save concurrency", () => {
  it("rejects the second snapshot and accepts an explicitly refreshed version", async () => {
    const first = await updateDocumentDraftAction(id, {}, form());
    expect(first.success).toBe(true);
    expect(first.updatedAt).toBe(db.row.updated_at);
    expect(first.updatedAt).not.toBe(originalVersion);
    const second = await updateDocumentDraftAction(id, {}, form("Edición B"));
    expect(second.success).not.toBe(true);
    expect(second.message).toMatch(/cambió|conflicto/i);
    expect(db.row.title).toBe("Edición A");
    const retry = await updateDocumentDraftAction(id, {}, form("Edición B", String(db.row.updated_at)));
    expect(retry.success).toBe(true);
    expect(db.row.title).toBe("Edición B");
  });
  it("rejects missing or malformed versions without changing content", async () => {
    for (const version of ["", "not-a-timestamp"]) {
      expect((await updateDocumentDraftAction(id, {}, form("Edición B", version))).success).not.toBe(true);
    }
    expect(db.row.title).toBe("Original");
  });
  it("does not finalize content changed after validation", async () => {
    db.beforeUpdate = () => Object.assign(db.row, { title: "Otra edición", updated_at: "2026-09-09T00:00:02.000Z" });
    const result = await markDocumentFinalAction(id, {}, form());
    expect(result.success).not.toBe(true);
    expect(result.message).toMatch(/cambió|conflicto/i);
    expect(db.row.status).toBe("draft");
  });
  it("rejects a save changed between loading and updating, preserving the concurrent edit", async () => {
    db.beforeUpdate = () => Object.assign(db.row, { title: "Edición concurrente", updated_at: "2026-09-09T00:00:02.000Z" });
    const result = await updateDocumentDraftAction(id, {}, form());
    expect(result.success).not.toBe(true);
    expect(result.conflictUpdatedAt).toBe(db.row.updated_at);
    expect(db.row.title).toBe("Edición concurrente");
  });
  it("cannot save content after a concurrent finalization", async () => {
    db.beforeUpdate = () => Object.assign(db.row, { status: "final", updated_at: "2026-09-09T00:00:02.000Z" });
    const result = await updateDocumentDraftAction(id, {}, form());
    expect(result.success).not.toBe(true);
    expect(result.conflictUpdatedAt).toBeUndefined();
    expect(db.row.title).toBe("Original");
  });
  it("finalizes an unchanged validated snapshot", async () => {
    expect((await markDocumentFinalAction(id, {}, form())).success).toBe(true);
    expect(db.row.status).toBe("final");
  });
});
