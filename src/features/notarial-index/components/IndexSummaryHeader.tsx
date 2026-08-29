"use client";

/**
 * Resumen glanceable ("X configurados · Y pendientes") + banner de
 * advertencia opcional, compartido por la configuración de Índice del
 * Machote (`TemplateIndexConfigurationSection`) y los metadatos de Índice
 * de la Escritura (`NotarialMetadataSection`). Puramente presentacional —
 * cada llamador sigue calculando sus propios conteos y su propia condición
 * de advertencia (`is_complete`/`invalid_mappings` en el Machote,
 * `reviewRequired`/campos faltantes en la Escritura).
 *
 * Redesign: los conteos en cifra tabular grande + una barra de progreso
 * (configurados / total) para lectura de un vistazo antes de entrar a
 * revisar fila por fila. El banner de advertencia entra/sale con motion.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Card } from "@/components/ui/Card";

type Props = {
  configuredCount: number;
  pendingCount: number;
  /** Texto breve bajo los conteos, ej. "Esta configuración es opcional...". */
  helperText?: string;
  hasWarning?: boolean;
  warningMessage?: string;
};

export function IndexSummaryHeader({
  configuredCount,
  pendingCount,
  helperText,
  hasWarning,
  warningMessage,
}: Props) {
  const total = configuredCount + pendingCount;
  const ratio = total > 0 ? configuredCount / total : 0;
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-4 space-y-3">
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-mono text-2xl font-semibold tabular-figures text-ink-900">
              {configuredCount}
            </p>
            <p className="text-xs text-ink-500">configurados</p>
          </div>
          <div>
            <p
              className={`font-mono text-2xl font-semibold tabular-figures ${
                pendingCount > 0 ? "text-amber-700" : "text-ink-900"
              }`}
            >
              {pendingCount}
            </p>
            <p className="text-xs text-ink-500">pendientes</p>
          </div>
          {total > 0 && (
            <div className="hidden w-28 sm:block" aria-hidden="true">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                    ratio === 1 ? "bg-emerald-500" : "bg-accent-500"
                  }`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-ink-400">
                {Math.round(ratio * 100)}% listo
              </p>
            </div>
          )}
        </div>
        {helperText && (
          <p className="max-w-xs text-xs leading-relaxed text-ink-500">
            {helperText}
          </p>
        )}
      </Card>
      <AnimatePresence initial={false}>
        {hasWarning && warningMessage && (
          <motion.div
            key="warning"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0.001 : 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
          >
            <WarningIcon />
            <span>{warningMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WarningIcon() {
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
      className="mt-0.5 flex-shrink-0 text-amber-600"
    >
      <path d="M12 3.7 21 19.5H3L12 3.7Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="16.8" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
