import { describe, expect, it } from "vitest";
import { matchesPersistedNotarialSnapshot } from "./confirmation-snapshot";
import type { NotarialMetadata } from "./notarial";

const persisted = {
  instrument_number: 1, authorized_at: "2026-09-10T16:00:00Z",
  protocol_book: "01", initial_folio: "1F", final_folio: "1V",
  act_name_override: null, act_name_snapshot: "Acto",
  parties_override: null, generated_parties: "Partes", notes: "Nota",
  version: 1,
} as NotarialMetadata;
const visible = { ...persisted, authorized_at: "2026-09-10T10:00", act_name_override: "Acto", parties_override: "" };

describe("confirmation snapshot", () => {
  it("accepts the persisted values with Costa Rica time and displayed fallbacks", () => {
    expect(matchesPersistedNotarialSnapshot(visible, persisted)).toBe(true);
  });
  it("requires a persisted snapshot", () => {
    expect(matchesPersistedNotarialSnapshot(visible, null)).toBe(false);
  });
  it("detects a partially entered date even without a complete timestamp", () => {
    expect(matchesPersistedNotarialSnapshot(
      { ...visible, authorized_at: "", authorizedDate: "2026-09-10", authorizedTime: "" },
      { ...persisted, authorized_at: null },
    )).toBe(false);
  });
  it.each([
    ["instrument_number", 2], ["authorized_at", "2026-09-10T11:00"],
    ["protocol_book", "02"], ["initial_folio", "2F"], ["final_folio", "2V"],
    ["act_name_override", "Otro acto"], ["parties_override", "Otras partes"], ["notes", "Otra nota"],
  ])("rejects an unsaved change to %s", (key, value) => {
    expect(matchesPersistedNotarialSnapshot({ ...visible, [key]: value }, persisted)).toBe(false);
  });
});
