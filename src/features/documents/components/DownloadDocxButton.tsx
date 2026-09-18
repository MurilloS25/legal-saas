"use client";

/**
 * Botón "Descargar Word" del compositor de escrituras.
 *
 * La descarga usa siempre el último estado guardado en servidor (el endpoint
 * ignora cualquier dato del cliente). Por eso el botón se deshabilita mientras
 * haya cambios sin guardar.
 *
 * Al pulsarlo se abre siempre un diálogo accesible para elegir el "Formato de
 * margen" de ESA descarga (Frente por defecto | Vuelto). La elección no se
 * guarda ni modifica Configuración; viaja como `?margins=` y el servidor
 * aplica los márgenes de ese perfil. Si el borrador persistido tiene variables
 * pendientes, el mismo diálogo lo advierte (aparecerán en el Word como
 * `{{clave}}`) y el botón pasa a "Descargar de todas formas".
 */

import { useEffect, useRef, useState } from "react";
import { useId } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_MARGIN_PROFILE,
  MARGIN_PROFILES,
  MARGIN_PROFILE_LABELS,
  type MarginProfile,
} from "@/lib/documents/docx/margin-profile";

type Props = {
  documentId: string;
  /** true cuando hay cambios locales sin guardar. */
  disabled: boolean;
  /** Variables sin valor del estado PERSISTIDO (no del estado local). */
  pendingVariableCount: number;
  /**
   * "full" (paso Completar, histórico): botón ancho con textos de ayuda.
   * "compact" (listado, encabezado del workspace): botón pequeño, sin
   * texto de ayuda debajo — el motivo de un disabled se explica con
   * `title` en su lugar. Misma lógica de descarga en ambas variantes.
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
  // Solo vive mientras el diálogo está abierto: se reinicia a Frente cada vez.
  const [marginProfile, setMarginProfile] =
    useState<MarginProfile>(DEFAULT_MARGIN_PROFILE);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Devuelve el foco al botón al cerrar la confirmación.
  useEffect(() => {
    if (!confirmOpen) return;
    dialogRef.current
      ?.querySelector<HTMLElement>("input[type=radio]:checked")
      ?.focus();
  }, [confirmOpen]);

  async function startDownload(profile: MarginProfile = marginProfile) {
    // Anti doble-clic: si ya se está preparando, ignora.
    if (status === "preparing") return;
    setStatus("preparing");
    setConfirmOpen(false);

    try {
      const response = await fetch(`/api/documents/${documentId}/docx?margins=${profile}`, {
        method: "POST",
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
    setMarginProfile(DEFAULT_MARGIN_PROFILE);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    triggerRef.current?.focus();
  }

  const preparing = status === "preparing";
  const showHelp = variant === "full";

  const buttonClass = compact
    ? "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    : "w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

  return (
    <div className={compact ? "inline-block" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        onClick={onClick}
        disabled={disabled || preparing}
        aria-label={ariaLabel}
        aria-describedby={showHelp && disabled ? `${titleId}-hint` : undefined}
        title={compact && disabled ? "Guarda los cambios antes de descargar el Word." : undefined}
        className={buttonClass}
      >
        {preparing ? "Preparando…" : "Descargar Word"}
      </button>

      {showHelp &&
        (disabled ? (
          <p id={`${titleId}-hint`} className="mt-1.5 text-xs text-slate-500">
            Guarda los cambios antes de descargar el Word.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-slate-500">
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

      {confirmOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeConfirm}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            ref={dialogRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeConfirm();
                return;
              }
              if (event.key !== "Tab") return;

              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), input[type=radio]:checked",
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
                  Descargar Word
                </h2>
                <p id={descId} className="text-sm text-slate-600 leading-relaxed">
                  Selecciona el formato de margen que deseas utilizar para
                  generar el documento.
                </p>
                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-medium text-slate-700">
                    Formato de margen
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {MARGIN_PROFILES.map((p) => (
                      <label
                        key={p}
                        className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-accent-500 ${
                          marginProfile === p
                            ? "border-accent-600 bg-accent-50 text-accent-800"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${titleId}-margin-profile`}
                          value={p}
                          checked={marginProfile === p}
                          onChange={() => setMarginProfile(p)}
                          className="sr-only"
                        />
                        {MARGIN_PROFILE_LABELS[p]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {pendingVariableCount > 0 && (
                  <p
                    role="status"
                    className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-relaxed"
                  >
                    El borrador guardado tiene{" "}
                    <strong>
                      {pendingVariableCount}{" "}
                      {pendingVariableCount === 1
                        ? "variable pendiente"
                        : "variables pendientes"}
                    </strong>
                    . Aparecerán en el Word con su marca{" "}
                    <code className="rounded bg-amber-100 px-1 py-0.5">
                      {"{{ }}"}
                    </code>{" "}
                    sin reemplazar.
                  </p>
                )}
              </div>
              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={closeConfirm}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void startDownload(marginProfile)}
                  className="flex-1 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors"
                >
                  {pendingVariableCount > 0 ? "Descargar de todas formas" : "Descargar"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
