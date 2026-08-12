import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, findUserIdByEmail } from "@/lib/supabase/admin";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { ConfirmInviteForm } from "./ConfirmInviteForm";

type InvalidStateProps = {
  title: string;
  message: string;
};

function InvalidState({ title, message }: InvalidStateProps) {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          {message}
        </p>
        <p className="mt-6 text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-accent-600 hover:text-accent-700 focus:outline-none focus:underline"
          >
            Ir a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

type Props = {
  searchParams: Promise<{ token_hash?: string; email?: string }>;
};

// Server Component: igual que /update-password, verifica ANTES de mostrar
// el formulario — un enlace de invitación vencido o ya usado debe mostrar
// un mensaje claro, no un redirect silencioso. No vive bajo
// PRIVATE_ROUTE_PREFIXES ni AUTH_ROUTES en proxy.ts por la misma razón.
//
// Esta página atiende DOS casos distintos:
//
// A) Enlace fresco del correo (?token_hash&email, sin sesión): el token
//    NO se consume aquí — un GET no debe tener efectos secundarios (ver
//    src/app/auth/confirm/route.ts para el porqué). Solo se previsualiza
//    la invitación (Workspace, correo, rol) leyendo workspace_members
//    directamente por email vía la Admin API — sin tocar el token de
//    Supabase — y se muestra un botón; verifyOtp + la aceptación real
//    ocurren únicamente en el POST de ConfirmInviteForm.
//
// B) Un usuario que YA tiene sesión (inició sesión normal, sin pasar por
//    el enlace) y tiene una fila 'invited' pendiente — p. ej. alguien
//    reinvitado que ya tenía contraseña, ver team/actions.ts. Aquí no hay
//    token que proteger: se reusa el flujo existente (sin cambios).
export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token_hash, email } = await searchParams;

  if (token_hash && email) {
    const userId = await findUserIdByEmail(email);
    const pending = userId ? await lookupPendingInvite(userId) : null;

    if (!pending) {
      return (
        <InvalidState
          title="Invitación no válida o expirada"
          message="Pide a quien te invitó que te envíe un nuevo enlace."
        />
      );
    }

    if (pending.status === "active") {
      return (
        <InvalidState
          title="Esta invitación ya fue aceptada"
          message="Ya formas parte de este Workspace. Inicia sesión normalmente."
        />
      );
    }

    if (pending.status === "revoked") {
      return (
        <InvalidState
          title="Esta invitación fue revocada"
          message="Pide a quien te invitó que te envíe una nueva invitación."
        />
      );
    }

    return (
      <ConfirmInviteForm
        tokenHash={token_hash}
        email={email}
        workspaceName={pending.workspaceName}
        role={pending.role}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authedPending = user
    ? (
        await supabase.rpc("get_pending_workspace_invitation").maybeSingle()
      ).data
    : null;

  if (!user || !authedPending) {
    return (
      <InvalidState
        title="Invitación no válida o expirada"
        message="Pide a quien te invitó que te envíe un nuevo enlace."
      />
    );
  }

  return (
    <AcceptInviteForm
      workspaceName={authedPending.workspace_name}
      role={authedPending.role}
    />
  );
}

type PendingPreview = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  status: string;
};

// Previsualización de solo lectura, sin tocar el token de Supabase: busca
// la fila de workspace_members más reciente que NO sea el Workspace propio
// (bootstrap, ver getWorkspaceAccess en lib/server/auth.ts) para este
// usuario — es la invitación real a la que se refiere este correo. Usa el
// cliente con service role porque, en el caso A, todavía no hay sesión y
// RLS bloquearía cualquier lectura.
async function lookupPendingInvite(
  userId: string,
): Promise<PendingPreview | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("workspace_members")
    .select("workspace_id, role, status")
    .eq("user_id", userId)
    .neq("workspace_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", row.workspace_id)
    .maybeSingle();

  if (!workspace) return null;

  return {
    workspaceId: row.workspace_id,
    workspaceName: workspace.name,
    role: row.role,
    status: row.status,
  };
}
