import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { ReceivableForm } from "@/features/receivables";
import {
  listDocumentOptions,
} from "@/features/receivables/server";
import { listClientOptions } from "@/features/clients/server";
import { parseDocumentReceivablesReturnTo } from "@/lib/navigation/context-return";
import { ContextBackLink } from "@/components/navigation/ContextBackLink";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Nueva cuenta por cobrar — LexCR",
};

type Props = {
  searchParams: Promise<{
    client?: string;
    document?: string;
    returnTo?: string;
  }>;
};

export default async function NewReceivablePage({ searchParams }: Props) {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "receivables.manage")) {
    redirect("/dashboard/receivables");
  }
  const { client, document, returnTo: rawReturnTo } = await searchParams;
  const returnTo = parseDocumentReceivablesReturnTo(rawReturnTo);
  const [clients, documents] = await Promise.all([
    listClientOptions(),
    listDocumentOptions(),
  ]);

  return (
    <PageContainer width="form">
      <nav aria-label="Breadcrumb" className="mb-6">
        {returnTo && (
          <ContextBackLink href={returnTo} label="Volver a la Escritura" />
        )}
        <Link
          href="/dashboard/receivables"
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
          Cuentas por cobrar
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Nueva cuenta por cobrar
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Registra un cobro pendiente asociado a un cliente.
        </p>
      </div>

      <ReceivableForm
        mode="create"
        clients={clients}
        documents={documents}
        defaults={{ client_id: client, document_id: document }}
        returnTo={returnTo}
      />
    </PageContainer>
  );
}
