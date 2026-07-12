import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { ClientForm } from "../_components/ClientForm";

export const metadata = {
  title: "Nuevo cliente — LexCR",
};

export default function NewClientPage() {
  return (
    <PageContainer width="form">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/clients"
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
          Clientes
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registra los datos de la persona física.
        </p>
      </div>

      <ClientForm mode="create" />
    </PageContainer>
  );
}
