import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { ClientForm } from "@/features/clients";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Nuevo cliente — LexCR",
};

export default async function NewClientPage() {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "clients.write")) {
    redirect("/dashboard/clients");
  }

  return (
    <PageContainer width="form">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-accent-700 focus:outline-none focus-visible:underline"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Clientes
        </Link>
      </nav>

      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registra los datos de la persona física.
        </p>
      </div>

      <ClientForm mode="create" />
    </PageContainer>
  );
}
