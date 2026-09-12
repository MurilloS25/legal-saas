"use client";

/**
 * Shell del panel: navbar superior + contenido.
 *
 * Reemplaza el sidebar lateral por una barra superior (patrón aprobado en el
 * prototipo LexCR) porque con 6 áreas reales cabe cómoda en una sola línea.
 * Reutiliza los mismos tokens del sidebar anterior (`ink-*`/`accent-*`, ver
 * DESIGN.md) — no se introduce una paleta nueva, solo un layout nuevo.
 *
 * Desktop: navbar horizontal con menú de usuario (Perfil/Configuración/
 * Despacho/Cerrar sesión). Móvil: hamburguesa + drawer lateral, igual
 * mecanismo de transición que el sidebar anterior.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigationGuard } from "@/components/navigation/NavigationGuard";
import { logoutAction } from "../actions";
import { ToastProvider } from "@/components/feedback/Toast";
import {
  BookmarkIcon,
  BuildingIcon,
  ChevronDownIcon,
  CompassIcon,
  GearIcon,
  LogoutIcon,
  MenuIcon,
  ScrollIcon,
  StackIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
} from "./icons";

// ------------------------------------------------------------------ nav config

const NAV_LINKS = [
  { label: "Panel", href: "/dashboard", Icon: CompassIcon },
  { label: "Clientes", href: "/dashboard/clients", Icon: UsersIcon },
  { label: "Machotes", href: "/dashboard/templates", Icon: StackIcon },
  { label: "Escrituras", href: "/dashboard/documents", Icon: ScrollIcon },
  { label: "Índice Notarial", href: "/dashboard/notarial-index", Icon: BookmarkIcon },
  { label: "Cuentas por cobrar", href: "/dashboard/receivables", Icon: WalletIcon },
] as const;

const USER_MENU_ITEMS = [
  { label: "Perfil", href: "/dashboard/settings?tab=profile", Icon: UsersIcon },
  { label: "Configuración", href: "/dashboard/settings?tab=document", Icon: GearIcon },
  { label: "Despacho", href: "/dashboard/settings?tab=workspace", Icon: BuildingIcon },
] as const;

function isLinkActive(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

// ------------------------------------------------------------------ UserMenu

function UserMenu({
  userLabel,
  userEmail,
}: {
  userLabel: string | null;
  userEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { requestLeave } = useNavigationGuard();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const buttonId = useId();
  const menuId = useId();

  const initials = (userLabel ?? userEmail ?? "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={buttonId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Menú de usuario"
        className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-ink-700 text-[11px] font-semibold text-white ring-1 ring-white/10">
          {initials || "?"}
        </span>
        <ChevronDownIcon
          className={`size-3.5 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={menuId}
          data-navigation-popup
          aria-labelledby={buttonId}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="truncate text-[13px] font-medium text-slate-900">
              {userLabel ?? "Sin perfil"}
            </p>
            <p className="truncate text-[11.5px] text-slate-500">{userEmail}</p>
          </div>
          {USER_MENU_ITEMS.map(({ label, href, Icon }) => (
            <button
              key={href}
              onClick={() => {
                setOpen(false);
                requestLeave(() => router.push(href));
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
            >
              <Icon className="size-4 text-slate-400" />
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <form action={logoutAction} onSubmit={(event) => { event.preventDefault(); requestLeave(logoutAction); }}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-red-600 hover:bg-red-50"
            >
              <LogoutIcon className="size-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ AppShell

type Props = {
  children: React.ReactNode;
  userLabel: string | null;
  userEmail: string | null;
};

export function AppShell({ children, userLabel, userEmail }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-ink-800">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-6 px-4 sm:px-6 lg:px-10">
          <Link
            href="/dashboard"
            className="shrink-0 select-none text-[15px] font-bold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded-sm"
          >
            LexCR
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
            aria-label="Navegación principal"
          >
            {NAV_LINKS.map(({ label, href, Icon }) => {
              const active = isLinkActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800 ${
                    active ? "text-white" : "text-ink-200/90 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <Icon className={`size-[15px] ${active ? "text-accent-400" : ""}`} />
                  {label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-accent-400"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <UserMenu userLabel={userLabel} userEmail={userEmail} />
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-white/80 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 lg:hidden"
              aria-label="Abrir navegación"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              <MenuIcon className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <MobileDrawer
          pathname={pathname}
          userLabel={userLabel}
          userEmail={userEmail}
          onClose={() => setMobileOpen(false)}
        />
      )}

      <main>
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ MobileDrawer

function MobileDrawer({
  pathname,
  userLabel,
  userEmail,
  onClose,
}: {
  pathname: string;
  userLabel: string | null;
  userEmail: string | null;
  onClose: () => void;
}) {
  const { requestLeave } = useNavigationGuard();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const initials = (userLabel ?? userEmail ?? "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-ink-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-800 shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
          <span className="select-none text-[15px] font-bold tracking-tight text-white">
            LexCR
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú de navegación"
            className="rounded-md p-1.5 text-ink-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
          {NAV_LINKS.map(({ label, href, Icon }) => {
            const active = isLinkActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800 ${
                  active ? "bg-ink-600 text-white" : "text-ink-200/90 hover:bg-ink-700 hover:text-white"
                }`}
              >
                <Icon className={`size-[18px] ${active ? "text-accent-400" : "text-ink-400"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-white/10 px-3 py-4">
          <div className="flex items-center gap-2.5 px-1 pb-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[11px] font-semibold text-ink-200 ring-1 ring-white/10">
              {initials || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {userLabel ?? "Sin perfil"}
              </p>
              <p className="truncate text-[11px] text-ink-400">{userEmail}</p>
            </div>
          </div>

          {USER_MENU_ITEMS.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-200/90 hover:bg-ink-700 hover:text-white"
            >
              <Icon className="size-[18px] text-ink-400" />
              {label}
            </Link>
          ))}

          <form action={logoutAction} onSubmit={(event) => { event.preventDefault(); requestLeave(logoutAction); }}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
            >
              <LogoutIcon className="size-[18px] shrink-0" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
