import { PageContainer } from "@/components/layout/PageContainer";
import { notFound } from "next/navigation";
import {
  getReceivableEntry,
  getReceivableForEdit,
  listReceivableActivity,
  listPaymentsByReceivable,
  listDocumentOptions,
} from "@/features/receivables/server";
import { listClientOptions } from "@/features/clients/server";
import { ReceivableWorkspace } from "@/features/receivables";
import type { ReceivableWorkspaceSection } from "@/features/receivables";
import { parseDocumentReceivablesReturnTo } from "@/lib/navigation/context-return";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";
import { isResourceId } from "@/lib/validation/resource-id";

export const metadata = {
  title: "Cuenta por cobrar — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    section?: string;
    created?: string;
    paid?: string;
    returnTo?: string;
  }>;
};

function resolveInitialSection(
  raw: string | undefined,
): ReceivableWorkspaceSection {
  return raw === "payments" ? "payments" : "account";
}

export default async function ReceivableDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { section, created, paid, returnTo: rawReturnTo } = await searchParams;
  const returnTo = parseDocumentReceivablesReturnTo(rawReturnTo);
  const { role } = await requireWorkspace();
  const canWrite = hasPermission(role, "receivables.manage");
  const canRegisterPayments = hasPermission(role, "payments.register");
  const canVoidPayments = hasPermission(role, "payments.void");
  if (!isResourceId(id)) notFound();

  const [entry, editable] = await Promise.all([
    getReceivableEntry(id),
    getReceivableForEdit(id),
  ]);

  if (!entry || !editable) notFound();

  const [clients, documents, activity, payments] = await Promise.all([
    listClientOptions(),
    listDocumentOptions(),
    listReceivableActivity(id),
    listPaymentsByReceivable(id),
  ]);

  return (
    <PageContainer>
      <ReceivableWorkspace
        entry={entry}
        editable={editable}
        clients={clients}
        documents={documents}
        activity={activity}
        payments={payments}
        initialSection={resolveInitialSection(section)}
        createdJustNow={created === "1"}
        paidJustNow={paid === "1"}
        returnTo={returnTo}
        canWrite={canWrite}
        canRegisterPayments={canRegisterPayments}
        canVoidPayments={canVoidPayments}
      />
    </PageContainer>
  );
}
