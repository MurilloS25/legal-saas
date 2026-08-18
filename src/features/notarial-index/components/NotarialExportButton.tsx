"use client";

/**
 * Botón "Exportar Word" del Índice Notarial. Pide confirmación antes de
 * generar el archivo (los datos incompletos se exportan igual, sin bloquear)
 * y descarga vía fetch+blob en vez de navegar directo al endpoint: así, si el
 * backend falla (p. ej. falta configurar el nombre del notario), el error se
 * muestra como un toast amigable sin sacar al usuario del Índice ni exponer
 * el JSON crudo de la respuesta.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/feedback/Toast";

type Props = {
  href: string;
};

const GENERIC_ERROR_MESSAGE =
  "No se pudo generar el Índice Notarial. Inténtalo de nuevo.";

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

export function NotarialExportButton({ href }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  function closeDialog() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function handleConfirm() {
    setPending(true);
    try {
      const response = await fetch(href, {
        method: "GET",
        headers: { Accept: "*/*" },
      });

      if (!response.ok) {
        // El endpoint ya devuelve un mensaje seguro por tipo de error
        // (permiso, configuración incompleta, falla interna genérica) —
        // se muestra tal cual en vez de inventar uno nuevo.
        let message = GENERIC_ERROR_MESSAGE;
        try {
          const data: unknown = await response.json();
          if (
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string" &&
            data.error.trim() !== ""
          ) {
            message = data.error;
          }
        } catch {
          // Respuesta no-JSON inesperada: se mantiene el mensaje genérico.
        }
        showToast(message, "error");
        return;
      }

      const blob = await response.blob();
      const filename = filenameFromDisposition(
        response.headers.get("Content-Disposition"),
        "indice-notarial.docx",
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      showToast("Índice notarial exportado.");
      router.refresh();
    } catch {
      showToast(GENERIC_ERROR_MESSAGE, "error");
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        data-export-href={href}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors shrink-0"
      >
        Exportar Word
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={pending ? undefined : closeDialog}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            ref={dialogRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (!pending) closeDialog();
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
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="px-6 pt-6 pb-4">
                <h2
                  id={titleId}
                  className="text-base font-semibold text-slate-900 mb-2"
                >
                  ¿Exportar Índice Notarial a Word?
                </h2>
                <p id={descId} className="text-sm text-slate-600 leading-relaxed">
                  El archivo se generará con la información actualmente
                  configurada. Las escrituras con datos incompletos pueden
                  aparecer con campos faltantes en el documento exportado.
                </p>
              </div>
              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={pending}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  {pending ? "Exportando…" : "Exportar Word"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
