"use client";

/**
 * Toast breve y no bloqueante para confirmaciones simples ("Cambios
 * guardados") — a diferencia de `MilestoneFeedback`, que es contenido del
 * workspace con acciones que debe permanecer visible hasta que el usuario lo
 * cierre. Un toast se autodescarta, no ocupa espacio de layout (posición
 * fija) y no debe usarse para errores ni advertencias que necesiten quedar
 * visibles — esos siguen siendo mensajes inline (`role="alert"`).
 *
 * Un solo `ToastProvider` montado en `AppShell` sirve a toda la app — no
 * hay una librería de toasts en el repo, así que este es el único punto de
 * entrada reutilizable (`useToast()`) en vez de que cada feature construya
 * el suyo.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;

const toneClass: Record<ToastTone, string> = {
  success: "border-accent-200 bg-accent-50 text-accent-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${toneClass[toast.tone]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Dispara un toast breve y no bloqueante. Requiere `ToastProvider` (ya montado en `AppShell`). */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  }
  return context;
}
