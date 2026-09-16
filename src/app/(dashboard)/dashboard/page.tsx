import { PageContainer } from "@/components/layout/PageContainer";
import {
  ScrollIcon,
  StackIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission, type Permission } from "@/lib/server/permissions";
import { listClients } from "@/features/clients/server";
import { listTemplates } from "@/features/templates/server";
import { listDocuments } from "@/features/documents/server";
import {
  getReceivablesSummary,
  listReceivables,
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
import { selectAttentionReceivables } from "./_lib/dashboard-presenters";

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

  const [
    profileResult,
    clients,
    templates,
    documents,
    receivablesSummary,
    receivables,
    notarialFortnightAll,
    notarialFortnightIncomplete,
  ] = await Promise.all([
    supabase
      .from("lawyer_profiles")
      .select("full_name, professional_code")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    listClients(),
    listTemplates(),
    listDocuments(),
    getReceivablesSummary(parseReceivablesQuery({})),
    listReceivables(),
    listNotarialIndex(parseNotarialQuery({})),
    listNotarialIndex(parseNotarialQuery({ completeness: "incomplete" })),
  ]);

  const profile = profileResult.data;
  const activeTemplates = templates.filter(
    (template) => template.status === "active",
  ).length;
  const draftDocuments = documents.filter(
    (document) => document.status === "draft",
  ).length;
  const attentionReceivables = selectAttentionReceivables(receivables, now);
  const overdueCount = receivables.filter(
    (receivable) => receivable.status === "overdue",
  ).length;

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
        overdueCount={overdueCount}
        fortnightTotal={notarialFortnightAll.total}
        fortnightIncomplete={notarialFortnightIncomplete.total}
        clientCount={clients.length}
        templateCount={templates.length}
        activeTemplates={activeTemplates}
        documentCount={documents.length}
        draftDocuments={draftDocuments}
      />
      <DashboardLists
        attentionReceivables={attentionReceivables}
        recentDocuments={documents.slice(0, 5)}
        now={now}
        canCreateDocuments={canCreateDocuments}
      />
    </PageContainer>
  );
}
