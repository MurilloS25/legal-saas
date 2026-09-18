import { PageContainer } from "@/components/layout/PageContainer";
import {
  ScrollIcon,
  StackIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission, type Permission } from "@/lib/server/permissions";
import { listClientsPage } from "@/features/clients/server";
import { parseClientsQuery } from "@/features/clients";
import { getTemplateDashboardCounts } from "@/features/templates/server";
import { listDocumentsPage } from "@/features/documents/server";
import { parseDocumentsQuery } from "@/features/documents";
import {
  getReceivablesSummary,
  listAttentionReceivables,
  listReceivablesWorkspace,
} from "@/features/receivables/server";
import { parseReceivablesQuery } from "@/features/receivables";
import { listNotarialIndex } from "@/features/notarial-index/server";
import { parseNotarialQuery } from "@/features/notarial-index";
import {
  DashboardHeader,
  DashboardQuickActions,
  DashboardSummaryGrid,
  ProfileSetupPrompt,
  type DashboardQuickAction,
} from "./_components/DashboardTop";
import { DashboardLists } from "./_components/DashboardLists";

export const metadata = {
  title: "Panel — LexCR",
};

const QUICK_ACTIONS = [
  {
    label: "Nueva escritura",
    href: "/documents/new",
    Icon: ScrollIcon,
    permission: "documents.create",
  },
  {
    label: "Nuevo cliente",
    href: "/clients/new",
    Icon: UsersIcon,
    permission: "clients.write",
  },
  {
    label: "Nuevo machote",
    href: "/templates/new",
    Icon: StackIcon,
    permission: "templates.write",
  },
  {
    label: "Nueva cuenta",
    href: "/receivables/new",
    Icon: WalletIcon,
    permission: "receivables.manage",
  },
] as const satisfies ReadonlyArray<
  DashboardQuickAction & { permission: Permission }
>;

export default async function DashboardPage() {
  const { supabase, workspaceId, role } = await requireWorkspace();
  const now = new Date();
  const canManageSettings = hasPermission(role, "settings.manage");
  const canCreateDocuments = hasPermission(role, "documents.create");
  const visibleQuickActions = QUICK_ACTIONS.filter(({ permission }) =>
    hasPermission(role, permission),
  );
  const dueThrough = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now.getTime() + 7 * 86_400_000));

  const [
    profileResult,
    clientsPage,
    templateCounts,
    documentsPage,
    draftDocumentsPage,
    receivablesSummary,
    attentionReceivables,
    overdueReceivables,
    notarialFortnightAll,
    notarialFortnightIncomplete,
  ] = await Promise.all([
    supabase
      .from("lawyer_profiles")
      .select("full_name, professional_code")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    listClientsPage(parseClientsQuery({ pageSize: "5" })),
    getTemplateDashboardCounts(),
    listDocumentsPage(parseDocumentsQuery({ pageSize: "5" })),
    listDocumentsPage(parseDocumentsQuery({ status: "draft", pageSize: "5" })),
    getReceivablesSummary(parseReceivablesQuery({})),
    listAttentionReceivables(dueThrough),
    listReceivablesWorkspace(
      parseReceivablesQuery({ status: "overdue", pageSize: "5" }),
    ),
    listNotarialIndex(parseNotarialQuery({})),
    listNotarialIndex(parseNotarialQuery({ completeness: "incomplete" })),
  ]);

  const profile = profileResult.data;
  return (
    <PageContainer>
      <DashboardHeader
        now={now}
        firstName={profile?.full_name?.split(" ")[0] ?? null}
      />
      {!profile && canManageSettings && <ProfileSetupPrompt />}
      <DashboardQuickActions actions={visibleQuickActions} />
      <DashboardSummaryGrid
        receivablesSummary={receivablesSummary}
        overdueCount={overdueReceivables.totalCount}
        fortnightTotal={notarialFortnightAll.total}
        fortnightIncomplete={notarialFortnightIncomplete.total}
        clientCount={clientsPage.total}
        templateCount={templateCounts.total}
        activeTemplates={templateCounts.active}
        documentCount={documentsPage.total}
        draftDocuments={draftDocumentsPage.total}
      />
      <DashboardLists
        attentionReceivables={attentionReceivables}
        recentDocuments={documentsPage.rows}
        now={now}
        canCreateDocuments={canCreateDocuments}
      />
    </PageContainer>
  );
}
