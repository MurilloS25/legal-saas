import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRightIcon,
  BookmarkIcon,
  ScrollIcon,
  StackIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { formatMoney } from "@/features/receivables";
import { greeting, plural, todayLabel } from "../_lib/dashboard-presenters";

const cardIconChipClass =
  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600";

const cardClass =
  "group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

export type DashboardQuickAction = {
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
};

type Summary = {
  currency: string;
  balance: string;
  count: number;
};

export function DashboardHeader({
  now,
  firstName,
}: {
  now: Date;
  firstName: string | null;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
        {todayLabel(now)}
      </p>
      <h1 className="mt-1 text-[26px] font-semibold leading-tight text-slate-900">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ""}.
      </h1>
    </div>
  );
}

export function ProfileSetupPrompt() {
  return (
    <div className="mb-8 rounded-xl border border-accent-200 bg-accent-50 px-6 py-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-700">
        Primer paso
      </p>
      <h2 className="mb-1.5 text-base font-semibold text-slate-900">
        Completa tu perfil para empezar
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        Agrega tu nombre, código profesional y la configuración de documentos
        para que el sistema pueda personalizar tus machotes.
      </p>
      <Link
        href="/dashboard/settings"
        className="inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      >
        Configurar ahora →
      </Link>
    </div>
  );
}

export function DashboardQuickActions({
  actions,
}: {
  actions: readonly DashboardQuickAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ label, href, Icon }) => (
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
  );
}

type DashboardSummaryGridProps = {
  receivablesSummary: Summary[];
  overdueCount: number;
  fortnightTotal: number;
  fortnightIncomplete: number;
  clientCount: number;
  templateCount: number;
  activeTemplates: number;
  documentCount: number;
  draftDocuments: number;
};

export function DashboardSummaryGrid({
  receivablesSummary,
  overdueCount,
  fortnightTotal,
  fortnightIncomplete,
  clientCount,
  templateCount,
  activeTemplates,
  documentCount,
  draftDocuments,
}: DashboardSummaryGridProps) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            {receivablesSummary.map((total) => (
              <div key={total.currency}>
                <p className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMoney(total.balance, total.currency)}
                </p>
                <p className="text-xs text-slate-500">
                  saldo pendiente · {total.count} {" "}
                  {plural(Number(total.count), "cuenta", "cuentas")}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
          Ver cuentas por cobrar <ArrowRightIcon className="size-3.5" />
        </p>
      </Link>

      <Link href="/dashboard/notarial-index" className={cardClass}>
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
            {fortnightTotal} {plural(fortnightTotal, "registro", "registros")} en
            la quincena actual
          </p>
        )}
        <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
          Ver índice notarial <ArrowRightIcon className="size-3.5" />
        </p>
      </Link>

      <SummaryLink href="/dashboard/clients" title="Clientes" Icon={UsersIcon}>
        {clientCount} {plural(clientCount, "registrado", "registrados")}
      </SummaryLink>
      <SummaryLink href="/dashboard/templates" title="Machotes" Icon={StackIcon}>
        {templateCount} total · {activeTemplates} {" "}
        {plural(activeTemplates, "activo", "activos")}
      </SummaryLink>
      <SummaryLink href="/dashboard/documents" title="Escrituras" Icon={ScrollIcon}>
        {documentCount} total · {draftDocuments} {" "}
        {plural(draftDocuments, "borrador", "borradores")}
      </SummaryLink>
    </div>
  );
}

function SummaryLink({
  href,
  title,
  Icon,
  children,
}: {
  href: string;
  title: string;
  Icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cardClass}>
      <span className={cardIconChipClass}>
        <Icon className="size-[18px]" />
      </span>
      <h2 className="mt-3 text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{children}</p>
      <p className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-accent-700">
        Ver {title.toLocaleLowerCase("es-CR")} {" "}
        <ArrowRightIcon className="size-3.5" />
      </p>
    </Link>
  );
}
