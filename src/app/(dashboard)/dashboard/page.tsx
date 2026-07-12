import { PageContainer } from "@/components/layout/PageContainer";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Panel — LexCR",
};

// ------------------------------------------------------------------ module cards config

type ModuleCard = {
  label: string;
  description: string;
  href: string;
  active: true;
} | {
  label: string;
  description: string;
  active: false;
};

const MODULE_CARDS: ModuleCard[] = [
  {
    label: "Clientes",
    description: "Gestión de datos reutilizables de clientes.",
    href: "/dashboard/clients",
    active: true,
  },
  {
    label: "Machotes",
    description: "Plantillas reutilizables de documentos legales.",
    href: "/dashboard/templates",
    active: true,
  },
  {
    label: "Escrituras",
    description: "Crea documentos a partir de tus machotes.",
    href: "/dashboard/documents",
    active: true,
  },
  {
    label: "Configuración",
    description: "Perfil del abogado, fuente, márgenes e interlineado.",
    href: "/dashboard/settings",
    active: true,
  },
  {
    label: "Índice Notarial",
    description: "Preparación de metadata para el índice notarial.",
    active: false,
  },
  {
    label: "Cuentas por Cobrar",
    description: "Control básico de honorarios y cobros pendientes.",
    active: false,
  },
];

// ------------------------------------------------------------------ page

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <PageContainer>
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          {firstName ? `Bienvenido, ${firstName}` : "Panel"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tu workspace legal en un solo lugar.
        </p>
      </div>

      <div className="space-y-8">
        {/* CTA — profile not yet configured */}
        {!isConfigured && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-6 py-6">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
              Primer paso
            </p>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Completa tu perfil para empezar
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Agrega tu nombre, código profesional y la configuración de
              documentos para que el sistema pueda personalizar tus machotes.
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-block rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              Configurar ahora →
            </Link>
          </div>
        )}

        {/* Summary card — shown once profile is configured */}
        {isConfigured && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">
                Tu perfil
              </h2>
              <Link
                href="/dashboard/settings"
                className="text-sm font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus:underline"
              >
                Editar
              </Link>
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500 mb-0.5">Abogado</dt>
                <dd className="font-medium text-slate-900">
                  {profile.full_name}
                </dd>
              </div>

              {profile.professional_code && (
                <div>
                  <dt className="text-slate-500 mb-0.5">Código profesional</dt>
                  <dd className="font-medium text-slate-900">
                    {profile.professional_code}
                  </dd>
                </div>
              )}

              {settings && (
                <>
                  <div>
                    <dt className="text-slate-500 mb-0.5">Fuente</dt>
                    <dd className="font-medium text-slate-900">
                      {settings.font_family} {settings.font_size}pt
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 mb-0.5">Interlineado</dt>
                    <dd className="font-medium text-slate-900">
                      {settings.line_spacing}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Module cards */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Módulos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {MODULE_CARDS.map((card) =>
              card.active ? (
                <Link
                  key={card.label}
                  href={card.href}
                  className="group rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm hover:border-teal-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all"
                >
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 mb-1.5 transition-colors">
                    {card.label}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {card.description}
                  </p>
                </Link>
              ) : (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-100 bg-white px-5 py-5"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-sm font-semibold text-slate-400">
                      {card.label}
                    </h3>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 ml-2 shrink-0">
                      Pronto
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
