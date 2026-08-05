import { describe, expect, it } from "vitest";
import {
  canManageMember,
  hasPermission,
  INVITABLE_ROLES,
  ROLE_LABELS,
  type WorkspaceRole,
} from "./permissions";

const ALL_ROLES: WorkspaceRole[] = [
  "propietario",
  "administrador",
  "asistente",
  "solo_lectura",
];

describe("hasPermission", () => {
  it("lets every role read clients and templates", () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, "clients.read")).toBe(true);
      expect(hasPermission(role, "templates.read")).toBe(true);
    }
  });

  it("lets every role export the Escritura DOCX (read-tier, not sensitive)", () => {
    for (const role of ALL_ROLES) {
      expect(hasPermission(role, "documents.export")).toBe(true);
    }
  });

  it("blocks solo_lectura from any write permission", () => {
    expect(hasPermission("solo_lectura", "clients.write")).toBe(false);
    expect(hasPermission("solo_lectura", "templates.write")).toBe(false);
    expect(hasPermission("solo_lectura", "documents.create")).toBe(false);
    expect(hasPermission("solo_lectura", "documents.edit")).toBe(false);
    expect(hasPermission("solo_lectura", "receivables.manage")).toBe(false);
    expect(hasPermission("solo_lectura", "payments.register")).toBe(false);
  });

  it("lets asistente create/edit drafts but not finalize or generate the índice", () => {
    expect(hasPermission("asistente", "documents.create")).toBe(true);
    expect(hasPermission("asistente", "documents.edit")).toBe(true);
    expect(hasPermission("asistente", "clients.write")).toBe(true);
    expect(hasPermission("asistente", "templates.write")).toBe(true);
    expect(hasPermission("asistente", "receivables.manage")).toBe(true);
    expect(hasPermission("asistente", "payments.register")).toBe(true);

    expect(hasPermission("asistente", "documents.finalize")).toBe(false);
    expect(hasPermission("asistente", "notarial_index.generate")).toBe(false);
    expect(hasPermission("asistente", "payments.void")).toBe(false);
    expect(hasPermission("asistente", "members.manage")).toBe(false);
    expect(hasPermission("asistente", "settings.manage")).toBe(false);
  });

  it("restricts finalize/void/members/settings to propietario and administrador", () => {
    const sensitivePermissions = [
      "documents.finalize",
      "notarial_index.generate",
      "payments.void",
      "members.manage",
      "settings.manage",
    ] as const;

    for (const permission of sensitivePermissions) {
      expect(hasPermission("propietario", permission)).toBe(true);
      expect(hasPermission("administrador", permission)).toBe(true);
      expect(hasPermission("asistente", permission)).toBe(false);
      expect(hasPermission("solo_lectura", permission)).toBe(false);
    }
  });
});

describe("INVITABLE_ROLES", () => {
  it("never includes propietario", () => {
    expect(INVITABLE_ROLES).not.toContain("propietario");
  });

  it("includes administrador, asistente and solo_lectura", () => {
    expect(INVITABLE_ROLES).toEqual(
      expect.arrayContaining(["administrador", "asistente", "solo_lectura"]),
    );
  });
});

describe("ROLE_LABELS", () => {
  it("has a label for every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

describe("canManageMember", () => {
  it("makes propietario immutable regardless of caller", () => {
    for (const callerRole of ALL_ROLES) {
      expect(canManageMember(callerRole, "propietario")).toBe(false);
    }
  });

  it("lets propietario manage administrador/asistente/solo_lectura", () => {
    expect(canManageMember("propietario", "administrador")).toBe(true);
    expect(canManageMember("propietario", "asistente")).toBe(true);
    expect(canManageMember("propietario", "solo_lectura")).toBe(true);
  });

  it("blocks administrador from managing another administrador", () => {
    expect(canManageMember("administrador", "administrador")).toBe(false);
  });

  it("lets administrador manage asistente and solo_lectura", () => {
    expect(canManageMember("administrador", "asistente")).toBe(true);
    expect(canManageMember("administrador", "solo_lectura")).toBe(true);
  });

  it("blocks asistente and solo_lectura from managing anyone", () => {
    for (const targetRole of ALL_ROLES) {
      expect(canManageMember("asistente", targetRole)).toBe(false);
      expect(canManageMember("solo_lectura", targetRole)).toBe(false);
    }
  });
});
