"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { createAdminClient, findUserIdByEmail } from "@/lib/supabase/admin";
import { hasPermission, INVITABLE_ROLES } from "@/lib/server/permissions";
import { InviteMemberSchema } from "../model/team-validation";
import type {
  InviteMemberState,
  TeamMemberActionState,
} from "../model/action-state";

async function resolveSiteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Invita a un colaborador por correo.
 *
 * Caso normal (correo nuevo): crea la cuenta en auth.users vía la Admin
 * API (service role — solo aquí, nunca en el cliente) y envía el correo de
 * invitación real.
 *
 * Caso re-invitación (correo YA tiene cuenta — p. ej. un miembro removido
 * de otro Workspace, o de este mismo tiempo atrás): `inviteUserByEmail`
 * responde `email_exists` porque no está pensado para reenviar el correo a
 * alguien ya confirmado. En ese caso se resuelve el id existente por email
 * y se llama a `invite_workspace_member` directamente, sin enviar correo
 * nuevo — la persona ya tiene contraseña, así que basta con que inicie
 * sesión normalmente: `requireWorkspace()` detecta su fila 'invited' y la
 * manda sola a /accept-invite.
 *
 * En ambos casos, solo si la cuenta queda resuelta se llama a
 * `invite_workspace_member`, que valida rol/jerarquía y registra la
 * membresía 'invited' y la auditoría.
 */
export async function inviteMemberAction(
  _prevState: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const { supabase, role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    return { message: "No tienes permiso para invitar miembros." };
  }

  const result = InviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      errors: {
        email: fieldErrors.email?.[0],
        role: fieldErrors.role?.[0],
      },
    };
  }

  const admin = createAdminClient();
  const origin = await resolveSiteOrigin();

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(result.data.email, {
      redirectTo: `${origin}/accept-invite`,
    });

  let targetUserId = invited?.user?.id ?? null;
  let emailSent = !inviteError && !!targetUserId;

  if (inviteError?.code === "email_exists") {
    targetUserId = await findUserIdByEmail(result.data.email);
    emailSent = false;
  }

  if (!targetUserId) {
    return { message: "No fue posible enviar la invitación. Intenta de nuevo." };
  }

  const { error: membershipError } = await supabase.rpc(
    "invite_workspace_member",
    { p_user_id: targetUserId, p_role: result.data.role },
  );

  if (membershipError) {
    return {
      message:
        membershipError.code === "23505"
          ? "Ese correo ya es miembro de este Workspace."
          : membershipError.code === "42501"
            ? "No puedes asignar ese rol."
            : "No fue posible registrar la invitación. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/settings");
  return {
    success: true,
    message: emailSent
      ? "Invitación enviada."
      : "Invitación registrada: este correo ya tiene cuenta en LexCR — podrá aceptarla la próxima vez que inicie sesión.",
  };
}

/**
 * Cambia el rol de un miembro. La jerarquía (propietario inmutable, un
 * administrador no gestiona a otro administrador) la valida
 * `change_workspace_member_role` en base de datos — este Server Action solo
 * evita la llamada cuando ya sabemos que fallará, para un mensaje más útil.
 */
export async function changeMemberRoleAction(
  targetUserId: string,
  _prevState: TeamMemberActionState,
  formData: FormData,
): Promise<TeamMemberActionState> {
  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    return { message: "No tienes permiso para gestionar miembros." };
  }

  const nextRole = formData.get("role");
  if (
    typeof nextRole !== "string" ||
    !INVITABLE_ROLES.includes(nextRole as (typeof INVITABLE_ROLES)[number])
  ) {
    return { message: "Rol no válido." };
  }

  const { error } = await supabase.rpc("change_workspace_member_role", {
    p_workspace_id: workspaceId,
    p_user_id: targetUserId,
    p_role: nextRole,
  });

  if (error) {
    return { message: "No fue posible cambiar el rol de este miembro." };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/settings");
  return {};
}

export async function suspendMemberAction(
  targetUserId: string,
  _prevState: TeamMemberActionState,
  _formData: FormData,
): Promise<TeamMemberActionState> {
  void _prevState;
  void _formData;

  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    return { message: "No tienes permiso para gestionar miembros." };
  }

  const { error } = await supabase.rpc("suspend_workspace_member", {
    p_workspace_id: workspaceId,
    p_user_id: targetUserId,
  });

  if (error) {
    return { message: "No fue posible suspender a este miembro." };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/settings");
  return {};
}

export async function reactivateMemberAction(
  targetUserId: string,
  _prevState: TeamMemberActionState,
  _formData: FormData,
): Promise<TeamMemberActionState> {
  void _prevState;
  void _formData;

  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    return { message: "No tienes permiso para gestionar miembros." };
  }

  const { error } = await supabase.rpc("reactivate_workspace_member", {
    p_workspace_id: workspaceId,
    p_user_id: targetUserId,
  });

  if (error) {
    return { message: "No fue posible reactivar a este miembro." };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/settings");
  return {};
}

/**
 * Remueve la membresía. No borra la auditoría — remove_workspace_member
 * registra el evento ANTES de eliminar la fila de workspace_members (ver
 * comentario en la migración), así el historial de actividad sigue
 * mostrando lo que hizo mientras fue miembro.
 */
export async function removeMemberAction(
  targetUserId: string,
  _prevState: TeamMemberActionState,
  _formData: FormData,
): Promise<TeamMemberActionState> {
  void _prevState;
  void _formData;

  const { supabase, workspaceId, role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    return { message: "No tienes permiso para gestionar miembros." };
  }

  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: workspaceId,
    p_user_id: targetUserId,
  });

  if (error) {
    return { message: "No fue posible remover a este miembro." };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/settings");
  return {};
}
