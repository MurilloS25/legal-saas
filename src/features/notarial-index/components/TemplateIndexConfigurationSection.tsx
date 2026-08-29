"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/feedback/Toast";
import { generateIndexParties } from "../model/parties";
import type {
  InvalidIndexMapping,
  SimpleIndexMappingKey,
  TemplateIndexConfiguration,
} from "../model/template-index-configuration";
import {
  saveTemplateIndexConfigurationAction,
  setTemplateNotarialIndexDefaultAction,
  type TemplateIndexConfigurationState,
} from "../server/template-index-config-actions";
import type { TemplateOptionBlockAttrs } from "@/lib/editor/types";
import type { OptionBlockSummary } from "@/lib/editor/option-blocks";
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import { CollapsibleFieldRow } from "./CollapsibleFieldRow";
import { OptionBlockTimeMappingEditor } from "./OptionBlockTimeMappingEditor";
import { Button } from "@/components/ui/Button";

export type IndexConfigurationField = {
  id: string;
  fieldKey: string;
  label: string;
};

/** Todos los Bloques de opciones del Machote — no solo los que ya tienen
 * mapeo Hora/Minutos, porque esta pantalla es ahora quien lo configura (ver
 * `OptionBlockTimeMappingEditor`). */
export type IndexConfigurationOptionBlock = OptionBlockSummary;

type Props = {
  templateId: string;
  fields: IndexConfigurationField[];
  optionBlocks: IndexConfigurationOptionBlock[];
  configuration: TemplateIndexConfiguration | null;
  /** templates.write — sin este permiso, toda la sección es de solo
   * lectura. */
  readOnly?: boolean;
  /** Valor que heredarán las nuevas Escrituras creadas desde este Machote
   * (documents.include_in_notarial_index al crear — snapshot, no vínculo
   * permanente). */
  includeByDefault: boolean;
  /** Notifica el `updated_at` fresco del Machote tras guardar el toggle —
   * quien lo reciba debe resincronizar su propio `expected_updated_at` para
   * evitar un conflicto optimista contra el propio usuario. */
  onIncludeByDefaultSaved?: (updatedAt: string) => void;
  /** Aplica el mapeo Hora/Minutos de un Bloque de opciones al documento en
   * vivo del editor (ver `OptionBlockTimeMappingEditor`) — persiste con el
   * guardado normal del Machote, no con esta pantalla. */
  onSaveOptionBlockTimeMapping?: (
    blockId: string,
    structuredOutput: TemplateOptionBlockAttrs["structuredOutput"],
  ) => void;
};

const SIMPLE_FIELDS: Array<{
  key: SimpleIndexMappingKey;
  label: string;
}> = [
  { key: "instrument_number", label: "Número de instrumento" },
  { key: "authorized_date", label: "Fecha de autorización" },
  { key: "authorized_time", label: "Hora de autorización" },
  { key: "protocol_book", label: "Tomo" },
  { key: "initial_folio", label: "Folio inicial" },
  { key: "final_folio", label: "Folio final" },
];

const INVALID_LABELS: Record<InvalidIndexMapping, string> = {
  instrument_number: "Número de instrumento",
  authorized_date: "Fecha de autorización",
  authorized_time: "Hora de autorización",
  protocol_book: "Tomo",
  initial_folio: "Folio inicial",
  final_folio: "Folio final",
  parties: "Partes",
};

const initialState: TemplateIndexConfigurationState = {};
const inputClass =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500";

function initialSimpleFieldValue(
  key: SimpleIndexMappingKey,
  configuration: TemplateIndexConfiguration | null,
): string {
  if (key === "authorized_time") {
    if (configuration?.authorizedTimeOptionBlockId) {
      return `block:${configuration.authorizedTimeOptionBlockId}`;
    }
    return configuration?.simpleFields[key]
      ? `field:${configuration.simpleFields[key]}`
      : "";
  }
  return configuration?.simpleFields[key] ?? "";
}

export function TemplateIndexConfigurationSection({
  templateId,
  fields,
  optionBlocks,
  configuration,
  readOnly = false,
  includeByDefault,
  onIncludeByDefaultSaved,
  onSaveOptionBlockTimeMapping,
}: Props) {
  const { showToast } = useToast();
  const [inclusion, setInclusion] = useState(includeByDefault);
  const [inclusionPending, setInclusionPending] = useState(false);
  const [inclusionError, setInclusionError] = useState<string | null>(null);
  // Mismo riesgo de estado local obsoleto ya corregido en
  // NotarialMetadataSection (ver 20260818140000): este componente tampoco
  // se desmonta al navegar entre pasos del Machote, así que se resincroniza
  // explícitamente cuando el prop del servidor cambia de verdad.
  const lastSyncedInclusion = useRef(includeByDefault);
  useEffect(() => {
    if (lastSyncedInclusion.current !== includeByDefault) {
      lastSyncedInclusion.current = includeByDefault;
      setInclusion(includeByDefault);
    }
  }, [includeByDefault]);

  async function handleInclusionChange(next: boolean) {
    setInclusionError(null);
    setInclusionPending(true);
    const result = await setTemplateNotarialIndexDefaultAction(templateId, next);
    setInclusionPending(false);
    if (result.success && result.includeByDefault !== undefined) {
      lastSyncedInclusion.current = result.includeByDefault;
      setInclusion(result.includeByDefault);
      if (result.updatedAt) onIncludeByDefaultSaved?.(result.updatedAt);
      showToast(
        result.includeByDefault
          ? "Las nuevas Escrituras de este Machote se incluirán en el Índice Notarial."
          : "Las nuevas Escrituras de este Machote no se incluirán en el Índice Notarial.",
      );
    } else {
      setInclusionError(
        result.message ?? "No fue posible actualizar la configuración del Índice.",
      );
    }
  }

  const availableIds = useMemo(
    () => new Set(fields.map((field) => field.id)),
    [fields],
  );
  const [selectedIds, setSelectedIds] = useState(() =>
    (configuration?.fields ?? [])
      .map((field) => field.templateFieldId)
      .filter((id) => availableIds.has(id)),
  );
  const [separator, setSeparator] = useState(
    configuration?.partySeparator ?? " Y ",
  );
  const [fixedSuffix, setFixedSuffix] = useState(
    configuration?.fixedSuffix ?? "",
  );
  const [allowEmpty, setAllowEmpty] = useState(
    configuration?.allowEmpty ?? false,
  );
  const [partiesSearch, setPartiesSearch] = useState("");
  // Índice resaltado por teclado dentro de `visibleFields` — patrón ARIA
  // combobox+listbox (mismo que `ClientCombobox`), adaptado a multi-select:
  // Enter alterna (no reemplaza) la variable resaltada, así que el
  // reordenamiento con ↑/↓ y la selección múltiple siguen funcionando.
  const [partiesActiveIndex, setPartiesActiveIndex] = useState(0);
  const partiesListboxId = useId();
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  // Los 6 selects simples eran no-controlados (`defaultValue`) porque su
  // valor solo importaba al enviar el formulario. La presentación
  // compacta necesita conocer su valor actual para mostrar el estado
  // "Configurado"/"Pendiente" de cada fila sin esperar a un guardado —
  // por eso pasan a ser controlados aquí. El `name` de cada `<select>`
  // sigue exactamente igual, así que el envío del formulario (y por lo
  // tanto la Server Action / RPC) no cambia en absoluto.
  const [simpleFieldValues, setSimpleFieldValues] = useState<
    Record<SimpleIndexMappingKey, string>
  >(() => {
    const initial = {} as Record<SimpleIndexMappingKey, string>;
    for (const { key } of SIMPLE_FIELDS) {
      initial[key] = initialSimpleFieldValue(key, configuration);
    }
    return initial;
  });

  const action = saveTemplateIndexConfigurationAction.bind(null, templateId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const lastSuccessState = useRef<TemplateIndexConfigurationState | null>(null);
  useEffect(() => {
    if (state.success && lastSuccessState.current !== state) {
      lastSuccessState.current = state;
      showToast("Configuración guardada.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Los errores de `party_separator`/`fixed_suffix`/`template_field_ids`
  // solo se muestran dentro de la fila "Partes" — si esa fila estaba
  // colapsada al enviar el formulario, el error de guardado quedaría
  // invisible sin este auto-expand. Se ajusta durante el render (patrón
  // recomendado por React para reaccionar a un cambio de state ya
  // calculado) en vez de en un efecto, para evitar un render en cascada.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (
      state.errors?.template_field_ids ||
      state.errors?.party_separator ||
      state.errors?.fixed_suffix
    ) {
      setOpenRowId("parties");
    }
  }
  const fieldsById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const optionBlocksById = useMemo(
    () => new Map(optionBlocks.map((block) => [block.blockId, block])),
    [optionBlocks],
  );
  const preview = generateIndexParties({
    fields: selectedIds.map((id, order) => ({
      templateFieldId: id,
      order,
      value: fieldsById.get(id)?.label ?? "",
    })),
    separator,
    fixedSuffix,
  });
  const previewIncomplete = configuration != null && !configuration.isComplete;
  const previewMessage =
    selectedIds.length === 0
      ? "Aún no se han configurado Partes."
      : previewIncomplete
        ? "La configuración está incompleta. Revisa las variables señaladas."
        : preview || "Aún no se han configurado Partes.";

  function toggleField(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, id]
        : current.filter((candidate) => candidate !== id),
    );
  }

  function moveField(id: string, direction: -1 | 1) {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handlePartiesSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPartiesActiveIndex((current) =>
        Math.min(current + 1, visibleFields.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setPartiesActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      const field = visibleFields[partiesActiveIndex];
      if (!field) return;
      event.preventDefault();
      toggleField(field.id, !selectedIds.includes(field.id));
    } else if (event.key === "Escape") {
      if (partiesSearch !== "") {
        event.preventDefault();
        setPartiesSearch("");
      }
    }
  }

  function simpleFieldMeta(key: SimpleIndexMappingKey): string {
    const raw = simpleFieldValues[key];
    if (!raw) return "Sin configurar";
    if (key === "authorized_time") {
      if (raw.startsWith("block:")) {
        const block = optionBlocksById.get(raw.slice("block:".length));
        return block ? `Bloque de opciones · ${block.name}` : "Bloque de opciones";
      }
      if (raw.startsWith("field:")) {
        const field = fieldsById.get(raw.slice("field:".length));
        return field ? `Variable · ${field.label}` : "Variable";
      }
      return "Sin configurar";
    }
    const field = fieldsById.get(raw);
    return field ? `Variable · ${field.label}` : "Sin configurar";
  }

  const orderedFields = [
    ...selectedIds.flatMap((id) => {
      const field = fieldsById.get(id);
      return field ? [field] : [];
    }),
    ...fields.filter((field) => !selectedIds.includes(field.id)),
  ];

  // La búsqueda solo oculta candidatos sin seleccionar: un campo ya elegido
  // permanece visible para poder reordenarlo o quitarlo aunque no coincida
  // con el texto buscado.
  const normalizedSearch = partiesSearch.trim().toLocaleLowerCase("es-CR");
  const visibleFields = orderedFields.filter((field) => {
    if (selectedIds.includes(field.id)) return true;
    if (normalizedSearch === "") return true;
    return (
      field.label.toLocaleLowerCase("es-CR").includes(normalizedSearch) ||
      field.fieldKey.toLocaleLowerCase("es-CR").includes(normalizedSearch)
    );
  });
  // Filtrar (o vaciar la selección) puede dejar `partiesActiveIndex`
  // apuntando fuera de rango — se ajusta durante el render, mismo patrón
  // que el resto de este componente (ver auto-expand de errores arriba).
  const clampedPartiesActiveIndex = Math.min(
    partiesActiveIndex,
    Math.max(visibleFields.length - 1, 0),
  );
  if (clampedPartiesActiveIndex !== partiesActiveIndex) {
    setPartiesActiveIndex(clampedPartiesActiveIndex);
  }

  const simpleConfiguredCount = SIMPLE_FIELDS.filter(
    ({ key }) => simpleFieldValues[key] !== "",
  ).length;
  const partiesConfigured = selectedIds.length > 0;
  const partiesStatus: "configured" | "pending" | "optional" = partiesConfigured
    ? "configured"
    : allowEmpty
      ? "optional"
      : "pending";
  const configuredCount = simpleConfiguredCount + (partiesConfigured ? 1 : 0);
  const pendingCount =
    SIMPLE_FIELDS.length -
    simpleConfiguredCount +
    (partiesStatus === "pending" ? 1 : 0);

  const hasWarning = !!(configuration && !configuration.isComplete);
  const warningMessage = hasWarning
    ? `La configuración necesita revisión. Se eliminaron campos asociados a: ${
        configuration!.invalidMappings.map((key) => INVALID_LABELS[key]).join(", ") ||
        "Partes"
      }.`
    : undefined;

  function toggleRow(id: string) {
    setOpenRowId((current) => (current === id ? null : id));
  }

  return (
    <section
      aria-label="Configuración del índice notarial"
      className="rounded-xl border border-ink-100 bg-white shadow-ink-sm"
    >
      <div className="px-6 py-4 text-sm font-semibold text-ink-900 border-b border-ink-100">
        Configuración del índice notarial
      </div>

      <div className="flex items-start gap-2 border-b border-ink-100 px-6 py-4">
        <input
          id="template-notarial-inclusion-toggle"
          type="checkbox"
          checked={inclusion}
          disabled={readOnly || inclusionPending}
          onChange={(event) => handleInclusionChange(event.target.checked)}
          className="mt-0.5 size-4 rounded accent-accent-600"
        />
        <label
          htmlFor="template-notarial-inclusion-toggle"
          className="text-sm text-ink-700"
        >
          <span className="font-medium text-ink-900">
            Incluir en Índice Notarial
          </span>
          <br />
          Las nuevas Escrituras creadas desde este Machote aparecerán en el
          Índice Notarial por defecto. Podrás cambiar esta decisión
          individualmente en una Escritura si fuera necesario.
        </label>
      </div>
      {inclusionError && (
        <p role="alert" className="border-b border-ink-100 px-6 py-2 text-xs text-red-700">
          {inclusionError}
        </p>
      )}
      {!inclusion && (
        <p className="border-b border-ink-100 px-6 py-4 text-sm text-ink-500">
          Este Machote no utilizará configuración del Índice.
        </p>
      )}

      <form
        action={formAction}
        className="px-6 py-5"
        hidden={!inclusion}
      >
        {readOnly && (
          <div
            role="status"
            className="mb-4 rounded-lg bg-ink-100/60 border border-ink-200 px-4 py-3 text-sm text-ink-600"
          >
            Tu rol no permite editar la configuración del índice. La ves en
            modo lectura.
          </div>
        )}

        <IndexSummaryHeader
          configuredCount={configuredCount}
          pendingCount={pendingCount}
          helperText="Esta configuración es opcional. Permite precargar automáticamente el Índice al crear una Escritura con este machote. Los valores siempre podrán corregirse en cada Escritura."
          hasWarning={hasWarning}
          warningMessage={warningMessage}
        />

        {state.errors?.simple_fields && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {state.errors.simple_fields}
          </p>
        )}

        {/* Fuera de las filas colapsables a propósito, mismo motivo que los
            demás inputs ocultos de esta sección: deben seguir en el
            FormData sin importar qué fila esté abierta al momento del
            submit. */}
        {SIMPLE_FIELDS.map(({ key }) => (
          <input
            key={key}
            type="hidden"
            name={key === "authorized_time" ? "authorized_time_source" : `${key}_field_id`}
            value={simpleFieldValues[key]}
          />
        ))}

        <div className="divide-y divide-ink-100 rounded-xl border border-ink-200 overflow-hidden">
          {SIMPLE_FIELDS.map(({ key, label }) => (
            <CollapsibleFieldRow
              key={key}
              id={`idx-${key}`}
              name={label}
              meta={simpleFieldMeta(key)}
              status={simpleFieldValues[key] ? "configured" : "pending"}
              open={openRowId === key}
              onToggle={() => toggleRow(key)}
            >
              {/* Sin `name`: el `<input type="hidden">` fuera de la grilla de
                  filas es la única fuente real de este campo en el
                  FormData, para que siga enviándose aunque la fila esté
                  colapsada al momento del submit. */}
              <label
                htmlFor={`${key}_field_id`}
                className="mb-1 block text-xs font-medium text-ink-700"
              >
                Variable sugerida
              </label>
              <select
                id={`${key}_field_id`}
                value={simpleFieldValues[key]}
                onChange={(event) =>
                  setSimpleFieldValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                disabled={readOnly}
                className={inputClass}
              >
                <option value="">Sin asignar / ingreso manual</option>
                {key === "authorized_time" ? (
                  <>
                    <optgroup label="Variables">
                      {fields.map((field) => (
                        <option key={field.id} value={`field:${field.id}`}>
                          {field.label}
                        </option>
                      ))}
                    </optgroup>
                    {optionBlocks.length > 0 && (
                      <optgroup label="Bloques de opciones">
                        {optionBlocks.map((block) => (
                          <option
                            key={block.blockId}
                            value={`block:${block.blockId}`}
                          >
                            {block.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label}
                    </option>
                  ))
                )}
              </select>

              {key === "authorized_time" &&
                simpleFieldValues[key].startsWith("block:") &&
                onSaveOptionBlockTimeMapping &&
                (() => {
                  const selectedBlock = optionBlocks.find(
                    (block) =>
                      `block:${block.blockId}` === simpleFieldValues[key],
                  );
                  if (!selectedBlock) return null;
                  return (
                    <>
                      {selectedBlock.structuredOutput?.type !== "time" && (
                        <p className="mt-2 text-xs text-amber-700">
                          Este bloque todavía no tiene mapeo de hora guardado
                          — configúralo abajo y guarda los cambios del
                          machote antes de guardar esta selección.
                        </p>
                      )}
                      <OptionBlockTimeMappingEditor
                        key={selectedBlock.blockId}
                        block={selectedBlock}
                        fields={fields.map((field) => ({
                          fieldKey: field.fieldKey,
                          label: field.label,
                        }))}
                        readOnly={readOnly}
                        onSave={onSaveOptionBlockTimeMapping}
                      />
                    </>
                  );
                })()}
            </CollapsibleFieldRow>
          ))}

          <CollapsibleFieldRow
            id="idx-parties"
            name="Partes"
            meta={
              partiesConfigured
                ? `${selectedIds.length} variable${selectedIds.length === 1 ? "" : "s"} seleccionada${selectedIds.length === 1 ? "" : "s"}`
                : allowEmpty
                  ? "Confirmado sin Partes"
                  : "¿Quiénes aparecen en la columna “Partes”?"
            }
            status={partiesStatus}
            statusLabel={partiesStatus === "optional" ? "Confirmado" : undefined}
            open={openRowId === "parties"}
            onToggle={() => toggleRow("parties")}
          >
            <p className="text-xs text-ink-500">
              Selecciona las variables que representan a las personas o
              entidades que deben aparecer en la columna &ldquo;Partes&rdquo;
              del índice.
            </p>
            <input
              type="text"
              role="combobox"
              value={partiesSearch}
              onChange={(event) => {
                setPartiesSearch(event.target.value);
                setPartiesActiveIndex(0);
              }}
              onKeyDown={handlePartiesSearchKeyDown}
              disabled={readOnly}
              placeholder="Buscar variable…"
              aria-label="Buscar variable para Partes"
              aria-expanded="true"
              aria-controls={partiesListboxId}
              aria-activedescendant={
                visibleFields[clampedPartiesActiveIndex]
                  ? `${partiesListboxId}-option-${visibleFields[clampedPartiesActiveIndex].id}`
                  : undefined
              }
              autoComplete="off"
              className={`${inputClass} mt-3`}
            />
            <div
              id={partiesListboxId}
              role="listbox"
              aria-label="Variables disponibles para Partes"
              className="mt-3 max-h-72 overflow-y-auto divide-y divide-ink-100 rounded-lg border border-ink-200"
            >
              {visibleFields.length === 0 && (
                <p className="px-3 py-4 text-sm text-ink-500">
                  Ninguna variable coincide con la búsqueda.
                </p>
              )}
              {visibleFields.map((field, index) => {
                const selectedIndex = selectedIds.indexOf(field.id);
                const selected = selectedIndex >= 0;
                const active = index === clampedPartiesActiveIndex;
                return (
                  <div
                    key={field.id}
                    id={`${partiesListboxId}-option-${field.id}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setPartiesActiveIndex(index)}
                    className={`flex min-h-12 items-center gap-3 px-3 py-2 transition-colors ${
                      active ? "bg-accent-50" : ""
                    }`}
                  >
                    <input
                      id={`index-party-${field.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleField(field.id, event.target.checked)}
                      disabled={readOnly}
                      className="h-4 w-4 rounded border-ink-200 text-accent-600 focus:ring-accent-500"
                    />
                    <label
                      htmlFor={`index-party-${field.id}`}
                      className="min-w-0 flex-1 text-sm text-ink-800"
                    >
                      <span className="font-medium">{field.label}</span>
                      <span className="ml-2 text-xs text-ink-500">{field.fieldKey}</span>
                    </label>
                    {selected && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Subir ${field.label}`}
                          disabled={readOnly || selectedIndex === 0}
                          onClick={() => moveField(field.id, -1)}
                          className="h-8 w-8 rounded-md border border-ink-200 hover:bg-ink-100/60 disabled:opacity-40 transition-colors"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${field.label}`}
                          disabled={readOnly || selectedIndex === selectedIds.length - 1}
                          onClick={() => moveField(field.id, 1)}
                          className="h-8 w-8 rounded-md border border-ink-200 hover:bg-ink-100/60 disabled:opacity-40 transition-colors"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="party_separator" className="mb-1 block text-xs font-medium text-ink-700">
                  Separador
                </label>
                <input
                  id="party_separator"
                  value={separator}
                  onChange={(event) => setSeparator(event.target.value)}
                  disabled={readOnly}
                  maxLength={30}
                  className={inputClass}
                />
                {state.errors?.party_separator && (
                  <p role="alert" className="mt-1 text-sm text-red-700">
                    {state.errors.party_separator}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="fixed_suffix" className="mb-1 block text-xs font-medium text-ink-700">
                  Texto fijo (opcional)
                </label>
                <input
                  id="fixed_suffix"
                  value={fixedSuffix}
                  onChange={(event) => setFixedSuffix(event.target.value)}
                  disabled={readOnly}
                  maxLength={200}
                  className={inputClass}
                />
                {state.errors?.fixed_suffix && (
                  <p role="alert" className="mt-1 text-sm text-red-700">
                    {state.errors.fixed_suffix}
                  </p>
                )}
              </div>
            </div>

            {selectedIds.length === 0 && (
              <div className="mt-4">
                <p className="text-sm text-ink-600">
                  Este Machote no necesita generar automáticamente el campo
                  &ldquo;Partes&rdquo; del índice.
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Podrás completarlo manualmente en cada Escritura.
                </p>
                <label className="mt-2 flex items-start gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={allowEmpty}
                    onChange={(event) => setAllowEmpty(event.target.checked)}
                    disabled={readOnly}
                    className="mt-0.5 h-4 w-4 rounded border-ink-200"
                  />
                  Confirmo que este machote no requiere Partes para el índice.
                </label>
              </div>
            )}

            {state.errors?.template_field_ids && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {state.errors.template_field_ids}
              </p>
            )}

            <div className="mt-4 rounded-lg bg-ink-100/50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-ink-500">Vista previa</p>
              <p
                className={`mt-1 text-sm ${
                  selectedIds.length === 0 || previewIncomplete
                    ? "text-ink-500"
                    : "text-ink-900"
                }`}
              >
                {previewMessage}
              </p>
            </div>
          </CollapsibleFieldRow>
        </div>

        {/* Fuera de la fila colapsable a propósito: si vivieran dentro de
            `CollapsibleFieldRow`, dejarían de enviarse en el submit en
            cuanto la fila estuviera cerrada (su contenido no se monta
            mientras está colapsada). Los inputs visibles equivalentes
            dentro de la fila (separador, texto fijo, checkbox) ya no
            llevan `name` — solo editan este mismo estado; estos son la
            única fuente real de esos tres campos en el FormData. Para
            `allow_empty` se replica el comportamiento nativo de un
            checkbox no marcado (ausente del FormData), no un string
            "false". */}
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="selected_field" value={id} />
        ))}
        <input type="hidden" name="party_separator" value={separator} />
        <input type="hidden" name="fixed_suffix" value={fixedSuffix} />
        {allowEmpty && <input type="hidden" name="allow_empty" value="on" />}

        {state.message && <p role="alert" className="mt-4 text-sm text-red-700">{state.message}</p>}

        {!readOnly && (
          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="primary" loading={pending}>
              Guardar configuración
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
