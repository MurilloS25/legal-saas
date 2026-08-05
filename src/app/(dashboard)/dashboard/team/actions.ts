"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, INVITABLE_ROLES } from "@/lib/server/permissions";
import { InviteMemberSchema } from "@/lib/validations/team";

export type InviteMemberState = {
  errors?: {
    email?: string;
    role?: string;
  };
  message?: string;
  success?: boolean;
};

async function resolveSiteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Invita a un colaborador por correo. Primero crea (o reutiliza) la cuenta
 * en auth.users vía la Admin API (service role — solo aquí, nunca en el
 * cliente) y envía el correo de invitación; solo si eso tiene éxito llama a
 * `invite_workspace_member`, que valida rol/jerarquía y registra la
 * membresía 'invited' y la auditoría. Si el correo ya tiene cuenta,
 * `inviteUserByEmail` falla y se muestra ese error tal cual — no hay
 * fallback para "adjuntar" una cuenta existente a este Workspace.
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

  if (inviteError || !invited?.user) {
    return {
      message:
        inviteError?.code === "email_exists"
          ? "Ese correo ya tiene una cuenta en LexCR."
          : "No fue posible enviar la invitación. Intenta de nuevo.",
    };
  }

  const { error: membershipError } = await supabase.rpc(
    "invite_workspace_member",
    { p_user_id: invited.user.id, p_role: result.data.role },
  );

  if (membershipError) {
    return {
      message:
        membershipError.code === "42501"
          ? "No puedes asignar ese rol."
          : "No fue posible registrar la invitación. Intenta de nuevo.",
    };
  }

  revalidatePath("/dashboard/team");
  return { success: true, message: "Invitación enviada." };
}

export type TeamMemberActionState = {
  message?: string;
};

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
  return {};
}
