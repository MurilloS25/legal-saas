import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
//    NO se consume aquí — un GET no debe tener efectos secundarios. Antes
//    de verificarlo tampoco se consulta información privilegiada por email:
//    un token inválido solo obtiene una pantalla genérica. verifyOtp + la
//    aceptación real ocurren únicamente en el POST de ConfirmInviteForm.
//
// B) Un usuario que YA tiene sesión (inició sesión normal, sin pasar por
//    el enlace) y tiene una fila 'invited' pendiente — p. ej. alguien
//    reinvitado que ya tenía contraseña, ver team/actions.ts. Aquí no hay
//    token que proteger: se reusa el flujo existente (sin cambios).
export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token_hash, email } = await searchParams;

  if (token_hash && email) {
    return <ConfirmInviteForm tokenHash={token_hash} email={email} />;
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
