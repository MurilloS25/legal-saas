"use client";

/**
 * Panel de detalle del list+detail del Índice notarial (iteración 3).
 *
 * Solo lectura a propósito: muestra un resumen de revisión del registro
 * seleccionado ("qué falta verificar antes de que esta entrada quede
 * lista") con un enlace explícito a la escritura completa para editar.
 * No reimplementa `NotarialMetadataSection` ni sus server actions —
 * todos los datos vienen de `NotarialIndexRow`, ya cargado por la tabla.
 *
 * Responsive: en desktop (`lg:`) se ancla al costado de la tabla; en
 * viewports angostos se convierte en una hoja (sheet) que sube desde
 * abajo, cubriendo la tabla, porque un layout lado a lado no cabe.
 */

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/Badge";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import { formatCostaRicaDate, formatCostaRicaTime } from "../model/datetime";
import { notarialRowConfirmationTone } from "./notarial-index-columns";

type Props = {
  row: NotarialIndexRow | null;
  onClose: () => void;
};

function subscribeToDesktopQuery(callback: () => void) {
  const mql = window.matchMedia("(min-width: 1024px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink-900">
        {value ?? <span className="text-ink-400">—</span>}
      </dd>
    </div>
  );
}

export function NotarialRecordDetailPanel({ row, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  const mobileVariants = {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
  };
  const desktopVariants = {
    initial: { x: 24, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 24, opacity: 0 },
  };
  const variants = isDesktop ? desktopVariants : mobileVariants;

  return (
    <AnimatePresence>
      {row && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden="true"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink-900/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.001 : 0.15 }}
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal={!isDesktop || undefined}
            aria-label={`Detalle de la escritura ${row.instrument_number ?? row.title}`}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-ink-200 bg-white p-5 shadow-ink-lg lg:static lg:inset-auto lg:z-auto lg:ml-4 lg:w-[380px] lg:max-h-none lg:shrink-0 lg:overflow-visible lg:rounded-2xl lg:border lg:border-ink-200 lg:p-5 lg:shadow-ink-sm"
            initial={reduceMotion ? { opacity: 0 } : variants.initial}
            animate={reduceMotion ? { opacity: 1 } : variants.animate}
            exit={reduceMotion ? { opacity: 0 } : variants.exit}
            transition={{ duration: reduceMotion ? 0.001 : 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <DetailPanelBody row={row} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DetailPanelBody({
  row,
  onClose,
}: {
  row: NotarialIndexRow;
  onClose: () => void;
}) {
  const badge = notarialRowConfirmationTone(row);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            Registro del índice
          </p>
          <p className="mt-0.5 font-mono text-xl font-semibold tabular-figures text-ink-900">
            {row.instrument_number ? `N.º ${row.instrument_number}` : "Sin número"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100/70 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>

      <div className="mb-5">
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <dl className="space-y-4">
        <Field label="Escritura" value={row.title} />
        <Field
          label="Fecha y hora de autorización"
          value={
            row.authorized_at ? (
              <span className="font-mono tabular-figures">
                {formatCostaRicaDate(row.authorized_at)}
                {" · "}
                {formatCostaRicaTime(row.authorized_at)}
              </span>
            ) : (
              <span className="text-amber-700">Pendiente</span>
            )
          }
        />
        <Field label="Tipo de acto" value={row.act_name} />
        <Field label="Comparecientes" value={row.parties} />
        <Field label="Cliente" value={row.client_name} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tomo" value={row.protocol_book} />
          <Field label="Folios" value={
            row.initial_folio || row.final_folio
              ? `${row.initial_folio ?? "—"} – ${row.final_folio ?? "—"}`
              : null
          } />
        </div>
      </dl>

      <div className="mt-6 border-t border-ink-100 pt-4">
        <Link
          href={`/dashboard/documents/${row.document_id}`}
          className="inline-flex w-full items-center justify-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
        >
          Abrir escritura
        </Link>
        <p className="mt-2 text-center text-xs text-ink-400">
          Para editar o corregir datos, hazlo desde la escritura.
        </p>
      </div>
    </div>
  );
}
