import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  // getUser() validates the JWT with the Supabase Auth server — safe for server-side protection.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function logoutAction() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Panel</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
        <p className="text-sm font-medium text-teal-600 uppercase tracking-wide mb-3">
          Estado del sistema
        </p>
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          La base del sistema está lista.
        </h2>
        <p className="text-slate-500 leading-relaxed">
          Los módulos de clientes, machotes, índice y cobros se implementarán
          en las próximas iteraciones.
        </p>
      </div>
    </main>
  );
}
