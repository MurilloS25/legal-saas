import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArrowRightIcon, StackIcon } from "@/app/(dashboard)/_components/icons";
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
          className="inline-flex items-center gap-1.5 text-xs text-ink-500 transition-colors hover:text-ink-700 focus:outline-none focus-visible:underline"
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Nueva escritura
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Selecciona el machote que servirá de base para la escritura.
        </p>
      </div>

      {selectedClient && (
        <div className="mb-6 rounded-lg border border-accent-200 bg-accent-50/60 px-4 py-3 text-sm text-accent-800 animate-fade-in">
          Cliente principal:{" "}
          <span className="font-semibold">{selectedClient.full_name}</span>. Se
          asociará a la escritura; podrás cambiarlo antes de guardar.
        </div>
      )}

      {/* ---- empty state ---- */}
      {templates.length === 0 ? (
        <EmptyState
          icon={<StackIcon className="size-5" />}
          title={
            hasAnyTemplates
              ? "No tienes machotes activos"
              : "Aún no tienes machotes disponibles"
          }
          description={
            hasAnyTemplates
              ? "Solo se pueden crear escrituras a partir de machotes activos. Activa un machote desde su edición para poder usarlo."
              : "Para crear una escritura primero necesitas un machote con sus campos configurados."
          }
          action={
            <Link
              href={hasAnyTemplates ? "/dashboard/templates" : "/dashboard/templates/new"}
              className="press-feedback inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
            >
              {hasAnyTemplates ? "Ver machotes" : "Crear machote"}
            </Link>
          }
        />
      ) : (
        /* ---- available templates ---- */
        <ul role="list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-stagger-in">
          {templates.map((template) => (
            <li key={template.id}>
              <Card interactive={false} className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h2 className="text-sm font-semibold text-ink-900">
                    {template.name}
                  </h2>
                  <Badge tone="neutral" className="shrink-0">
                    {STATUS_LABEL[template.status] ?? template.status}
                  </Badge>
                </div>

                {template.description && (
                  <p className="text-xs text-ink-500 leading-relaxed mb-2">
                    {template.description}
                  </p>
                )}

                <p className="text-xs text-ink-400 mb-4">
                  Actualizado el {formatDate(template.updated_at)}
                </p>

                <div className="mt-auto">
                  <Link
                    href={templateHref(template.id)}
                    className="press-feedback group inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
                  >
                    Usar este machote
                    <ArrowRightIcon className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
