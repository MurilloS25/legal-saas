import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile and settings to show a contextual dashboard.
  const [profileResult, settingsResult] = await Promise.all([
    supabase
      .from("lawyer_profiles")
      .select("full_name, professional_code")
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("document_settings")
      .select("font_family, font_size, line_spacing")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  const settings = settingsResult.data;
  const isConfigured = !!profile;

  async function logoutAction() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile?.full_name ?? user.email}
          </p>
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

      <div className="space-y-6">
        {/* CTA — only shown when profile has not been set up yet */}
        {!isConfigured && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-6 py-6">
            <p className="text-sm font-medium text-teal-700 mb-1">
              Primer paso
            </p>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Completa tu perfil para empezar
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Agrega tu nombre, código profesional y configuración de documentos
              para que el sistema pueda personalizar tus machotes.
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Configurar ahora
            </Link>
          </div>
        )}

        {/* Summary — shown once profile is configured */}
        {isConfigured && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Tu configuración
              </h2>
              <Link
                href="/dashboard/settings"
                className="text-sm text-teal-600 hover:text-teal-700 focus:outline-none focus:underline"
              >
                Editar
              </Link>
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Abogado</dt>
                <dd className="font-medium text-slate-900">
                  {profile.full_name}
                </dd>
              </div>

              {profile.professional_code && (
                <div>
                  <dt className="text-slate-500">Código</dt>
                  <dd className="font-medium text-slate-900">
                    {profile.professional_code}
                  </dd>
                </div>
              )}

              {settings && (
                <>
                  <div>
                    <dt className="text-slate-500">Fuente</dt>
                    <dd className="font-medium text-slate-900">
                      {settings.font_family} {settings.font_size}pt
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Interlineado</dt>
                    <dd className="font-medium text-slate-900">
                      {settings.line_spacing}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        )}

        {/* System status */}
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="text-sm font-medium text-teal-600 uppercase tracking-wide mb-2">
            Estado del sistema
          </p>
          <p className="text-slate-500 text-sm leading-relaxed">
            La base del sistema está lista. Los módulos de clientes, machotes,
            índice y cobros se implementarán en las próximas iteraciones.
          </p>
        </div>
      </div>
    </main>
  );
}
