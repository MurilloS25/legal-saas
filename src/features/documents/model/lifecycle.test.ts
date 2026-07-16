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
  it("allows the simplified draft and final lifecycle", () => {
    expect(canTransition("draft", "ready")).toBe(true);
    expect(canTransition("draft", "final")).toBe(true);
    expect(canTransition("ready", "draft")).toBe(true);
    expect(canTransition("ready", "final")).toBe(true);
    expect(canTransition("final", "draft")).toBe(true);
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
    expect(isActionAllowed("draft", "mark_final")).toBe(true);
    expect(isActionAllowed("ready", "mark_final")).toBe(true);
    expect(isActionAllowed("ready", "return_to_draft")).toBe(true);
    expect(isActionAllowed("final", "reopen")).toBe(true);
    // Cada action tiene un origen específico: no basta con que el destino sea
    // una transición válida. Esto protege llamadas directas a Server Actions.
    expect(isActionAllowed("final", "mark_ready")).toBe(false);
    expect(isActionAllowed("draft", "reopen")).toBe(false);
    expect(isActionAllowed("final", "return_to_draft")).toBe(false);
  });

  it("has a target for every action", () => {
    expect(Object.keys(ACTION_TARGET)).toEqual([
      "mark_ready",
      "return_to_draft",
      "mark_final",
      "reopen",
    ]);
    expect(ACTION_TARGET.reopen).toBe("draft");
  });
});
