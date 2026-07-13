import { describe, expect, it } from "vitest";
import {
  ACTION_TARGET,
  canTransition,
  DOCUMENT_STATUSES,
  isActionAllowed,
  isDocumentStatus,
  isReadOnlyStatus,
} from "./lifecycle";

describe("canTransition", () => {
  it("allows the forward and backward review steps", () => {
    expect(canTransition("draft", "ready")).toBe(true);
    expect(canTransition("ready", "draft")).toBe(true);
    expect(canTransition("ready", "final")).toBe(true);
    expect(canTransition("final", "ready")).toBe(true);
  });

  it("does not allow draft → final directly", () => {
    expect(canTransition("draft", "final")).toBe(false);
  });

  it("does not allow final → draft directly", () => {
    expect(canTransition("final", "draft")).toBe(false);
  });

  it("does not allow no-op transitions", () => {
    for (const status of DOCUMENT_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});

describe("isReadOnlyStatus", () => {
  it("marks only final as read-only", () => {
    expect(isReadOnlyStatus("final")).toBe(true);
    expect(isReadOnlyStatus("draft")).toBe(false);
    expect(isReadOnlyStatus("ready")).toBe(false);
  });
});

describe("isDocumentStatus", () => {
  it("accepts known statuses and rejects others", () => {
    expect(isDocumentStatus("draft")).toBe(true);
    expect(isDocumentStatus("ready")).toBe(true);
    expect(isDocumentStatus("final")).toBe(true);
    expect(isDocumentStatus("signed")).toBe(false);
    expect(isDocumentStatus("")).toBe(false);
  });
});

describe("isActionAllowed", () => {
  it("maps each action to a legal transition from the current status", () => {
    expect(isActionAllowed("draft", "mark_ready")).toBe(true);
    expect(isActionAllowed("draft", "mark_final")).toBe(false);
    expect(isActionAllowed("ready", "mark_final")).toBe(true);
    expect(isActionAllowed("ready", "return_to_draft")).toBe(true);
    expect(isActionAllowed("final", "reopen")).toBe(true);
    expect(isActionAllowed("final", "mark_ready")).toBe(true);
    // reopen apunta a "ready", alcanzable también desde draft; la UI solo
    // ofrece reopen en final, pero como transición pura draft→ready es válida.
    expect(isActionAllowed("draft", "reopen")).toBe(true);
    // return_to_draft (target draft) NO es válido desde draft ni desde final.
    expect(isActionAllowed("final", "return_to_draft")).toBe(false);
  });

  it("has a target for every action", () => {
    expect(Object.keys(ACTION_TARGET)).toEqual([
      "mark_ready",
      "return_to_draft",
      "mark_final",
      "reopen",
    ]);
  });
});
