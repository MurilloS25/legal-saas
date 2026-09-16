import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceAccess } from "@/lib/server/auth";
import { workspaceUnavailableLogoutAction } from "./actions";
import { DataAccessError } from "@/lib/server/errors";

// Server Component: nunca confía en cómo llegó aquí (¿redirect de
// requireWorkspace()? ¿enlace guardado?) — vuelve a resolver el estado por
// su cuenta, igual que /update-password y /accept-invite. Si el estado
// real ya cambió (p. ej. el propietario lo reactivó mientras esta pestaña
// seguía abierta), redirige al lugar correcto en vez de mostrar un mensaje
// obsoleto.
export default async function WorkspaceUnavailablePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      `[data-access] authenticate workspace access failed (${userError.code ?? "unknown"})`,
    );
    return <WorkspaceAccessLoadError />;
  }

  if (!user) redirect("/login");

  let access;
  try {
    access = await getWorkspaceAccess(supabase, user.id);
  } catch (error) {
    if (error instanceof DataAccessError) {
      return <WorkspaceAccessLoadError />;
    }
    throw error;
  }

  if (access.kind === "active") redirect("/dashboard");
  if (access.kind === "invited") redirect("/accept-invite");

  const isSuspended = access.kind === "suspended";

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          {isSuspended
            ? "Su acceso a este espacio de trabajo fue suspendido"
            : "Ya no tiene acceso a ningún espacio de trabajo"}
        </h1>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          {isSuspended ? (
            <>
              Su cuenta continúa activa, pero el propietario de la oficina
              suspendió su acceso temporalmente.
            </>
          ) : (
            <>
              Su cuenta continúa activa, pero actualmente no pertenece a
              ninguna oficina.
            </>
          )}
          <br />
          Contacte al propietario de la oficina si considera que esto es un
          error.
        </p>

        <form action={workspaceUnavailableLogoutAction} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

function WorkspaceAccessLoadError() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-red-200 bg-white px-8 py-10 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          No fue posible verificar su espacio de trabajo
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          No se interpretó este problema como una cuenta sin acceso. Intente
          nuevamente cuando el servicio esté disponible.
        </p>
      </div>
    </div>
  );
}
