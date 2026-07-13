"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "../actions";

// ------------------------------------------------------------------ icons (inline SVG)

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ------------------------------------------------------------------ nav config

const ACTIVE_LINKS = [
  { label: "Panel", href: "/dashboard" },
  { label: "Clientes", href: "/dashboard/clients" },
  { label: "Machotes", href: "/dashboard/templates" },
  { label: "Escrituras", href: "/dashboard/documents" },
  { label: "Índice Notarial", href: "/dashboard/notarial-index" },
  { label: "Configuración", href: "/dashboard/settings" },
] as const;

const FUTURE_LABELS = ["Cuentas por Cobrar"] as const;

// ------------------------------------------------------------------ SidebarNav

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {ACTIVE_LINKS.map(({ label, href }) => {
        // Exact match for /dashboard; prefix match for all others
        const isActive =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${
              isActive
                ? "bg-teal-50 text-teal-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}

      <div className="mt-5 mb-1.5 px-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Próximamente
        </p>
      </div>

      {FUTURE_LABELS.map((label) => (
        <span
          key={label}
          className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-400 cursor-default select-none"
          aria-disabled="true"
        >
          {label}
        </span>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ SidebarInner

function SidebarInner({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-100 shrink-0">
        <p className="text-xl font-bold text-slate-900 tracking-tight select-none">
          LexCR
        </p>
        <p className="text-xs text-slate-400 mt-0.5 select-none">
          Legal Workspace
        </p>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5"
        aria-label="Navegación principal"
      >
        <SidebarNav pathname={pathname} onNavigate={onNavigate} />
      </nav>

      {/* Logout */}
      <div className="shrink-0 px-3 py-4 border-t border-slate-100">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ AppShell

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar — sticky */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        <SidebarInner pathname={pathname} />
      </aside>

      {/* Mobile: backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile: slide-in sidebar */}
      <aside
        id="mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 transition-transform duration-200 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Menú de navegación"
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Cerrar menú de navegación"
          >
            <XIcon />
          </button>
        </div>
        <SidebarInner
          pathname={pathname}
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Abrir menú de navegación"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-sidebar"
          >
            <MenuIcon />
          </button>
          <span className="text-base font-bold text-slate-900 select-none">
            LexCR
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
