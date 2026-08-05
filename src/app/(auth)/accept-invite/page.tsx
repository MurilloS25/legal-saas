import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./AcceptInviteForm";

// Server Component: igual que /update-password, verifica ANTES de mostrar
// el formulario — un enlace de invitación vencido o ya usado debe mostrar
// un mensaje claro, no un redirect silencioso. No vive bajo
// PRIVATE_ROUTE_PREFIXES ni AUTH_ROUTES en proxy.ts por la misma razón.
export default async function AcceptInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pending = user
    ? (
        await supabase.rpc("get_pending_workspace_invitation").maybeSingle()
      ).data
    : null;

  if (!user || !pending) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Invitación no válida o expirada
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Pide a quien te invitó que te envíe un nuevo enlace.
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

  return (
    <AcceptInviteForm
      workspaceName={pending.workspace_name}
      role={pending.role}
    />
  );
}
