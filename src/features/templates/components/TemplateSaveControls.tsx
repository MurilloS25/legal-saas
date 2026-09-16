"use client";

/**
 * Dock flotante de Guardar del workspace de Machotes — reutiliza el mismo
 * contenedor visual aprobado en Escrituras (`WorkspaceActionDock`):
 * `position: fixed`, ancho basado en contenido, alineado a la esquina
 * inferior derecha del workspace, persistente durante el scroll desde
 * cualquier paso (Información/Documento/Variables/Índice/Publicar).
 *
 * Machotes no tiene un equivalente a Finalizar/Reabrir — Publicar sigue
 * siendo un campo de estado más (`TemplateMetadataForm`, paso Publicar), no
 * una acción de este dock — así que aquí solo vive Guardar. La lógica
 * (dirty, guardado, permisos) sigue siendo enteramente de Machotes; nada de
 * eso se comparte con Escrituras, solo el contenedor visual.
 *
 * Sigue montado como último hijo del `<form>` único del workspace (ver
 * `TemplateWorkspace`), así que el botón puede seguir siendo un `submit`
 * normal sin necesitar el atributo `form={id}` que sí usa Escrituras (cuyo
 * dock vive fuera del `<form>`).
 */

import { useId } from "react";
import { WorkspaceActionDock } from "@/components/workspace/WorkspaceActionDock";

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** templates.write — sin este permiso no se muestra el botón de guardar. */
  canWrite?: boolean;
  /** Mensaje de error del guardado más reciente — no descarta `dirty`: el
   * usuario nunca pierde sus cambios locales por un guardado fallido. Se
   * expone como `title` (tooltip) y texto accesible, no como segunda línea
   * visible permanente, para mantener el dock de altura estable. */
  errorMessage?: string;
  onSaveClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function TemplateSaveControls({
  dirty,
  pending,
  saved,
  isEdit,
  canWrite = true,
  errorMessage,
  onSaveClick,
}: Props) {
  const errorDescId = useId();

  if (!canWrite) {
    return (
      <WorkspaceActionDock>
        <p className="text-xs whitespace-nowrap text-slate-500">
          Tu rol no permite editar machotes. Lo ves en modo lectura.
        </p>
      </WorkspaceActionDock>
    );
  }

  const statusText = pending
    ? "Guardando…"
    : errorMessage
      ? "Error al guardar"
      : dirty
        ? "Sin guardar"
        : saved || isEdit
          ? "Guardado"
          : "Sin guardar";

  const label = pending ? "Guardando…" : !isEdit ? "Crear machote" : "Guardar";

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
          siendo exactamente `statusText`, igual que en el dock de
          Escrituras. */}
      {errorMessage && (
        <span id={errorDescId} className="sr-only">
          {errorMessage}
        </span>
      )}
      <button
        type="submit"
        disabled={pending || (isEdit && !dirty)}
        onClick={onSaveClick}
        className="rounded-md bg-accent-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {label}
      </button>
    </WorkspaceActionDock>
  );
}
