"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReceivableActivityEvent } from "../model/activity-format";
import {
  formatReceivableActivityEvent,
  formatReceivableActivityTimestamp,
} from "../model/activity-format";

type Props = {
  activity: ReceivableActivityEvent[];
  currency: string;
};

export function ReceivableHistoryDialog({ activity, currency }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        Historial
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/45"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
            }}
            className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 p-5 shadow-xl focus:outline-none"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                Historial de la cuenta
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar historial"
                className="flex size-9 items-center justify-center rounded-md text-xl text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {activity.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  Todavía no hay actividad.
                </p>
              </div>
            ) : (
              <ol
                role="list"
                className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden"
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
                          <p className="text-sm font-medium text-slate-900">
                            {formatted.title}
                          </p>
                          {formatted.lines.map((line, i) => (
                            <p key={i} className="text-xs text-slate-500">
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
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
