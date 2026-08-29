import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission, type Permission } from "@/lib/server/permissions";
import { listClients } from "@/features/clients/server";
import { listTemplates } from "@/features/templates/server";
import { listDocuments } from "@/features/documents/server";
import { getReceivablesSummary, listReceivables } from "@/features/receivables/server";
import {
  parseReceivablesQuery,
  formatMoney,
} from "@/features/receivables";
import { listNotarialIndex } from "@/features/notarial-index/server";
import { parseNotarialQuery } from "@/features/notarial-index/model/query";
import {
  AlertIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ScrollIcon,
  StackIcon,
  UsersIcon,
  WalletIcon,
} from "../_components/icons";

export const metadata = {
  title: "Panel — LexCR",
};

// ------------------------------------------------------------------ helpers

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function todayLabel(now: Date): string {
  const label = now.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function daysUntil(iso: string, now: Date): number {
  const due = new Date(`${iso}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** Cascada de entrada — CSS puro (server component, sin JS de motion). */
function stagger(index: number): React.CSSProperties {
  return { animationDelay: `${index * 40}ms` };
}

// ------------------------------------------------------------------ quick actions

const QUICK_ACTIONS = [
  {
    label: "Escritura",
    href: "/dashboard/documents/new",
    Icon: ScrollIcon,
    permission: "documents.create",
  },
  {
    label: "Cliente",
    href: "/dashboard/clients/new",
    Icon: UsersIcon,
    permission: "clients.write",
  },
  {
    label: "Machote",
    href: "/dashboard/templates/new",
    Icon: StackIcon,
    permission: "templates.write",
  },
  {
    label: "Cuenta",
    href: "/dashboard/receivables/new",
    Icon: WalletIcon,
    permission: "receivables.manage",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  href: string;
  Icon: typeof ScrollIcon;
  permission: Permission;
}>;

// ------------------------------------------------------------------ attention model

type AttentionItem = {
  key: string;
  href: string;
  title: string;
  meta: string;
  tone: "error" | "warning";
  badgeLabel: string;
  urgency: number;
};

// ------------------------------------------------------------------ page

export default async function DashboardPage() {
  const { supabase, workspaceId, role } = await requireWorkspace();
  const now = new Date();
  const canManageSettings = hasPermission(role, "settings.manage");
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
    // Misma lógica server-side que usa el propio Índice Notarial para
    // determinar la quincena vigente y qué cuenta como "incompleto" — no
    // se duplican esas reglas aquí.
    listNotarialIndex(parseNotarialQuery({ completeness: "incomplete" })),
  ]);

  const profile = profileResult.data;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;
  const isConfigured = !!profile;

  const activeTemplates = templates.filter((t) => t.status === "active").length;
  const draftDocuments = documents.filter((d) => d.status === "draft");

  // ---------------- "Necesita tu atención": una sola lista priorizada,
  // en vez de una grilla de tiles genéricos. Combina las tres señales que
  // realmente requieren acción hoy: cuentas vencidas/próximas, escrituras
  // en borrador, y registros del índice incompletos.
  const attentionItems: AttentionItem[] = [];

  for (const r of receivables) {
    const isOverdue = r.status === "overdue";
    const days = r.due_at ? daysUntil(r.due_at, now) : null;
    const isDueSoon = days !== null && days <= 7 && r.status !== "paid";
    if (!isOverdue && !isDueSoon) continue;
    attentionItems.push({
      key: `receivable-${r.id}`,
      href: `/dashboard/receivables/${r.id}`,
      title: r.concept,
      meta: `${r.client_name} · ${formatMoney(r.balance_due, r.currency)}`,
      tone: isOverdue ? "error" : "warning",
      badgeLabel: isOverdue ? "Vencida" : days === 0 ? "Vence hoy" : `Vence en ${days} d`,
      urgency: isOverdue ? -1 : (days ?? 999),
    });
  }

  for (const doc of draftDocuments.slice(0, 5)) {
    attentionItems.push({
      key: `document-${doc.id}`,
      href: `/dashboard/documents/${doc.id}`,
      title: doc.title,
      meta: doc.clients?.full_name ?? "Sin cliente",
      tone: "warning",
      badgeLabel: "Borrador",
      urgency: 50,
    });
  }

  for (const row of notarialFortnightIncomplete.rows.slice(0, 5)) {
    attentionItems.push({
      key: `index-${row.document_id}`,
      href: "/dashboard/notarial-index",
      title: row.title,
      meta: row.client_name ?? "Índice notarial",
      tone: "warning",
      badgeLabel: "Índice incompleto",
      urgency: 60,
    });
  }

  attentionItems.sort((a, b) => a.urgency - b.urgency);
  const topAttention = attentionItems.slice(0, 6);

  const moduleStats = [
    { label: "Clientes", value: clients.length, href: "/dashboard/clients", Icon: UsersIcon },
    {
      label: "Machotes activos",
      value: activeTemplates,
      href: "/dashboard/templates",
      Icon: StackIcon,
    },
    { label: "Escrituras", value: documents.length, href: "/dashboard/documents", Icon: ScrollIcon },
    {
      label: "Cuentas por cobrar",
      value: receivablesSummary.reduce((sum, t) => sum + Number(t.count), 0),
      href: "/dashboard/receivables",
      Icon: WalletIcon,
    },
  ];

  return (
    <PageContainer>
      {/* ---------- header ---------- */}
      <div className="mb-8 animate-fade-in">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
          {todayLabel(now)}
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight leading-tight text-slate-900">
          {greeting(now)}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
      </div>

      {!isConfigured && canManageSettings && (
        <div className="mb-8 animate-fade-in rounded-xl border border-accent-200 bg-accent-50 px-6 py-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-700">
            Primer paso
          </p>
          <h2 className="mb-1.5 text-base font-semibold text-slate-900">
            Completa tu perfil para empezar
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Agrega tu nombre, código profesional y la configuración de
            documentos para que el sistema pueda personalizar tus machotes.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            Configurar ahora →
          </Link>
        </div>
      )}

      {/* ---------- necesita tu atención: contenido principal ---------- */}
      <section
        aria-labelledby="attention-heading"
        className="mb-6 animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-ink-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="attention-heading" className="text-base font-semibold text-slate-900">
            Necesita tu atención
          </h2>
          {topAttention.length > 0 && (
            <Badge tone="warning">
              {topAttention.length} {plural(topAttention.length, "pendiente", "pendientes")}
            </Badge>
          )}
        </div>

        {topAttention.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <CheckCircleIcon className="size-7 text-emerald-600" />
            <p className="text-sm font-medium text-slate-700">Todo al día.</p>
            <p className="text-sm text-slate-500">
              Sin cuentas vencidas, borradores pendientes ni registros de
              índice incompletos.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-slate-100">
            {topAttention.map((item, index) => (
              <li key={item.key} style={stagger(index)} className="animate-stagger-in">
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-accent-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AlertIcon
                      className={`size-4 shrink-0 ${item.tone === "error" ? "text-red-500" : "text-amber-500"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-slate-500 font-mono tabular-nums">
                        {item.meta}
                      </p>
                    </div>
                  </div>
                  <Badge tone={item.tone} className="shrink-0">
                    {item.badgeLabel}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- franja secundaria: acciones rápidas + conteos por módulo ---------- */}
      <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {visibleQuickActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleQuickActions.map(({ label, href, Icon }, index) => (
              <Link
                key={href}
                href={href}
                style={stagger(index)}
                className="press-feedback group flex animate-stagger-in items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-ink-sm transition-colors hover:border-accent-200 hover:bg-accent-50/40 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              >
                <Icon className="size-4 text-accent-600" />
                Nueva {label}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {moduleStats.map(({ label, value, href, Icon }, index) => (
            <Link
              key={href}
              href={href}
              style={stagger(index)}
              className="press-feedback group flex animate-stagger-in items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-ink-sm transition-colors hover:border-accent-200 hover:bg-accent-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
            >
              <Icon className="size-4 shrink-0 text-accent-600" />
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {value}
                </p>
                <p className="truncate text-[11px] text-slate-500">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ---------- índice notarial: acceso directo ---------- */}
      <Link
        href="/dashboard/notarial-index"
        className="press-feedback group mb-8 flex animate-fade-in items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-ink-sm transition-colors hover:border-accent-200 hover:bg-accent-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <BookmarkIcon className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Índice Notarial</p>
            <p className="text-xs text-slate-500">
              Revisar y confirmar los registros de la quincena actual
            </p>
          </div>
        </div>
        <ArrowRightIcon className="size-4 shrink-0 text-accent-700 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </PageContainer>
  );
}
