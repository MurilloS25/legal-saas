import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { listTemplateOptions } from "@/features/templates/server";
import { listClients } from "@/features/clients/server";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Nueva escritura — LexCR",
};

// ------------------------------------------------------------------ helpers

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ------------------------------------------------------------------ page

type Props = {
  searchParams: Promise<{ client?: string }>;
};

export default async function NewDocumentTemplatePickerPage({
  searchParams,
}: Props) {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "documents.create")) {
    redirect("/dashboard/documents");
  }
  const { client: clientParam } = await searchParams;
  const [templates, hasAnyTemplates, clients] = await Promise.all([
    listTemplateOptions({ status: "active" }),
    listTemplateOptions().then((all) => all.length > 0),
    listClients(),
  ]);

  // Solo se conserva un cliente preseleccionado si es propio.
  const selectedClient =
    clientParam != null
      ? (clients.find((c) => c.id === clientParam) ?? null)
      : null;

  // El cliente elegido se propaga al siguiente paso por query param.
  const templateHref = (templateId: string) =>
    selectedClient
      ? `/dashboard/documents/new/${templateId}?client=${selectedClient.id}`
      : `/dashboard/documents/new/${templateId}`;

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Escrituras
        </Link>
      </nav>

      {/* ---- header ---- */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Nueva escritura
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona el machote que servirá de base para la escritura.
        </p>
      </div>

      {selectedClient && (
        <div className="mb-6 rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-3 text-sm text-accent-800">
          Cliente principal:{" "}
          <span className="font-semibold">{selectedClient.full_name}</span>. Se
          asociará a la escritura; podrás cambiarlo antes de guardar.
        </div>
      )}

      {/* ---- empty state ---- */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900 mb-1">
            {hasAnyTemplates
              ? "No tienes machotes activos"
              : "Aún no tienes machotes disponibles"}
          </p>
          <p className="text-xs text-slate-500 mb-6">
            {hasAnyTemplates
              ? "Solo se pueden crear escrituras a partir de machotes activos. Activa un machote desde su edición para poder usarlo."
              : "Para crear una escritura primero necesitas un machote con sus campos configurados."}
          </p>
          <Link
            href={hasAnyTemplates ? "/dashboard/templates" : "/dashboard/templates/new"}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
          >
            {hasAnyTemplates ? "Ver machotes" : "Crear machote"}
          </Link>
        </div>
      ) : (
        /* ---- available templates ---- */
        <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  {template.name}
                </h2>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 shrink-0">
                  {STATUS_LABEL[template.status] ?? template.status}
                </span>
              </div>

              {template.description && (
                <p className="text-xs text-slate-500 leading-relaxed mb-2">
                  {template.description}
                </p>
              )}

              <p className="text-xs text-slate-400 mb-4">
                Actualizado el {formatDate(template.updated_at)}
              </p>

              <div className="mt-auto">
                <Link
                  href={templateHref(template.id)}
                  className="inline-flex items-center rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  Usar este machote
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
