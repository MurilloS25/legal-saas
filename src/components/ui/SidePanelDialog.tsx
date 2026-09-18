"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type Props = {
  title: string;
  closeLabel: string;
  children: ReactNode;
};

export function SidePanelDialog({ title, closeLabel, children }: Props) {
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
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
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
              if (event.key === "Escape") {
                close();
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                  FOCUSABLE_SELECTOR,
                ) ?? [],
              );
              if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current?.focus();
                return;
              }
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (document.activeElement === dialogRef.current) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
              } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            className="h-full w-full max-w-xl overflow-y-auto bg-slate-50 p-5 shadow-xl focus:outline-none"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={closeLabel}
                className="flex size-9 items-center justify-center rounded-md text-xl text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
