import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveDocumentSettingsAction,
  saveProfileAction,
} from "./settings-actions";

const db = vi.hoisted(() => ({
  from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(),
  maybeSingle: vi.fn(), insert: vi.fn(), upsert: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({
  requireWorkspace: async () => ({
    supabase: db, user: { id: "administrator" }, workspaceId: "workspace", role: "administrador",
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  db.from.mockReturnValue(db);
  db.update.mockReturnValue(db);
  db.eq.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.maybeSingle.mockResolvedValue({ data: { id: "existing" }, error: null });
  db.insert.mockResolvedValue({ error: null });
  db.upsert.mockResolvedValue({ error: null });
});

describe.each([
  { name: "profile", table: "lawyer_profiles", action: saveProfileAction,
    values: { full_name: "Despacho de prueba" } },
  { name: "document settings", table: "document_settings", action: saveDocumentSettingsAction,
    values: { font_family: "Arial", font_size: "12", margin_top_cm: "2", margin_bottom_cm: "2",
      margin_left_cm: "2", margin_right_cm: "2", line_spacing: "1.5" } },
])("$name provenance", ({ table, action, values }) => {
  function form() {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    return data;
  }
  it("updates an existing workspace row without assigning its creator to the actor", async () => {
    expect((await action({}, form())).success).toBe(true);
    expect(db.from).toHaveBeenCalledWith(table);
    expect(db.update).toHaveBeenCalledOnce();
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("owner_id");
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("workspace_id");
    expect(db.eq).toHaveBeenCalledWith("workspace_id", "workspace");
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });
  it("sets provenance only when creating a missing workspace row", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await action({}, form())).success).toBe(true);
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: "administrator", workspace_id: "workspace",
    }));
  });
  it("does not insert or report success after an update error", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await action({}, form())).success).not.toBe(true);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("reports a concurrent initial insert conflict without replacing provenance", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    db.insert.mockResolvedValue({ error: { code: "23505" } });
    expect((await action({}, form())).success).not.toBe(true);
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
