import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ role: "propietario", version: 1, update: vi.fn(), from: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ requireWorkspace: async () => ({ supabase: db, user: { id: "owner" }, workspaceId: "workspace", role: db.role }) }));
import { confirmNotarialMetadataAction, startNotarialCorrectionAction } from "./confirmation-actions";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks(); db.role = "propietario"; db.version = 1;
  db.from.mockImplementation(() => {
    let expected: number | undefined;
    let updating = false;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { if (key === "version") expected = Number(value); return query; },
      is: () => query, not: () => query,
      update: (patch: unknown) => { db.update(patch); updating = true; return query; },
      maybeSingle: async () => ({ error: null, data: updating ? (expected === db.version ? { id, version: db.version + 1 } : null) : {
        version: db.version, instrument_number: 1, authorized_at: "2026-09-10T10:00:00Z",
        protocol_book: "1", initial_folio: "1F", final_folio: "1V", act_name_override: "Acto", parties_override: "Partes", notarial_confirmed_at: null,
      } }),
    };
    return query;
  });
});
it("confirms the expected persisted version", async () => {
  expect(await confirmNotarialMetadataAction(id, 1)).toMatchObject({ success: true, version: 2 });
});
it("does not validate and update different versions", async () => {
  db.update.mockImplementationOnce(() => { db.version = 2; });
  expect((await confirmNotarialMetadataAction(id, 2)).success).not.toBe(true);
  expect(db.update).not.toHaveBeenCalled();
});
it("rejects a version changed after validation", async () => {
  db.update.mockImplementationOnce(() => { db.version = 2; });
  expect((await confirmNotarialMetadataAction(id, 1)).success).not.toBe(true);
});
it.each([0, -1, NaN, 1.5])("rejects invalid version %s without writing", async version => {
  expect((await confirmNotarialMetadataAction(id, version)).success).not.toBe(true);
  expect(db.update).not.toHaveBeenCalled();
});
it("denies confirmation and correction to read-only members", async () => {
  db.role = "solo_lectura";
  expect((await confirmNotarialMetadataAction(id, 1)).success).not.toBe(true);
  expect((await startNotarialCorrectionAction(id, 1)).success).not.toBe(true);
  expect(db.from).not.toHaveBeenCalled();
});
