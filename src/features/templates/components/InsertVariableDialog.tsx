"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/forms/FieldError";
import { TEMPLATE_DOC_LIMITS } from "@/lib/editor/types";
import { FIELD_KEY_PATTERN } from "../model/template-fields";
import type { TemplateWorkspaceVariable } from "../model/template-workspace";

const inputClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500";

type Props = {
  variables: TemplateWorkspaceVariable[];
  onInsertExisting: (variable: TemplateWorkspaceVariable) => void;
  onInsertNew: (key: string, label: string) => void;
  onClose: () => void;
};

export function InsertVariableDialog({
  variables,
  onInsertExisting,
  onInsertNew,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const keyId = useId();
  const labelId = useId();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | undefined>();

  function insertNew() {
    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();

    if (
      trimmedKey === "" ||
      trimmedKey.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength ||
      !FIELD_KEY_PATTERN.test(trimmedKey)
    ) {
      setError(
        "Usa minúsculas, números, guion bajo y puntos simples. Ej: comprador.nombre",
      );
      return;
    }
    if (trimmedLabel === "") {
      setError("La etiqueta de la variable es requerida.");
      return;
    }
    if (variables.some((variable) => variable.field_key === trimmedKey)) {
      setError(
        "Esa variable ya está configurada; selecciónala de la lista superior.",
      );
      return;
    }
    onInsertNew(trimmedKey, trimmedLabel);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onClose();
            return;
          }

          if (event.key !== "Tab") return;

          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ) ?? [],
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!last) return;

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white shadow-ink-lg animate-scale-in">
          <div className="px-6 pt-5 pb-4 border-b border-ink-100">
            <h2 id={titleId} className="text-base font-semibold text-ink-900">
              Insertar variable
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">
              La variable se inserta en la posición del cursor.
            </p>
          </div>

          <div className="px-6 py-4 space-y-5">
            {variables.length > 0 && (
              <div>
                <p className="text-xs font-medium text-ink-700 mb-2">
                  Variables configuradas
                </p>
                <ul className="max-h-40 overflow-y-auto space-y-1">
                  {variables.map((variable) => (
                    <li key={variable.field_key}>
                      <button
                        type="button"
                        onClick={() => onInsertExisting(variable)}
                        className="w-full rounded-lg border border-ink-100 px-3 py-2 text-left text-sm hover:border-accent-300 hover:bg-accent-50/50 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
                      >
                        <span className="font-medium text-ink-900">
                          {variable.label}
                        </span>{" "}
                        <code className="text-xs text-ink-400">
                          {variable.field_key}
                        </code>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-ink-700 mb-2">
                {variables.length > 0 ? "O crea una nueva" : "Nueva variable"}
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor={labelId}
                    className="block text-sm font-medium text-ink-700 mb-1.5"
                  >
                    Etiqueta
                  </label>
                  <input
                    id={labelId}
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    className={inputClass}
                    placeholder="Ej: Nombre del comprador"
                    autoFocus
                  />
                </div>
                <div>
                  <label
                    htmlFor={keyId}
                    className="block text-sm font-medium text-ink-700 mb-1.5"
                  >
                    Clave
                  </label>
                  <input
                    id={keyId}
                    type="text"
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    className={inputClass + " font-mono text-xs"}
                    placeholder="Ej: comprador.nombre"
                    aria-describedby={error ? `${keyId}-error` : undefined}
                    aria-invalid={!!error}
                  />
                  <FieldError id={`${keyId}-error`} message={error} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-ink-100 px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" variant="accent" onClick={insertNew}>
              Insertar variable
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
