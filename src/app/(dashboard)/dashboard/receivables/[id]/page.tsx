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

export const metadata = {
  title: "Cuenta por cobrar — LexCR",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; created?: string }>;
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
  const { section, created } = await searchParams;

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
      />
    </PageContainer>
  );
}
