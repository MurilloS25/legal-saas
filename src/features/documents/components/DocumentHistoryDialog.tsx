"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { DocumentActivityPage } from "../server/activity-queries";
import { DocumentActivity } from "./DocumentActivity";

type Props = {
  documentId: string;
  activity: DocumentActivityPage;
};

export function DocumentHistoryDialog({ documentId, activity }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

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
        className="press-feedback rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        Historial
      </button>
      <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-ink-900/45"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
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
            initial={{ x: prefersReducedMotion ? 0 : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: prefersReducedMotion ? 0 : "100%" }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
            className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 p-5 shadow-ink-lg focus:outline-none"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id={titleId} className="text-lg font-semibold text-ink-900">
                Historial de la escritura
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar historial"
                className="press-feedback flex size-9 items-center justify-center rounded-md text-xl text-ink-500 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <DocumentActivity
              documentId={documentId}
              initialItems={activity.items}
              initialHasMore={activity.hasMore}
              initialNextOffset={activity.nextOffset}
            />
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
