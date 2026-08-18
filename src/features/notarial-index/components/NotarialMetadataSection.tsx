"use client";

/**
 * Sección "Datos para índice" del detalle de una Escritura: formulario de la
 * metadata notarial interna. La completitud se calcula sobre los campos
 * estructurados requeridos por el índice interno. Puede corregirse aun cuando
 * la Escritura esté finalizada, sin alterar el contenido de la Escritura.
 *
 * Reestructurado para "progressive disclosure" (mismos primitivos que
 * `TemplateIndexConfigurationSection` de Machotes): resumen configurado/
 * pendiente + filas compactas, una expandida a la vez. Los inputs reales
 * viven siempre montados fuera de la fila colapsable (mismo `<input>`, sin
 * duplicar `name`) — nunca dentro de `{open && children}`, para no repetir
 * el bug de FormData ya encontrado y corregido en Machotes.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  saveNotarialMetadataAction,
  type NotarialMetadataState,
} from "../server/metadata-actions";
import { setNotarialIndexInclusionAction } from "@/features/documents/server/lifecycle-actions";
import type { NotarialMetadata } from "../model/notarial";
import type {
  NotarialAuthorizedAtPrefill,
  NotarialMetadataPrefill,
  NotarialPrefillField,
} from "../model/prefill";
import {
  isNotarialComplete,
  joinMissingFieldLabels,
  notarialMissingFields,
} from "../model/notarial";
import { FieldError } from "@/components/forms/FieldError";
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import { CollapsibleFieldRow } from "./CollapsibleFieldRow";
import { useToast } from "@/components/feedback/Toast";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-60";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const initialState: NotarialMetadataState = {};

type RowId =
  | "instrument_number"
  | "authorized_at"
  | "act_name_override"
  | "protocol_book"
  | "folios"
  | "parties_override"
  | "notes";

type Props = {
  documentId: string;
  metadata: NotarialMetadata | null;
  prefill: NotarialMetadataPrefill;
  /** true cuando el contenido de la Escritura está finalizado. */
  readOnly: boolean;
  /** documents.edit — sin este permiso el formulario completo es de solo
   * lectura, sin importar el estado de la Escritura. */
  canEdit: boolean;
  canResetParties?: boolean;
  actNamePreview?: string | null;
  generatedPartiesPreview?: string | null;
  reviewRequired?: boolean;
  /** Pertenencia actual al Índice Notarial (independiente de `status`). */
  includeInNotarialIndex: boolean;
  /** documents.finalize — mismo permiso que finalizar/reabrir; sin él el
   * control se muestra pero deshabilitado. */
  canChangeInclusion: boolean;
};

export function NotarialMetadataSection({
  documentId,
  metadata,
  prefill,
  readOnly,
  canEdit,
  canResetParties = false,
  actNamePreview = null,
  generatedPartiesPreview = null,
  reviewRequired = false,
  includeInNotarialIndex,
  canChangeInclusion,
}: Props) {
  const headingId = useId();
  const action = saveNotarialMetadataAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const { showToast } = useToast();
  const [inclusion, setInclusion] = useState(includeInNotarialIndex);
  const [inclusionPending, setInclusionPending] = useState(false);
  const [inclusionError, setInclusionError] = useState<string | null>(null);

  async function handleInclusionChange(next: boolean) {
    if (
      !next &&
      !window.confirm(
        "La escritura dejará de aparecer en el Índice Notarial. El contenido de la escritura no se modifica y podrás volver a incluirla cuando quieras. ¿Deseas continuar?",
      )
    ) {
      return;
    }
    setInclusionError(null);
    setInclusionPending(true);
    const result = await setNotarialIndexInclusionAction(documentId, next);
    setInclusionPending(false);
    if (result.success && result.includeInNotarialIndex !== undefined) {
      setInclusion(result.includeInNotarialIndex);
      showToast(
        result.includeInNotarialIndex
          ? "Incluida en el Índice Notarial."
          : "Excluida del Índice Notarial.",
      );
    } else {
      setInclusionError(result.message ?? "No fue posible actualizar el Índice Notarial.");
    }
  }
  const lastSuccessState = useRef<NotarialMetadataState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccessState.current !== state) {
      lastSuccessState.current = state;
      showToast(state.successMessage ?? "Cambios del índice guardados.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Valores controlados para el badge de completitud en vivo.
  //
  // `source === "suggestion"` (número de instrumento, tomo, folios cuando no
  // hay mapeo del machote) es una estimación — "el siguiente número", "el
  // último tomo usado en otra Escritura" — no un dato real de ESTA Escritura,
  // a diferencia de `"template"` (interpretado de un valor que el usuario ya
  // escribió en el propio documento). Precargar una sugerencia en el campo
  // editable la volvería indistinguible de un valor real: el badge la
  // mostraría como "Configurado", y como el submit siempre envía este mismo
  // estado (ver el bloque de inputs ocultos más abajo), un guardado disparado
  // por CUALQUIER otro campo la persistiría como si el usuario la hubiera
  // escrito. Por eso una sugerencia arranca el campo vacío — se ofrece solo
  // como texto de ayuda (`PrefillHelp`) hasta que el usuario la acepte
  // explícitamente.
  const startingValue = (field: NotarialPrefillField) =>
    field.source === "suggestion" ? "" : field.value;
  const [instrument, setInstrument] = useState(
    startingValue(prefill.instrumentNumber),
  );
  const [authorizedAt, setAuthorizedAt] = useState(prefill.authorizedAt.value);
  const [protocolBook, setProtocolBook] = useState(
    startingValue(prefill.protocolBook),
  );
  const [initialFolio, setInitialFolio] = useState(
    startingValue(prefill.initialFolio),
  );
  const [finalFolio, setFinalFolio] = useState(startingValue(prefill.finalFolio));
  const [actName, setActName] = useState(prefill.actName.value);
  const [parties, setParties] = useState(metadata?.parties_override ?? "");
  const [notes, setNotes] = useState(metadata?.notes ?? "");
  const [openRowId, setOpenRowId] = useState<RowId | null>(null);
  const [previousActionState, setPreviousActionState] = useState(state);
  if (state !== previousActionState) {
    setPreviousActionState(state);
    if (state.resetParties) setParties("");
    if (state.errors && Object.keys(state.errors).length > 0) {
      const firstErrorRow = ROW_FOR_ERROR.find((row) => state.errors?.[row.errorKey]);
      if (firstErrorRow) setOpenRowId(firstErrorRow.id);
    }
  }

  const liveMetadata = {
    instrument_number: Number(instrument),
    authorized_at: authorizedAt,
    protocol_book: protocolBook,
    initial_folio: initialFolio,
    final_folio: finalFolio,
    act_name_override: actName,
    act_name_snapshot: metadata?.act_name_snapshot ?? actNamePreview,
    parties_override: parties,
    generated_parties:
      metadata?.generated_parties ?? generatedPartiesPreview,
  };
  const complete = isNotarialComplete(liveMetadata);
  const missingFields = notarialMissingFields(liveMetadata);

  function toggleRow(id: RowId) {
    setOpenRowId((current) => (current === id ? null : id));
  }

  const instrumentConfigured = instrument !== "" && Number(instrument) > 0;
  const authorizedAtConfigured = authorizedAt !== "";
  const protocolBookConfigured = protocolBook.trim() !== "";
  const foliosConfigured = initialFolio.trim() !== "" && finalFolio.trim() !== "";
  const actNameConfigured =
    actName.trim() !== "" || !!(metadata?.act_name_snapshot ?? actNamePreview);
  const partiesFallback = metadata?.generated_parties ?? generatedPartiesPreview;
  const partiesConfigured = parties.trim() !== "" || !!partiesFallback;

  const requiredRows = [
    instrumentConfigured,
    authorizedAtConfigured,
    protocolBookConfigured,
    foliosConfigured,
    actNameConfigured,
    partiesConfigured,
  ];
  const configuredCount = requiredRows.filter(Boolean).length;
  const pendingCount = requiredRows.length - configuredCount;

  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <h2 id={headingId} className="text-sm font-semibold text-slate-900">
          Datos para índice
        </h2>
        <p className="text-xs text-slate-500">
          Metadata interna para organizar el índice notarial. «Completo»
          significa completo según los campos del sistema, no una validación
          legal.
        </p>
      </div>

      <div className="flex items-start gap-2 border-b border-slate-100 px-6 py-4">
        <input
          id="notarial-inclusion-toggle"
          type="checkbox"
          checked={inclusion}
          disabled={!canChangeInclusion || inclusionPending}
          onChange={(event) => handleInclusionChange(event.target.checked)}
          className="mt-0.5 size-4 accent-accent-700"
        />
        <label htmlFor="notarial-inclusion-toggle" className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">
            Incluir en el Índice Notarial
          </span>
          <br />
          {inclusion
            ? "Esta escritura aparece en el Índice Notarial."
            : "Esta escritura está excluida del Índice Notarial. El contenido no se ve afectado."}
        </label>
      </div>
      {inclusionError && (
        <p role="alert" className="border-b border-slate-100 px-6 py-2 text-xs text-red-700">
          {inclusionError}
        </p>
      )}

      <form action={formAction} noValidate className="px-6 py-6">
        {state.message && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}
        {!canEdit && (
          <div
            role="status"
            className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
          >
            Tu rol no permite editar los datos del índice. Los ves en modo
            lectura.
          </div>
        )}
        {canEdit && readOnly && (
          <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            La escritura está finalizada. Puedes corregir estos datos del
            índice sin modificar el contenido de la escritura.
          </div>
        )}
        {reviewRequired && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            El contenido de la escritura cambió después del último guardado de
            estos datos. Revísalos antes de preparar el índice; no se modificó
            ningún valor manual.
          </div>
        )}

        <IndexSummaryHeader
          configuredCount={configuredCount}
          pendingCount={pendingCount}
          helperText="Completo significa completo según los campos del sistema, no una validación legal."
          hasWarning={!complete}
          warningMessage={
            complete
              ? undefined
              : `Faltan datos para completar el Índice: ${joinMissingFieldLabels(missingFields)}.`
          }
        />

        <input type="hidden" name="version" value={metadata?.version ?? 1} />

        {/* Fuera de las filas colapsables a propósito: si vivieran dentro de
            `CollapsibleFieldRow`, dejarían de enviarse en el submit en
            cuanto la fila estuviera cerrada (su contenido no se monta
            mientras está colapsada) — incluso si nunca se abrió en esta
            sesión, como el valor precargado de un campo ya guardado. Los
            inputs visibles equivalentes dentro de cada fila ya no llevan
            `name`, solo editan este mismo estado. */}
        <input type="hidden" name="instrument_number" value={instrument} />
        <input type="hidden" name="authorized_at" value={authorizedAt} />
        <input type="hidden" name="act_name_override" value={actName} />
        <input type="hidden" name="protocol_book" value={protocolBook} />
        <input type="hidden" name="initial_folio" value={initialFolio} />
        <input type="hidden" name="final_folio" value={finalFolio} />
        <input type="hidden" name="parties_override" value={parties} />
        <input type="hidden" name="notes" value={notes} />

        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          <CollapsibleFieldRow
            id="notarial-instrument"
            name="Número de instrumento"
            meta={instrument || "Sin configurar"}
            status={instrumentConfigured ? "configured" : "pending"}
            open={openRowId === "instrument_number"}
            onToggle={() => toggleRow("instrument_number")}
          >
            <label htmlFor="instrument_number" className={labelClass}>
              Número de instrumento
            </label>
            <input
              id="instrument_number"
              type="number"
              min={1}
              step={1}
              disabled={!canEdit}
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.instrument_number}
              aria-describedby={
                state.errors?.instrument_number
                  ? "instrument_number-error"
                  : undefined
              }
            />
            <FieldError
              id="instrument_number-error"
              message={state.errors?.instrument_number}
            />
            <PrefillHelp
              field={prefill.instrumentNumber}
              onUseSuggestion={setInstrument}
            />
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-authorized-at"
            name="Fecha y hora de autorización"
            meta={
              authorizedAt
                ? formatDateTimeMeta(authorizedAt)
                : "Fecha de autorización pendiente"
            }
            status={authorizedAtConfigured ? "configured" : "pending"}
            open={openRowId === "authorized_at"}
            onToggle={() => toggleRow("authorized_at")}
          >
            <label htmlFor="authorized_at" className={labelClass}>
              Fecha y hora de autorización
            </label>
            <input
              id="authorized_at"
              type="datetime-local"
              disabled={!canEdit}
              value={authorizedAt}
              onChange={(e) => setAuthorizedAt(e.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.authorized_at}
              aria-describedby={
                state.errors?.authorized_at ? "authorized_at-error" : undefined
              }
            />
            <FieldError
              id="authorized_at-error"
              message={state.errors?.authorized_at}
            />
            <AuthorizedAtPrefillHelp field={prefill.authorizedAt} />
            <p className="mt-1 text-xs text-slate-400">Hora de Costa Rica.</p>
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-act-name"
            name="Acto o contrato"
            meta={actName || metadata?.act_name_snapshot || actNamePreview || "Sin configurar"}
            status={actNameConfigured ? "configured" : "pending"}
            open={openRowId === "act_name_override"}
            onToggle={() => toggleRow("act_name_override")}
          >
            <label htmlFor="act_name_override" className={labelClass}>
              Acto o contrato
            </label>
            <input
              id="act_name_override"
              type="text"
              disabled={!canEdit}
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              className={inputClass}
              placeholder={metadata?.act_name_snapshot ?? "Nombre del machote"}
              aria-invalid={!!state.errors?.act_name_override}
              aria-describedby={
                state.errors?.act_name_override
                  ? "act_name_override-error"
                  : undefined
              }
            />
            <FieldError
              id="act_name_override-error"
              message={state.errors?.act_name_override}
            />
            <PrefillHelp field={prefill.actName} />
            <p className="mt-1 text-xs text-slate-400">
              Si queda vacío, se usa el nombre guardado del machote.
            </p>
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-protocol-book"
            name="Tomo"
            meta={protocolBook || "Sin configurar"}
            status={protocolBookConfigured ? "configured" : "pending"}
            open={openRowId === "protocol_book"}
            onToggle={() => toggleRow("protocol_book")}
          >
            <label htmlFor="protocol_book" className={labelClass}>
              Tomo
            </label>
            <input
              id="protocol_book"
              type="text"
              disabled={!canEdit}
              value={protocolBook}
              onChange={(event) => setProtocolBook(event.target.value)}
              className={inputClass}
              aria-invalid={!!state.errors?.protocol_book}
              aria-describedby={
                state.errors?.protocol_book ? "protocol_book-error" : undefined
              }
            />
            <FieldError
              id="protocol_book-error"
              message={state.errors?.protocol_book}
            />
            <PrefillHelp
              field={prefill.protocolBook}
              onUseSuggestion={setProtocolBook}
            />
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-folios"
            name="Folios"
            meta={
              foliosConfigured
                ? `${initialFolio} – ${finalFolio}`
                : "Sin configurar"
            }
            status={foliosConfigured ? "configured" : "pending"}
            open={openRowId === "folios"}
            onToggle={() => toggleRow("folios")}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="initial_folio" className={labelClass}>
                  Folio inicial
                </label>
                <input
                  id="initial_folio"
                  type="text"
                  disabled={!canEdit}
                  value={initialFolio}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (finalFolio === "" || finalFolio === initialFolio) {
                      setFinalFolio(next);
                    }
                    setInitialFolio(next);
                  }}
                  className={inputClass}
                  aria-invalid={!!state.errors?.initial_folio}
                  aria-describedby={
                    state.errors?.initial_folio ? "initial_folio-error" : undefined
                  }
                />
                <FieldError
                  id="initial_folio-error"
                  message={state.errors?.initial_folio}
                />
                <PrefillHelp
                  field={prefill.initialFolio}
                  onUseSuggestion={setInitialFolio}
                />
              </div>
              <div>
                <label htmlFor="final_folio" className={labelClass}>
                  Folio final
                </label>
                <input
                  id="final_folio"
                  type="text"
                  disabled={!canEdit}
                  value={finalFolio}
                  onChange={(event) => setFinalFolio(event.target.value)}
                  className={inputClass}
                  aria-invalid={!!state.errors?.final_folio}
                  aria-describedby={
                    state.errors?.final_folio ? "final_folio-error" : undefined
                  }
                />
                <FieldError
                  id="final_folio-error"
                  message={state.errors?.final_folio}
                />
                <PrefillHelp
                  field={prefill.finalFolio}
                  onUseSuggestion={setFinalFolio}
                />
              </div>
            </div>
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-parties"
            name="Partes"
            meta={
              parties.trim() !== ""
                ? "Corrección manual"
                : partiesFallback
                  ? "Generado desde el machote"
                  : "Sin configurar"
            }
            status={partiesConfigured ? "configured" : "pending"}
            open={openRowId === "parties_override"}
            onToggle={() => toggleRow("parties_override")}
          >
            <label htmlFor="parties_override" className={labelClass}>
              Partes
            </label>
            <textarea
              id="parties_override"
              rows={3}
              disabled={!canEdit}
              value={parties}
              onChange={(event) => setParties(event.target.value)}
              placeholder={
                partiesFallback ?? "Se generará desde la configuración del machote"
              }
              className={inputClass + " resize-y"}
              aria-invalid={!!state.errors?.parties_override}
              aria-describedby={
                state.errors?.parties_override
                  ? "parties_override-error"
                  : undefined
              }
            />
            <FieldError
              id="parties_override-error"
              message={state.errors?.parties_override}
            />
            <PrefillHelp field={prefill.parties} />
            <p className="mt-1 text-xs text-slate-400">
              Una corrección manual tiene prioridad sobre el valor generado.
            </p>
            {canEdit && canResetParties && metadata && (
              <button
                type="submit"
                name="intent"
                value="reset-parties"
                disabled={pending}
                onClick={(event) => {
                  if (
                    metadata.parties_override &&
                    !window.confirm(
                      "Se reemplazará la corrección manual de Partes con el valor actual del machote. ¿Deseas continuar?",
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
                className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Restablecer desde el machote
              </button>
            )}
          </CollapsibleFieldRow>

          <CollapsibleFieldRow
            id="notarial-notes"
            name="Notas internas"
            meta="Opcional"
            status="optional"
            open={openRowId === "notes"}
            onToggle={() => toggleRow("notes")}
          >
            <label htmlFor="notes" className={labelClass}>
              Notas internas{" "}
              <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              disabled={!canEdit}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={inputClass + " resize-y"}
            />
            <p className="mt-1 text-xs text-slate-400">
              Uso interno; no se incluyen en la exportación del índice.
            </p>
          </CollapsibleFieldRow>
        </div>

        {canEdit && (
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={pending}
              className="rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? "Guardando…" : "Guardar datos del índice"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

const ROW_FOR_ERROR: Array<{ id: RowId; errorKey: string }> = [
  { id: "instrument_number", errorKey: "instrument_number" },
  { id: "authorized_at", errorKey: "authorized_at" },
  { id: "act_name_override", errorKey: "act_name_override" },
  { id: "protocol_book", errorKey: "protocol_book" },
  { id: "folios", errorKey: "initial_folio" },
  { id: "folios", errorKey: "final_folio" },
  { id: "parties_override", errorKey: "parties_override" },
];

function formatDateTimeMeta(value: string): string {
  return value.replace("T", " ");
}

function PrefillHelp({
  field,
  onUseSuggestion,
}: {
  field: NotarialPrefillField;
  /** Presente solo para campos con sugerencia (número/tomo/folios). */
  onUseSuggestion?: (value: string) => void;
}) {
  if (!field.rawValue) {
    if (field.source === "suggestion" && field.value) {
      return (
        <p className="mt-1 text-xs text-slate-500">
          Sugerencia: {field.value}.{" "}
          {onUseSuggestion ? (
            <button
              type="button"
              onClick={() => onUseSuggestion(field.value)}
              className="font-medium text-accent-700 hover:underline focus:outline-none focus:underline"
            >
              Usar este valor
            </button>
          ) : (
            "Escríbelo si aplica."
          )}{" "}
          No se guarda hasta que lo confirmes.
        </p>
      );
    }
    if (field.source !== "template") return null;
    return (
      <p className="mt-1 text-xs text-slate-500">
        El valor fue precargado desde el machote. Revísalo antes de preparar el
        índice.
      </p>
    );
  }

  if (!field.compatible) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p className="font-medium">
          No pudimos interpretar este valor para el Índice Notarial.
        </p>
        <p className="mt-1">Original: “{field.rawValue}”</p>
        <p>Estado: Requiere revisión y corrección manual.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <p>Original: “{field.rawValue}”</p>
      <p>Interpretado: {field.value}</p>
      <p>
        Estado: Listo{field.source === "saved" ? " · corrección guardada" : ""}
      </p>
    </div>
  );
}

function AuthorizedAtPrefillHelp({
  field,
}: {
  field: NotarialAuthorizedAtPrefill;
}) {
  const rawValue = [field.rawDate, field.rawTime].filter(Boolean).join(" / ");
  if (field.optionBlockName) {
    return (
      <div
        className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
          field.compatible
            ? "border-slate-200 bg-slate-50 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        <p>Fuente: Bloque de opciones · {field.optionBlockName}</p>
        {field.optionVariantLabel && (
          <p>Variante: {field.optionVariantLabel}</p>
        )}
        {rawValue && <p>Original: “{rawValue}”</p>}
        {field.compatible ? (
          <>
            <p>Interpretado: {field.value}</p>
            <p>
              Estado: Listo
              {field.source === "saved" ? " · corrección guardada" : ""}
            </p>
          </>
        ) : (
          <p>Estado: Requiere revisión y corrección manual.</p>
        )}
      </div>
    );
  }
  return <PrefillHelp field={{ ...field, rawValue: rawValue || undefined }} />;
}
