"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/Toast";
import { setNotarialIndexInclusionAction } from "../server/lifecycle-actions";

type Props = {
  documentId: string;
  headingId: string;
  includeInNotarialIndex: boolean;
  canChangeInclusion: boolean;
  onExcludedFromIndex?: () => void;
  children: ReactNode;
};

export function DocumentNotarialInclusionSection({
  documentId,
  headingId,
  includeInNotarialIndex,
  canChangeInclusion,
  onExcludedFromIndex,
  children,
}: Props) {
  const { showToast } = useToast();
  const [included, setIncluded] = useState(includeInNotarialIndex);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"exclude" | "include" | null>(null);
  const lastSynced = useRef(includeInNotarialIndex);

  useEffect(() => {
    if (lastSynced.current !== includeInNotarialIndex) {
      lastSynced.current = includeInNotarialIndex;
      setIncluded(includeInNotarialIndex);
    }
  }, [includeInNotarialIndex]);

  async function applyChange(next: boolean) {
    setDialog(null);
    setError(null);
    setPending(true);
    const result = await setNotarialIndexInclusionAction(documentId, next);
    setPending(false);
    if (result.success && result.includeInNotarialIndex !== undefined) {
      lastSynced.current = result.includeInNotarialIndex;
      setIncluded(result.includeInNotarialIndex);
      showToast(
        result.includeInNotarialIndex
          ? "Incluida en el Índice Notarial."
          : "Excluida del Índice Notarial.",
      );
      if (!result.includeInNotarialIndex) onExcludedFromIndex?.();
      return;
    }
    setError(result.message ?? "No fue posible actualizar el Índice Notarial.");
  }

  if (!included) {
    return (
      <section
        aria-labelledby={headingId}
        className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <h2 id={headingId} className="text-sm font-semibold text-slate-900">
            Datos para índice
          </h2>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No pertenece al Índice Notarial
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Esta Escritura no está incluida en el Índice Notarial.
          </p>
          {canChangeInclusion && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setDialog("include")}
              className="mt-4 rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Incluir en el Índice
            </button>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="border-t border-slate-100 px-6 py-2 text-xs text-red-700"
          >
            {error}
          </p>
        )}
        {dialog === "include" && (
          <ConfirmDialog
            title="¿Incluir esta Escritura en el Índice Notarial?"
            description="Volverá a aparecer en el Índice Notarial. Sus datos y su estado de confirmación se conservan tal como estaban."
            confirmLabel="Incluir"
            pending={pending}
            onConfirm={() => applyChange(true)}
            onClose={() => setDialog(null)}
          />
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 id={headingId} className="text-sm font-semibold text-slate-900">
          Datos para índice
        </h2>
        <p className="text-xs text-slate-500">
          Metadata interna para organizar el índice notarial. «Completo»
          significa completo según los campos del sistema, no una validación
          legal.
        </p>
      </div>
      <div className="flex items-start gap-2 border-b border-slate-100 px-6 py-4">
        <input
          id="notarial-inclusion-toggle"
          type="checkbox"
          checked={included}
          disabled={!canChangeInclusion || pending}
          onChange={(event) =>
            setDialog(event.target.checked ? "include" : "exclude")
          }
          className="mt-0.5 size-4 accent-accent-700"
        />
        <label
          htmlFor="notarial-inclusion-toggle"
          className="text-sm text-slate-700"
        >
          <span className="font-medium text-slate-900">
            Incluir en el Índice Notarial
          </span>
          <br />
          {included
            ? "Esta escritura aparece en el Índice Notarial."
            : "Esta escritura está excluida del Índice Notarial. El contenido no se ve afectado."}
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="border-b border-slate-100 px-6 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {children}
      {dialog === "exclude" && (
        <ConfirmDialog
          title="¿Excluir esta Escritura del Índice Notarial?"
          description="Dejará de aparecer en el Índice, pero la Escritura y sus datos no se eliminarán. Podrás volver a incluirla posteriormente."
          confirmLabel="Excluir"
          tone="danger"
          pending={pending}
          onConfirm={() => applyChange(false)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "include" && (
        <ConfirmDialog
          title="¿Incluir esta Escritura en el Índice Notarial?"
          description="Volverá a aparecer en el Índice Notarial. Sus datos y su completitud no cambian."
          confirmLabel="Incluir"
          pending={pending}
          onConfirm={() => applyChange(true)}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
