"use client";

/**
 * Shell del panel: barra de navegación + contenido.
 *
 * El sidebar usa un azul tinta propio (`ink-*`) distinto del blanco del
 * resto de la app, con un único acento (`accent-*`) — una variante más
 * clara del mismo azul — como hilo conductor entre el sidebar y el
 * contenido. No hay teal ni verde brillante en ningún estado decorativo;
 * verde/ámbar/rojo quedan reservados para estados semánticos reales.
 *
 * Colapsable en escritorio (icon rail, se recuerda en localStorage) y
 * deslizante en móvil.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, useSyncExternalStore } from "react";
import { logoutAction } from "../actions";
import { ToastProvider } from "@/components/feedback/Toast";
import {
  BookmarkIcon,
  ChevronLeftIcon,
  CompassIcon,
  GearIcon,
  LogoutIcon,
  MenuIcon,
  ScrollIcon,
  StackIcon,
  TeamIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "./icons";

const COLLAPSE_STORAGE_KEY = "lexcr.sidebar.collapsed";

// Estado colapsado leído de localStorage a través de `useSyncExternalStore`:
// evita el patrón "leer en un efecto y hacer setState" (dispara un render en
// cascada) y, sobre todo, evita un mismatch de hidratación — el snapshot de
// servidor siempre es "expandido", igual que el primer render del cliente.
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(callback: () => void) {
  collapseListeners.add(callback);
  return () => collapseListeners.delete(callback);
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
}

function getCollapsedServerSnapshot() {
  return false;
}

function setCollapsedStorage(next: boolean) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  collapseListeners.forEach((callback) => callback());
}

// ------------------------------------------------------------------ nav config

const BASE_LINKS = [
  { label: "Panel", href: "/dashboard", Icon: CompassIcon },
  { label: "Clientes", href: "/dashboard/clients", Icon: UsersIcon },
  { label: "Machotes", href: "/dashboard/templates", Icon: StackIcon },
  { label: "Escrituras", href: "/dashboard/documents", Icon: ScrollIcon },
  { label: "Cuentas por cobrar", href: "/dashboard/receivables", Icon: WalletIcon },
  { label: "Índice Notarial", href: "/dashboard/notarial-index", Icon: BookmarkIcon },
] as const;

const TEAM_LINK = { label: "Mi equipo", href: "/dashboard/team", Icon: TeamIcon } as const;

const SETTINGS_LINK = { label: "Configuración", href: "/dashboard/settings", Icon: GearIcon } as const;

function isLinkActive(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

// ------------------------------------------------------------------ SidebarNav

function SidebarNav({
  pathname,
  collapsed,
  showTeamLink,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  showTeamLink: boolean;
  onNavigate?: () => void;
}) {
  const links = showTeamLink
    ? [...BASE_LINKS, TEAM_LINK, SETTINGS_LINK]
    : [...BASE_LINKS, SETTINGS_LINK];

  return (
    <>
      {links.map(({ label, href, Icon }) => {
        const isActive = isLinkActive(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`group relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800 ${
              collapsed ? "justify-center px-0" : "px-3"
            } ${
              isActive
                ? "bg-ink-600 text-white"
                : "text-ink-200/90 hover:bg-ink-700 hover:text-white"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              aria-hidden="true"
              className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent-400 transition-opacity ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            />
            <Icon
              className={`size-[18px] shrink-0 ${isActive ? "text-accent-400" : "text-ink-400 group-hover:text-ink-200"}`}
            />
            <span
              className={`whitespace-nowrap transition-all duration-150 ${
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              }`}
            >
              {label}
            </span>

            {collapsed && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 group-hover:block"
              >
                {label}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ SidebarInner

function SidebarInner({
  pathname,
  collapsed,
  userLabel,
  userEmail,
  showTeamLink,
  onNavigate,
  onToggleCollapsed,
}: {
  pathname: string;
  collapsed: boolean;
  userLabel: string | null;
  userEmail: string | null;
  showTeamLink: boolean;
  onNavigate?: () => void;
  /** Presente solo en el sidebar de escritorio (el móvil no colapsa). */
  onToggleCollapsed?: () => void;
}) {
  const tooltipId = useId();
  const initials = (userLabel ?? userEmail ?? "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col text-ink-200">
      {/* Brand + toggle */}
      <div
        className={`flex shrink-0 items-center gap-2 border-b border-white/10 py-5 ${
          collapsed ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        {collapsed ? (
          <span
            aria-hidden="true"
            className="select-none text-sm font-black tracking-tight text-white"
          >
            Lx
          </span>
        ) : (
          <div className="min-w-0 select-none">
            <p className="truncate text-[15px] font-bold tracking-tight text-white">
              LexCR
            </p>
            <p className="truncate text-[11px] text-ink-400">
              Gestión Notarial
            </p>
          </div>
        )}

        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-pressed={collapsed}
            aria-describedby={tooltipId}
            className="group/toggle relative flex size-7 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
          >
            <ChevronLeftIcon
              className={`size-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            />
            <span
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100"
            >
              {collapsed ? "Expandir menú" : "Contraer menú"}
            </span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-4 ${collapsed ? "px-2.5" : "px-3"}`}
        aria-label="Navegación principal"
      >
        <SidebarNav
          pathname={pathname}
          collapsed={collapsed}
          showTeamLink={showTeamLink}
          onNavigate={onNavigate}
        />
      </nav>

      {/* User + logout */}
      <div
        className={`shrink-0 space-y-3 border-t border-white/10 py-4 ${
          collapsed ? "px-2.5" : "px-3"
        }`}
      >
        <div
          className={`group/profile relative flex items-center gap-2.5 rounded-lg ${collapsed ? "justify-center" : "px-1"}`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[11px] font-semibold text-ink-200 ring-1 ring-white/10">
            {initials || "?"}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {userLabel ?? "Sin perfil"}
              </p>
              <p className="truncate text-[11px] text-ink-400">
                {userEmail}
              </p>
            </div>
          )}
          {collapsed && (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full ml-3 hidden max-w-[12rem] truncate rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 group-hover/profile:block"
            >
              {userLabel ?? userEmail ?? "Sin perfil"}
            </span>
          )}
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            title={collapsed ? "Cerrar sesión" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800 ${
              collapsed ? "justify-center px-0" : "px-3"
            }`}
          >
            <LogoutIcon className="size-[18px] shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ AppShell

type Props = {
  children: React.ReactNode;
  userLabel: string | null;
  userEmail: string | null;
  showTeamLink: boolean;
};

export function AppShell({ children, userLabel, userEmail, showTeamLink }: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  function toggleCollapsed() {
    setCollapsedStorage(!collapsed);
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar — sticky, colapsable */}
      <aside
        style={{ width: collapsed ? 80 : 260 }}
        className="relative hidden min-w-0 shrink-0 flex-col overflow-hidden bg-ink-800 transition-[width] duration-200 ease-in-out lg:sticky lg:top-0 lg:flex lg:h-screen"
      >
        <SidebarInner
          pathname={pathname}
          collapsed={collapsed}
          userLabel={userLabel}
          userEmail={userEmail}
          showTeamLink={showTeamLink}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      {/* Mobile: backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile: slide-in sidebar */}
      <aside
        id="mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-ink-800 transition-transform duration-200 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menú de navegación"
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-ink-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            aria-label="Cerrar menú de navegación"
          >
            <XIcon className="size-5" />
          </button>
        </div>
        <SidebarInner
          pathname={pathname}
          collapsed={false}
          userLabel={userLabel}
          userEmail={userEmail}
          showTeamLink={showTeamLink}
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            aria-label="Abrir menú de navegación"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-sidebar"
          >
            <MenuIcon className="size-5" />
          </button>
          <span className="select-none text-base font-bold text-slate-900">
            LexCR
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
