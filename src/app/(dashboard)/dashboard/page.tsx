import { PageContainer } from "@/components/layout/PageContainer";
import Link from "next/link";
import { requireWorkspace } from "@/lib/server/auth";
import { listClients } from "@/features/clients/server";
import { listTemplates } from "@/features/templates/server";
import { listDocuments } from "@/features/documents/server";
import {
  documentStatusBadgeClass,
  documentStatusLabel,
} from "@/features/documents/model/status";
import { getReceivablesSummary, listReceivables } from "@/features/receivables/server";
import {
  parseReceivablesQuery,
  receivableStatusBadgeClass,
  receivableStatusLabel,
  formatMoney,
} from "@/features/receivables";
import { listNotarialIndex } from "@/features/notarial-index/server";
import { parseNotarialQuery } from "@/features/notarial-index/model/query";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ScrollIcon,
  SparkIcon,
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

function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
  });
}

function daysUntil(iso: string, now: Date): number {
  const due = new Date(`${iso}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

// ------------------------------------------------------------------ shared card treatment

const cardIconChipClass =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600";

const cardClass =
  "group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

// ------------------------------------------------------------------ quick actions

const QUICK_ACTIONS = [
  { label: "Nueva escritura", href: "/dashboard/documents/new", Icon: ScrollIcon },
  { label: "Nuevo cliente", href: "/dashboard/clients/new", Icon: UsersIcon },
  { label: "Nuevo machote", href: "/dashboard/templates/new", Icon: StackIcon },
  { label: "Nueva cuenta", href: "/dashboard/receivables/new", Icon: WalletIcon },
] as const;

// ------------------------------------------------------------------ page

export default async function DashboardPage() {
  const { supabase, workspaceId } = await requireWorkspace();
  const now = new Date();

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
    // Misma lógica server-side que usa el propio Índice Notarial para
    // determinar la quincena vigente y qué cuenta como "incompleto" — no
    // se duplican esas reglas aquí.
    listNotarialIndex(parseNotarialQuery({})),
    listNotarialIndex(parseNotarialQuery({ completeness: "incomplete" })),
  ]);

  const profile = profileResult.data;
  const firstName = profile?.full_name?.split(" ")[0] ?? null;
  const isConfigured = !!profile;

  const fortnightTotal = notarialFortnightAll.total;
  const fortnightIncomplete = notarialFortnightIncomplete.total;

  const activeTemplates = templates.filter((t) => t.status === "active").length;
  const draftDocuments = documents.filter((d) => d.status === "draft").length;
  const recentDocuments = documents.slice(0, 5);

  const attentionReceivables = receivables
    .filter((r) => r.status === "overdue" || (r.due_at && daysUntil(r.due_at, now) <= 7 && r.status !== "paid"))
    .sort((a, b) => {
      const aDays = a.due_at ? daysUntil(a.due_at, now) : 999;
      const bDays = b.due_at ? daysUntil(b.due_at, now) : 999;
      return aDays - bDays;
    })
    .slice(0, 5);

  const overdueCount = receivables.filter((r) => r.status === "overdue").length;

  return (
    <PageContainer>
      {/* ---------- header ---------- */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
          {todayLabel(now)}
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-slate-900">
          {greeting(now)}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
      </div>

      {!isConfigured && (
        <div className="mb-8 rounded-xl border border-accent-200 bg-accent-50 px-6 py-5">
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

      {/* ---------- quick actions ---------- */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:bg-accent-50/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            <span className={cardIconChipClass}>
              <Icon className="size-[18px]" />
            </span>
            <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900">
              {label}
            </span>
          </Link>
        ))}
      </div>

      {/* ---------- bento grid ---------- */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Cuentas por cobrar — wide tile */}
        <Link
          href="/dashboard/receivables"
          aria-label={`Cuentas por cobrar${overdueCount > 0 ? `, ${overdueCount} vencida${plural(overdueCount, "", "s")}` : ""}`}
          className={`${cardClass} lg:col-span-2`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={cardIconChipClass}>
                <WalletIcon className="size-[18px]" />
              </span>
              <h2 className="text-sm font-semibold text-slate-900">
                Cuentas por cobrar
              </h2>
            </div>
            {overdueCount > 0 && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {overdueCount} {plural(overdueCount, "vencida", "vencidas")}
              </span>
            )}
          </div>

          {receivablesSummary.length === 0 ? (
            <p className="text-sm text-slate-500">
              Todavía no hay cuentas por cobrar registradas.
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
              {receivablesSummary.map((t) => (
                <div key={t.currency}>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">
                    {formatMoney(t.balance, t.currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    saldo pendiente · {t.count}{" "}
                    {plural(Number(t.count), "cuenta", "cuentas")}
                  </p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
            Ver cuentas por cobrar <ArrowRightIcon className="size-3.5" />
          </p>
        </Link>

        {/* Índice notarial — quincena actual */}
        <Link
          href="/dashboard/notarial-index"
          className={cardClass}
        >
          <span className={cardIconChipClass}>
            <BookmarkIcon className="size-[18px]" />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            Índice Notarial
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {fortnightIncomplete > 0
              ? `${fortnightIncomplete} ${plural(fortnightIncomplete, "registro incompleto", "registros incompletos")} en la quincena actual`
              : "Todos los registros de la quincena están completos"}
          </p>
          {fortnightTotal > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {fortnightTotal} {plural(fortnightTotal, "registro", "registros")} en la quincena actual
            </p>
          )}
          <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
            Ver índice notarial <ArrowRightIcon className="size-3.5" />
          </p>
        </Link>

        {/* Clientes */}
        <Link href="/dashboard/clients" className={cardClass}>
          <span className={cardIconChipClass}>
            <UsersIcon className="size-[18px]" />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Clientes</h2>
          <p className="mt-1 text-sm text-slate-600">
            {clients.length} {plural(clients.length, "registrado", "registrados")}
          </p>
          <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
            Ver clientes <ArrowRightIcon className="size-3.5" />
          </p>
        </Link>

        {/* Machotes */}
        <Link href="/dashboard/templates" className={cardClass}>
          <span className={cardIconChipClass}>
            <StackIcon className="size-[18px]" />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Machotes</h2>
          <p className="mt-1 text-sm text-slate-600">
            {templates.length} total · {activeTemplates}{" "}
            {plural(activeTemplates, "activo", "activos")}
          </p>
          <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
            Ver machotes <ArrowRightIcon className="size-3.5" />
          </p>
        </Link>

        {/* Escrituras */}
        <Link href="/dashboard/documents" className={cardClass}>
          <span className={cardIconChipClass}>
            <ScrollIcon className="size-[18px]" />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">Escrituras</h2>
          <p className="mt-1 text-sm text-slate-600">
            {documents.length} total · {draftDocuments}{" "}
            {plural(draftDocuments, "borrador", "borradores")}
          </p>
          <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
            Ver escrituras <ArrowRightIcon className="size-3.5" />
          </p>
        </Link>
      </div>

      {/* ---------- attention + recent ---------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Needs attention */}
        <section
          aria-labelledby="attention-heading"
          className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-1"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 id="attention-heading" className="text-sm font-semibold text-slate-900">
              Necesita tu atención
            </h2>
          </div>
          {attentionReceivables.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <CheckCircleIcon className="size-6 text-emerald-600" />
              <p className="text-sm text-slate-500">
                No hay cuentas vencidas ni próximas a vencer.
              </p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-slate-100">
              {attentionReceivables.map((r) => {
                const days = r.due_at ? daysUntil(r.due_at, now) : null;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/receivables/${r.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {r.concept}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {r.client_name} · {formatMoney(r.balance_due, r.currency)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${receivableStatusBadgeClass(r.status)}`}
                      >
                        {days !== null && days < 0
                          ? receivableStatusLabel(r.status)
                          : days === 0
                            ? "Hoy"
                            : days !== null
                              ? `${days} d`
                              : receivableStatusLabel(r.status)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link
              href="/dashboard/receivables"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline"
            >
              Ver cuentas por cobrar <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </section>

        {/* Recent escrituras */}
        <section
          aria-labelledby="recent-heading"
          className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 id="recent-heading" className="text-sm font-semibold text-slate-900">
              Escrituras recientes
            </h2>
            <Link
              href="/dashboard/documents"
              className="text-xs font-medium text-accent-700 hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {recentDocuments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <SparkIcon className="size-6 text-slate-300" />
              <p className="text-sm text-slate-500">
                Aún no has creado ninguna escritura.
              </p>
              <Link
                href="/dashboard/documents/new"
                className="text-xs font-medium text-accent-700 hover:underline"
              >
                Crear la primera →
              </Link>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-slate-100">
              {recentDocuments.map((doc) => (
                <li key={doc.id}>
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {doc.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {doc.clients?.full_name ?? "Sin cliente"} ·{" "}
                        {doc.templates?.name ?? "Machote eliminado"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${documentStatusBadgeClass(doc.status)}`}
                      >
                        {documentStatusLabel(doc.status)}
                      </span>
                      <span className="hidden text-xs text-slate-400 sm:inline">
                        {relativeTime(doc.updated_at, now)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
