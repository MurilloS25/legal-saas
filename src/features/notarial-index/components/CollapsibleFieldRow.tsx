"use client";

/**
 * Fila de acordeón para la presentación compacta del Índice Notarial:
 * cerrada muestra nombre + fuente/meta + estado; abierta muestra el editor
 * de campo existente sin cambios (pasado como `children`). El estado "una
 * fila abierta a la vez" vive en el componente padre (`open`/`onToggle`),
 * no aquí — cada sección (`TemplateIndexConfigurationSection`,
 * `NotarialMetadataSection`) sigue dueña de su propio `openRowId`.
 *
 * Varias filas se colocan dentro de un contenedor con borde/redondeo a
 * cargo del llamador (ej. `divide-y rounded-xl border`).
 *
 * Redesign (experiment/lexcr-visual-refresh): la expansión ahora anima
 * altura + opacidad con `motion/react` (respeta `useReducedMotion`) en vez
 * del `{open && children}` instantáneo original — encaja con un módulo
 * donde el usuario abre/cierra muchas filas seguidas para revisar datos.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/Badge";

type RowStatus = "configured" | "pending" | "optional" | "automatic";

type Props = {
  id: string;
  name: string;
  /** Subtítulo: fuente/sugerencia/estado resumido. */
  meta: string;
  status: RowStatus;
  /** Reemplaza la etiqueta por defecto del estado si se necesita un texto distinto. */
  statusLabel?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const STATUS_TONE: Record<RowStatus, "success" | "warning" | "neutral"> = {
  configured: "success",
  pending: "warning",
  optional: "neutral",
  automatic: "neutral",
};

const STATUS_LABELS: Record<RowStatus, string> = {
  configured: "Configurado",
  pending: "Pendiente",
  optional: "Opcional",
  automatic: "Automático",
};

export function CollapsibleFieldRow({
  id,
  name,
  meta,
  status,
  statusLabel,
  open,
  onToggle,
  children,
}: Props) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-trigger`;
  const reduceMotion = useReducedMotion();

  return (
    <div>
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-100/50 focus:outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink-900">
            {name}
          </span>
          <span className="block truncate text-xs text-ink-500">{meta}</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2.5">
          <Badge tone={STATUS_TONE[status]} className="hidden sm:inline-flex">
            {statusLabel ?? STATUS_LABELS[status]}
          </Badge>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }
            }
            className="flex text-ink-400"
          >
            <ChevronIcon />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.001 : 0.22, ease: [0.77, 0, 0.175, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="border-t border-ink-100 bg-ink-100/30 px-4 py-4"
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
