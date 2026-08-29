"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReceivableActivityEvent } from "../model/activity-format";
import {
  formatReceivableActivityEvent,
  formatReceivableActivityTimestamp,
} from "../model/activity-format";
import { XIcon } from "@/app/(dashboard)/_components/icons";

type Props = {
  activity: ReceivableActivityEvent[];
  currency: string;
};

export function ReceivableHistoryDialog({ activity, currency }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="press-feedback rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
      >
        Historial
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end bg-ink-950/45"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
              className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 p-5 shadow-ink-lg focus:outline-none"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id={titleId} className="text-lg font-semibold text-ink-900">
                  Historial de la cuenta
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar historial"
                  className="press-feedback flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {activity.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-ink-sm">
                  <p className="text-sm text-slate-500">
                    Todavía no hay actividad.
                  </p>
                </div>
              ) : (
                <ol
                  role="list"
                  className="rounded-xl border border-slate-200 bg-white shadow-ink-sm divide-y divide-slate-100 overflow-hidden"
                >
                  {activity.map((event) => {
                    const formatted = formatReceivableActivityEvent(
                      event,
                      currency,
                    );
                    return (
                      <li key={event.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-900">
                              {formatted.title}
                            </p>
                            {formatted.lines.map((line, i) => (
                              <p
                                key={i}
                                className="font-mono text-xs tabular-nums text-slate-500"
                              >
                                {line}
                              </p>
                            ))}
                          </div>
                          <time
                            dateTime={event.created_at}
                            className="shrink-0 text-xs text-slate-400"
                          >
                            {formatReceivableActivityTimestamp(event.created_at)}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {event.actorName}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
