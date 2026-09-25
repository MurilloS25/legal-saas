"use client";

/**
 * Dock flotante de lifecycle del workspace de Escrituras — quinto
 * refinamiento. `position: fixed`, montado una sola vez como hermano de
 * los tres paneles (no dentro de ninguno) — visible en todo momento sin
 * importar el scroll ni el paso activo, mientras el usuario tenga algún
 * control que mostrar ahí.
 *
 * Misma posición/composición para dos contenidos mutuamente excluyentes
 * según `status` — el punto central de este refinamiento: el cambio
 * Borrador → Finalizada ya no reorganiza nada arriba (Descargar Word/
 * Historial/Duplicar quedan fijos en el encabezado, ver
 * `DocumentWorkspaceHeader`), solo cambia qué ocupa este mismo dock:
 *   - editable (draft/ready): "Sin guardar"/"Guardando…"/"Guardado"/
 *     "Error al guardar" + [Guardar] + Finalizar/Volver a borrador
 *     (`actions`, vía `DocumentStatusControls`).
 *   - final: "Finalizada" (con el aviso de solo lectura como `title`,
 *     igual que el resto de explicaciones cortas de este dock — nunca
 *     una segunda línea permanente) + Reabrir escritura (`actions`, la
 *     rama `final` del mismo `DocumentStatusControls`) — nada de esto se
 *     muestra si `canFinalize` es `false`: no hay acción que ofrecer.
 *
 * El botón "Guardar" sigue enviando el `<form>` de Completar aunque ya no
 * sea su descendiente DOM — se enlaza vía el atributo HTML `form={formId}`
 * (estándar, sin JS adicional), la misma solución que usaría cualquier
 * botón fuera de un `<form>` que deba enviarlo.
 *
 * Respeta el ancho de contenido del workspace (`max-w-screen-2xl` +
 * `mx-auto` + el mismo padding lateral que `PageContainer`) en vez de
 * pegarse al borde físico del viewport — en un monitor ultrawide se
 * siente asociado al workspace, no a la pantalla. Se posiciona más
 * arriba que el toast (`ToastProvider`, también `bottom-4`) para que
 * ambos puedan estar visibles a la vez sin superponerse.
 *
 * Un spacer invisible (mismo componente, en el flujo normal) reserva el
 * espacio que el dock fijo ya no reserva por sí solo, para que nunca tape
 * el contenido final de cualquiera de los tres paneles.
 *
 * El contenedor visual del dock (posicionamiento, ancho, spacer, advertencia
 * sobre `backdrop-blur`/`filter`/`transform`) vive en `WorkspaceActionDock`
 * (compartido con el dock de Guardar de Machotes) — este archivo solo aporta
 * el contenido específico de Escrituras (dirty/guardado/lifecycle); ver ese
 * componente para el detalle de la advertencia de containing block (ya
 * ocurrió una vez con `backdrop-blur-sm`: el botón "Cancelar" de un
 * `ConfirmDialog` terminaba fuera de la pantalla, inalcanzable).
 */

import { useId } from "react";
import { WorkspaceActionDock } from "@/components/workspace/WorkspaceActionDock";
import type { NotarialDockState } from "@/features/notarial-index";
import type { DocumentStatus } from "../model/lifecycle";

type Props = {
  status: DocumentStatus;
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** documents.edit — permiso general, independiente del estado. */
  canEdit: boolean;
  /** documents.finalize — controla si el dock muestra algo en `final`
   * (Reabrir) o nada en absoluto cuando no hay ese permiso. */
  canFinalize: boolean;
  /** Mensaje de error del guardado más reciente — no descarta `dirty`: el
   * usuario nunca pierde sus cambios locales por un guardado fallido.
   * Se expone como `title` (hover) y texto accesible, no como segunda
   * línea visible permanente, para mantener el dock de altura estable. */
  errorMessage?: string;
  onSaveClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Acciones de lifecycle relacionadas — Finalizar/Volver a borrador en
   * editable, Reabrir en final (`DocumentStatusControls`, misma
   * instancia para ambas ramas) — omitido en modo creación. */
  actions?: React.ReactNode;
  /** id del `<form>` de Completar a enviar — el botón vive fuera de su
   * árbol DOM (dock fijo, montado una sola vez, fuera de los paneles). */
  formId: string;
  /**
   * Escritura finalizada: estado de los datos del Índice. El dock pasa a ser
   * el único lugar de Guardar para esos datos (el contenido ya es de solo
   * lectura, así que nunca hay dos cosas distintas que guardar) y ofrece
   * "Confirmar Índice" como acción de ciclo de vida, separada de Guardar.
   */
  notarial?: NotarialDockState | null;
};

export function DocumentSaveControls({
  status,
  dirty,
  pending,
  saved,
  isEdit,
  canEdit,
  canFinalize,
  errorMessage,
  onSaveClick,
  actions,
  formId,
  notarial,
}: Props) {
  const errorDescId = useId();
  const isFinal = isEdit && status === "final";

  if (isFinal) {
    const canSaveIndex = !!notarial?.canSave;
    const canConfirmIndex = !!notarial?.confirmAvailable;
    // Nada que ofrecer: sin permiso para reabrir ni acciones del Índice.
    if (!canFinalize && !canSaveIndex && !canConfirmIndex) return null;

    const busy = !!(notarial?.saving || notarial?.confirming);
    const indexStatus = notarial?.saving
      ? "Guardando…"
      : notarial?.confirming
        ? "Confirmando…"
        : notarial?.errorMessage
        ? "Error al guardar"
        : notarial?.unsaved
          ? "Índice sin guardar"
          : "Finalizada";

    return (
      <WorkspaceActionDock>
        <p
          role="status"
          className={`text-xs whitespace-nowrap ${
            notarial?.errorMessage
              ? "text-red-700 font-medium"
              : notarial?.unsaved && !busy
                ? "text-amber-700 font-medium"
                : "text-slate-500"
          }`}
          title={
            notarial?.errorMessage ??
            "Finalizada es de solo lectura. No significa firmada, presentada ni enviada oficialmente."
          }
        >
          {indexStatus}
        </p>
        {canSaveIndex && (
          <button
            type="submit"
            form={notarial!.formId}
            disabled={busy || !notarial!.saveEnabled}
            className="rounded-md bg-accent-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {notarial!.saving ? "Guardando…" : "Guardar"}
          </button>
        )}
        {(canConfirmIndex || actions) && (
          <div className="flex flex-wrap items-center gap-2 border-l border-slate-200/80 pl-3">
            {canConfirmIndex && (
              // Ciclo de vida, no otro guardado: estilo de contorno con
              // ícono de verificación, distinto del botón Guardar.
              <button
                type="button"
                onClick={notarial!.requestConfirm}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
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
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirmar Índice
              </button>
            )}
            {canFinalize && actions}
          </div>
        )}
      </WorkspaceActionDock>
    );
  }

  if (!canEdit) return null;

  const statusText = pending
    ? "Guardando…"
    : errorMessage
      ? "Error al guardar"
      : dirty
        ? "Sin guardar"
        : saved || isEdit
          ? "Guardado"
          : "Sin guardar";

  const label = pending ? "Guardando…" : !isEdit ? "Crear escritura" : "Guardar";

  return (
    <WorkspaceActionDock>
      <p
        role="status"
        title={errorMessage}
        aria-describedby={errorMessage ? errorDescId : undefined}
        className={`text-xs whitespace-nowrap ${
          errorMessage
            ? "text-red-700 font-medium"
            : dirty && !pending
              ? "text-amber-700 font-medium"
              : "text-slate-500"
        }`}
      >
        {statusText}
      </p>
      {/* Fuera del `<p>` a propósito: su propio textContent debe seguir
          siendo exactamente `statusText` (nada anexado), para que un
          locator/aserción por texto exacto sobre el estado corto no se
          rompa cuando además hay un error detallado. */}
      {errorMessage && (
        <span id={errorDescId} className="sr-only">
          {errorMessage}
        </span>
      )}
      <button
        type="submit"
        form={formId}
        disabled={pending || (isEdit && !dirty)}
        onClick={onSaveClick}
        className="rounded-md bg-accent-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {label}
      </button>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 border-l border-slate-200/80 pl-3">
          {actions}
        </div>
      )}
    </WorkspaceActionDock>
  );
}
