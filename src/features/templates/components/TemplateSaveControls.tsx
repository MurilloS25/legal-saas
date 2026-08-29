"use client";

/**
 * Barra de guardado — REDISEÑO EXPERIMENTAL: antes vivía en flujo normal al
 * final del formulario; ahora es una barra pegada (`sticky bottom-0`) para
 * que "Guardar y continuar" quede siempre visible sin importar el largo del
 * paso activo (Documento, con el editor Tiptap, puede ser largo). Esto es
 * puramente de posicionamiento/feedback — el botón sigue siendo
 * `type="submit"` dentro del mismo `<form>`, dispara la misma Server Action
 * con el mismo payload, y `onSaveClick` sigue marcando la misma intención de
 * "avanzar de paso" antes del submit nativo.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";

type Props = {
  dirty: boolean;
  pending: boolean;
  saved: boolean;
  isEdit: boolean;
  /** templates.write — sin este permiso no se muestra el botón de guardar. */
  canWrite?: boolean;
  /** false en el último paso del flujo (Publicar) — no hay a dónde continuar. */
  hasNextStep?: boolean;
  /** Marca la intención de "avanzar de paso" antes del submit nativo. */
  onSaveClick?: () => void;
};

export function TemplateSaveControls({
  dirty,
  pending,
  saved,
  isEdit,
  canWrite = true,
  hasNextStep = true,
  onSaveClick,
}: Props) {
  const statusText = pending
    ? "Guardando…"
    : dirty
      ? "Cambios sin guardar"
      : saved || isEdit
        ? "Guardado"
        : "Sin guardar";

  const label = pending
    ? "Guardando…"
    : !isEdit
      ? "Crear machote"
      : hasNextStep
        ? "Guardar y continuar"
        : "Guardar cambios";

  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t border-ink-100 bg-white/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div role="status" className="min-h-[1.25rem] text-sm">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={canWrite ? statusText : "read-only"}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className={
                dirty && !pending && canWrite
                  ? "font-medium text-amber-700"
                  : "text-ink-400"
              }
            >
              {canWrite
                ? statusText
                : "Tu rol no permite editar machotes. Lo ves en modo lectura."}
            </motion.p>
          </AnimatePresence>
        </div>
        {canWrite && (
          <Button
            type="submit"
            variant="accent"
            disabled={pending}
            loading={pending}
            loadingText="Guardando…"
            onClick={onSaveClick}
            className="px-6"
          >
            {label}
          </Button>
        )}
      </div>
    </div>
  );
}
