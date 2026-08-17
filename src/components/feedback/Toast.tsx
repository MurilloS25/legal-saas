"use client";

/**
 * Toast breve y no bloqueante para confirmaciones simples ("Cambios
 * guardados") — a diferencia del extinto `MilestoneFeedback`, este no ocupa
 * espacio de layout (posición fija), se autodescarta, y no debe usarse para
 * errores ni advertencias que necesiten quedar visibles junto al campo o
 * acción que falló — esos siguen siendo mensajes inline (`role="alert"`).
 *
 * Un solo `ToastProvider` montado en `AppShell` sirve a toda la app — no
 * hay una librería de toasts en el repo, así que este es el único punto de
 * entrada reutilizable (`useToast()`) en vez de que cada feature construya
 * el suyo.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastTone = "success" | "info" | "error";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// 5s (no 3.5s): los toasts de ciclo de vida (finalizar/reabrir/duplicar)
// disparan tras una navegación completa de página, no un cambio de sección
// en cliente — el efecto de montaje que muestra el toast corre después de
// que el navegador ya resolvió la navegación, así que un usuario con una
// conexión o hidratación lentas tiene menos margen para verlo con una
// ventana corta. 5s da margen real sin sentirse pegajoso.
const AUTO_DISMISS_MS = 5000;

// Tope de toasts simultáneos: sin límite, una racha de guardados rápidos
// (p. ej. "Guardar variable" repetido) apilaría indefinidamente y taparía
// contenido — se descarta el más antiguo al llegar un cuarto toast en vez
// de dejar crecer la pila sin control.
const MAX_VISIBLE_TOASTS = 3;

// Colores alineados con la tabla de estados semánticos de DESIGN.md:
// éxito = emerald, informativo neutro = slate, error = red.
const toneClass: Record<ToastTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-slate-300 bg-slate-100 text-slate-700",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }].slice(-MAX_VISIBLE_TOASTS));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            // Error es urgente (interrumpe lectura de pantalla en curso);
            // success/info son confirmaciones que pueden esperar su turno.
            role={toast.tone === "error" ? "alert" : "status"}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${toneClass[toast.tone]}`}
          >
            <span className="min-w-0">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Cerrar"
              className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
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
