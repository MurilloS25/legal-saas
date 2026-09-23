"use client";

/**
 * Superficie "Crear con IA": un único formulario (no un chat) que envía UN
 * documento — texto pegado o un archivo .docx/.pdf — más indicaciones
 * opcionales sobre variantes, previa aceptación explícita del aviso de
 * procesamiento. El servidor valida todo de nuevo; aquí solo hay ayudas.
 *
 * Tras una generación exitosa muestra el resumen y ofrece abrir el borrador
 * en el flujo normal del Machote. Nunca publica.
 *
 * Mismo patrón de diálogo (backdrop + focus trap + Escape) que
 * `AiHelpDialog`/`InsertVariableDialog`, sin librerías nuevas.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { aiGenerationErrorMessage } from "../model/ai-generation/errors";

export type AiTemplateGenerationLimits = {
  available: boolean;
  maxFileBytes: number;
  maxPages: number;
  maxPastedChars: number;
  maxVariantInstructionsChars: number;
};

type Props = {
  limits: AiTemplateGenerationLimits;
  onClose: () => void;
};

type Summary = {
  variableCount: number;
  optionBlockCount: number;
  indexMappingCount: number;
};

type Phase =
  | { kind: "form" }
  | { kind: "pending" }
  | { kind: "success"; templateId: string; summary: Summary; indexSaved: boolean };

const ACCEPT =
  ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PROGRESS_MESSAGES = [
  "Extrayendo contenido…",
  "Analizando variables…",
  "Preparando machote…",
] as const;

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function summaryText(summary: Summary): string {
  return `LexCR detectó ${plural(summary.variableCount, "variable", "variables")}, ${plural(
    summary.optionBlockCount,
    "bloque de opciones",
    "bloques de opciones",
  )} y ${plural(
    summary.indexMappingCount,
    "configuración inicial del Índice Notarial",
    "configuraciones iniciales del Índice Notarial",
  )}.`;
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500";
const secondaryButton =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors disabled:opacity-50";
const primaryButton =
  "rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function AiTemplateGenerationDialog({ limits, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const successButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const textId = useId();
  const fileId = useId();
  const variantsId = useId();
  const variantsHelpId = useId();
  const consentId = useId();

  const [sourceKind, setSourceKind] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [variants, setVariants] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [progressIndex, setProgressIndex] = useState(0);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (phase.kind !== "pending") return;
    const timer = setInterval(
      () => setProgressIndex((index) => Math.min(index + 1, PROGRESS_MESSAGES.length - 1)),
      4_000,
    );
    return () => clearInterval(timer);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind === "success") successButtonRef.current?.focus();
  }, [phase.kind]);

  const pending = phase.kind === "pending";

  function clientValidationError(): string | null {
    if (sourceKind === "text") {
      if (text.trim() === "") return "Pega el texto del documento.";
      if (text.length > limits.maxPastedChars) return aiGenerationErrorMessage("text_too_long");
    } else {
      if (!file) return "Selecciona un archivo .docx o PDF.";
      if (!/\.(docx|pdf)$/i.test(file.name)) return aiGenerationErrorMessage("unsupported_type");
      if (file.size > limits.maxFileBytes) return aiGenerationErrorMessage("file_too_large");
    }
    if (variants.length > limits.maxVariantInstructionsChars) {
      return aiGenerationErrorMessage("instructions_too_long");
    }
    if (!consent) return aiGenerationErrorMessage("consent_required");
    return null;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const validation = clientValidationError();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setProgressIndex(0);
    setPhase({ kind: "pending" });

    const body = new FormData();
    body.set("source_kind", sourceKind);
    if (sourceKind === "text") body.set("text", text);
    else if (file) body.set("file", file);
    if (variants.trim() !== "") body.set("variant_instructions", variants);
    body.set("consent", "on");

    try {
      const response = await fetch("/api/templates/ai-generation", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; templateId: string; summary: Summary; indexSaved: boolean }
        | { ok: false; code: string; message?: string }
        | null;
      if (!payload || !payload.ok) {
        setError(aiGenerationErrorMessage(payload && !payload.ok ? payload.code : "internal_error"));
        setPhase({ kind: "form" });
        return;
      }
      setPhase({
        kind: "success",
        templateId: payload.templateId,
        summary: payload.summary,
        indexSaved: payload.indexSaved,
      });
    } catch {
      setError(aiGenerationErrorMessage("provider_unavailable"));
      setPhase({ kind: "form" });
    }
  }

  function openDraft() {
    if (phase.kind !== "success") return;
    router.push(`/templates/${phase.templateId}?section=document`);
  }

  function requestClose() {
    if (pending) return; // La solicitud ya está en curso; no se simula cancelarla.
    if (phase.kind === "success") {
      router.refresh();
    }
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
        tabIndex={-1}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            requestClose();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ) ?? [],
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[92vh] overflow-y-auto">
          <div className="border-b border-slate-100 px-6 pt-5 pb-4">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Crear machote con IA
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm text-slate-600">
              Sube o pega una escritura existente. LexCR usará inteligencia
              artificial para proponer variables, bloques de opciones y una
              configuración inicial del Índice Notarial, y creará un
              machote en <strong>borrador</strong> para que lo revises en el
              flujo normal. El texto de la escritura se conserva tal cual.
            </p>
          </div>

          {!limits.available ? (
            <div className="px-6 py-5">
              <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {aiGenerationErrorMessage("not_configured")}
              </p>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={onClose} className={secondaryButton}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : phase.kind === "success" ? (
            <div className="px-6 py-5">
              <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <p className="font-medium">Borrador creado.</p>
                <p className="mt-1">{summaryText(phase.summary)}</p>
                {!phase.indexSaved && (
                  <p className="mt-1">
                    La configuración del Índice Notarial no pudo guardarse; puedes
                    configurarla en el paso Índice.
                  </p>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Revisa el documento, las variables y el Índice antes de
                publicarlo. Solo tú puedes publicar el machote.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={requestClose} className={secondaryButton}>
                  Cerrar
                </button>
                <button ref={successButtonRef} type="button" onClick={openDraft} className={primaryButton}>
                  Revisar borrador
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-busy={pending}>
              <fieldset disabled={pending} className="space-y-5 px-6 py-5">
                <div>
                  <p id={`${titleId}-source`} className="text-sm font-medium text-slate-900">
                    Documento
                  </p>
                  <div
                    className="mt-2 flex flex-wrap gap-4"
                    role="radiogroup"
                    aria-labelledby={`${titleId}-source`}
                  >
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="source_kind"
                        value="text"
                        checked={sourceKind === "text"}
                        onChange={() => setSourceKind("text")}
                        className="h-4 w-4 accent-accent-700"
                      />
                      Pegar texto
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="source_kind"
                        value="file"
                        checked={sourceKind === "file"}
                        onChange={() => setSourceKind("file")}
                        className="h-4 w-4 accent-accent-700"
                      />
                      Subir archivo
                    </label>
                  </div>
                </div>

                {sourceKind === "text" ? (
                  <div>
                    <label htmlFor={textId} className="mb-1 block text-sm font-medium text-slate-700">
                      Texto del documento
                    </label>
                    <textarea
                      id={textId}
                      rows={8}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      className={inputClass}
                      aria-describedby={`${textId}-help`}
                    />
                    <p id={`${textId}-help`} className="mt-1 text-xs text-slate-500">
                      Un solo documento, hasta {limits.maxPastedChars.toLocaleString("es-CR")} caracteres
                      (unas 3 páginas). {text.length.toLocaleString("es-CR")} / {limits.maxPastedChars.toLocaleString("es-CR")}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label htmlFor={fileId} className="mb-1 block text-sm font-medium text-slate-700">
                      Archivo (.docx o PDF con texto seleccionable)
                    </label>
                    <input
                      id={fileId}
                      type="file"
                      accept={ACCEPT}
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                      aria-describedby={`${fileId}-help`}
                    />
                    <p id={`${fileId}-help`} className="mt-1 text-xs text-slate-500">
                      Un archivo, máximo {formatMegabytes(limits.maxFileBytes)} y {limits.maxPages} páginas.
                      No se admiten .doc, imágenes ni PDF escaneados (no se aplica OCR).
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor={variantsId} className="mb-1 block text-sm font-medium text-slate-700">
                    Variantes del documento (opcional)
                  </label>
                  <p id={variantsHelpId} className="mb-2 text-xs text-slate-500">
                    Indica si alguna parte de la escritura puede redactarse de distintas
                    maneras según el caso. LexCR intentará convertir esas variantes en
                    opciones dentro de un mismo machote, para evitar que tengas que crear
                    varios machotes casi iguales. Por ejemplo: «Chasis, VIN y serie pueden
                    ser iguales o diferentes» o «La hora puede indicarse solo con horas o
                    con horas y minutos». Este campo no es un chat.
                  </p>
                  <textarea
                    id={variantsId}
                    rows={3}
                    value={variants}
                    maxLength={limits.maxVariantInstructionsChars}
                    onChange={(event) => setVariants(event.target.value)}
                    className={inputClass}
                    aria-describedby={variantsHelpId}
                  />
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p>
                    El contenido del documento será procesado temporalmente por un
                    proveedor externo de inteligencia artificial para generar el machote.
                    LexCR no conservará el archivo original ni su texto después del
                    procesamiento. La inteligencia artificial puede cometer errores u
                    omisiones, por lo que debe revisar el resultado antes de utilizarlo.
                  </p>
                  <label htmlFor={consentId} className="mt-3 flex items-start gap-2 font-medium">
                    <input
                      id={consentId}
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-accent-700"
                    />
                    Entiendo y deseo continuar
                  </label>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                {pending && (
                  <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-accent-700"
                    />
                    <span>
                      <span className="font-medium">Analizando documento…</span>{" "}
                      {PROGRESS_MESSAGES[progressIndex]}
                    </span>
                  </div>
                )}
              </fieldset>

              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <button type="button" onClick={requestClose} disabled={pending} className={secondaryButton}>
                  Cancelar
                </button>
                <button type="submit" disabled={pending || !consent} className={primaryButton}>
                  {pending ? "Generando…" : "Generar machote"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
