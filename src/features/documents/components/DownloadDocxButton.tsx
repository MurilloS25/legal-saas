"use client";

/**
 * Botón "Descargar Word" del compositor de escrituras.
 *
 * La descarga usa siempre el último estado guardado en servidor (el endpoint
 * ignora cualquier dato del cliente). Por eso el botón se deshabilita mientras
 * haya cambios sin guardar. Si el borrador persistido tiene variables
 * pendientes, abre una confirmación accesible antes de descargar; las
 * variables sin valor aparecerán en el Word como `{{clave}}`.
 */

import { useEffect, useRef, useState } from "react";
import { useId } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Props = {
  documentId: string;
  /** true cuando hay cambios locales sin guardar. */
  disabled: boolean;
  /** Variables sin valor del estado PERSISTIDO (no del estado local). */
  pendingVariableCount: number;
  /**
   * "full" (compositor): botón ancho con textos de ayuda.
   * "compact" (listado): botón pequeño sin ayuda, misma lógica de descarga.
   */
  variant?: "full" | "compact";
  /** Nombre accesible cuando conviene distinguir varias filas. */
  ariaLabel?: string;
};

type Status = "idle" | "preparing" | "error" | "auth-error";

function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // Cae al filename simple.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? fallback;
}

export function DownloadDocxButton({
  documentId,
  disabled,
  pendingVariableCount,
  variant = "full",
  ariaLabel,
}: Props) {
  const router = useRouter();
  const compact = variant === "compact";
  const [status, setStatus] = useState<Status>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const prefersReducedMotion = useReducedMotion();

  // Devuelve el foco al botón al cerrar la confirmación.
  useEffect(() => {
    if (!confirmOpen) return;
    const firstButton = dialogRef.current?.querySelector<HTMLElement>("button");
    firstButton?.focus();
  }, [confirmOpen]);

  async function startDownload() {
    // Anti doble-clic: si ya se está preparando, ignora.
    if (status === "preparing") return;
    setStatus("preparing");
    setConfirmOpen(false);

    try {
      const response = await fetch(`/api/documents/${documentId}/docx`, {
        method: "GET",
        headers: { Accept: "*/*" },
      });

      if (!response.ok) {
        setStatus(response.status === 401 ? "auth-error" : "error");
        return;
      }

      const blob = await response.blob();
      const filename = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        "Escritura.docx",
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function onClick() {
    setStatus("idle");
    if (pendingVariableCount > 0) {
      setConfirmOpen(true);
    } else {
      void startDownload();
    }
  }

  function closeConfirm() {
    setConfirmOpen(false);
    triggerRef.current?.focus();
  }

  const preparing = status === "preparing";

  const buttonClass = compact
    ? "press-feedback rounded-md px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-slate-100 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
    : "press-feedback w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={compact ? "inline-block" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        onClick={onClick}
        disabled={disabled || preparing}
        aria-label={ariaLabel}
        aria-describedby={!compact && disabled ? `${titleId}-hint` : undefined}
        className={buttonClass}
      >
        {preparing
          ? compact
            ? "Preparando…"
            : "Preparando Word…"
          : compact
            ? "Descargar Word"
            : "Descargar Word"}
      </button>

      {!compact &&
        (disabled ? (
          <p id={`${titleId}-hint`} className="mt-1.5 text-xs text-ink-500">
            Guarda los cambios antes de descargar el Word.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-500">
            El archivo se genera con la última versión guardada.
          </p>
        ))}

      {status === "error" && (
        <p role="alert" className="mt-1.5 text-xs text-red-700">
          No fue posible generar el documento.{" "}
          <button
            type="button"
            onClick={() => void startDownload()}
            className="font-medium underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 rounded"
          >
            Reintentar
          </button>
        </p>
      )}

      {status === "auth-error" && (
        <p role="alert" className="mt-1.5 text-xs text-red-700">
          Tu sesión expiró. Inicia sesión de nuevo para descargar el Word.
        </p>
      )}

      <AnimatePresence>
      {confirmOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeConfirm}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            ref={dialogRef}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeConfirm();
                return;
              }
              if (event.key !== "Tab") return;

              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled])",
                ) ?? [],
              );
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-ink-lg">
              <div className="px-6 pt-6 pb-4">
                <h2
                  id={titleId}
                  className="text-base font-semibold text-ink-900 mb-2"
                >
                  Hay variables sin completar
                </h2>
                <p id={descId} className="text-sm text-ink-600 leading-relaxed">
                  El borrador guardado tiene{" "}
                  <strong>
                    {pendingVariableCount}{" "}
                    {pendingVariableCount === 1
                      ? "variable pendiente"
                      : "variables pendientes"}
                  </strong>
                  . Aparecerán en el Word con su marca{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    {"{{ }}"}
                  </code>{" "}
                  sin reemplazar. ¿Descargar de todas formas?
                </p>
              </div>
              <div className="flex gap-3 border-t border-ink-100 px-6 py-4">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="press-feedback flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void startDownload()}
                  className="press-feedback flex-1 rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                >
                  Descargar de todas formas
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
