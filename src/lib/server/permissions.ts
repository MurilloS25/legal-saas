/**
 * Matriz de permisos por rol de Workspace (Iteración 5). Diseñada en
 * docs/WORKSPACE_MULTIUSER_ARCHITECTURE.md §5.2, implementada aquí como
 * capa de defensa adicional a RLS/RPCs — la autorización real vive en la
 * base de datos; esto solo evita mostrar/permitir acciones que la base
 * rechazaría, con un mensaje más útil que un error genérico de Postgres.
 */

export type WorkspaceRole =
  | "propietario"
  | "administrador"
  | "asistente"
  | "solo_lectura";

export type Permission =
  | "clients.read"
  | "clients.write"
  | "templates.read"
  | "templates.write"
  | "documents.create"
  | "documents.edit"
  | "documents.export"
  | "documents.finalize"
  | "notarial_index.generate"
  | "receivables.manage"
  | "payments.register"
  | "payments.void"
  | "members.manage"
  | "settings.manage";

const ROLES_BY_PERMISSION: Record<Permission, readonly WorkspaceRole[]> = {
  "clients.read": ["propietario", "administrador", "asistente", "solo_lectura"],
  "clients.write": ["propietario", "administrador", "asistente"],
  "templates.read": ["propietario", "administrador", "asistente", "solo_lectura"],
  "templates.write": ["propietario", "administrador", "asistente"],
  "documents.create": ["propietario", "administrador", "asistente"],
  "documents.edit": ["propietario", "administrador", "asistente"],
  "documents.export": ["propietario", "administrador", "asistente", "solo_lectura"],
  "documents.finalize": ["propietario", "administrador"],
  "notarial_index.generate": ["propietario", "administrador"],
  "receivables.manage": ["propietario", "administrador", "asistente"],
  "payments.register": ["propietario", "administrador", "asistente"],
  "payments.void": ["propietario", "administrador"],
  "members.manage": ["propietario", "administrador"],
  "settings.manage": ["propietario", "administrador"],
};

export function hasPermission(
  role: WorkspaceRole,
  permission: Permission,
): boolean {
  return ROLES_BY_PERMISSION[permission].includes(role);
}

/** Roles que member.manage puede asignar por invitación (nunca "propietario"). */
export const INVITABLE_ROLES: readonly WorkspaceRole[] = [
  "administrador",
  "asistente",
  "solo_lectura",
];

/** Etiquetas legibles para mostrar en UI ("Mi equipo", invitaciones, etc.). */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  propietario: "Propietario/Notario",
  administrador: "Administrador",
  asistente: "Asistente",
  solo_lectura: "Solo lectura",
};

/**
 * ¿Puede `callerRole` gestionar (invitar/cambiar rol/suspender/remover) a
 * un miembro con `targetRole`? Mismo espejo de `assert_can_manage_target_member`
 * en la base de datos — el propietario es inmutable, y un administrador no
 * puede gestionar a otro administrador ni al propietario.
 */
export function canManageMember(
  callerRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): boolean {
  if (targetRole === "propietario") return false;
  if (callerRole === "administrador" && targetRole === "administrador") {
    return false;
  }
  return callerRole === "propietario" || callerRole === "administrador";
}
