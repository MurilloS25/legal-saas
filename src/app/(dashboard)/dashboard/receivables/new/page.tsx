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
import { ChevronLeftIcon } from "@/app/(dashboard)/_components/icons";
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
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-accent-700 focus:outline-none focus:underline transition-colors"
        >
          <ChevronLeftIcon className="size-3" />
          Cuentas por cobrar
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink-900">
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
