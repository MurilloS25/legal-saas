"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

type LeaveAction = () => void | Promise<void>;
type Guard = {
  register: (id: string, dirty: boolean) => () => void;
  requestLeave: (action: LeaveAction) => void;
};
const Context = createContext<Guard | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const blockers = useRef(new Set<string>());
  const trigger = useRef<HTMLElement | null>(null);
  const [leaveAction, setLeaveAction] = useState<LeaveAction | null>(null);
  const register = useCallback((id: string, dirty: boolean) => {
    if (dirty) blockers.current.add(id);
    else blockers.current.delete(id);
    return () => { blockers.current.delete(id); };
  }, []);
  const requestLeave = useCallback((action: LeaveAction) => {
    if (blockers.current.size === 0) { startTransition(action); return; }
    trigger.current = document.activeElement as HTMLElement | null;
    const popup = trigger.current?.closest(
      '[data-navigation-popup], [role="dialog"]',
    );
    const labelId = popup?.getAttribute("aria-labelledby");
    const opener = labelId ? document.getElementById(labelId) :
      popup?.id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(popup.id)}"]`) : null;
    if (opener) trigger.current = opener;
    setLeaveAction(() => action);
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (blockers.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (blockers.current.size === 0 || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      requestLeave(() => router.push(url.pathname + url.search + url.hash));
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [requestLeave, router]);

  return <Context.Provider value={{ register, requestLeave }}>
    {children}
    {leaveAction && <ConfirmDialog
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar. Si sales o cierras sesión, se perderán."
      confirmLabel="Salir sin guardar"
      tone="danger"
      onClose={() => { setLeaveAction(null); trigger.current?.focus(); }}
      onConfirm={() => { setLeaveAction(null); startTransition(leaveAction); }}
    />}
  </Context.Provider>;
}

export function useNavigationGuard() {
  const guard = useContext(Context);
  if (!guard) throw new Error("NavigationGuardProvider is required");
  return guard;
}

export function useUnsavedChanges(dirty: boolean) {
  const { register } = useNavigationGuard();
  const id = useId();
  useEffect(() => register(id, dirty), [register, id, dirty]);
}
