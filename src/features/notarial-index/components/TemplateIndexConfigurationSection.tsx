"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import {
  TEMPLATE_INDEX_SIMPLE_FIELDS,
  TemplateIndexSimpleFields,
} from "./template-config/TemplateIndexSimpleFields";
import {
  TemplateIndexPartiesField,
  type TemplateIndexPartiesMode,
} from "./template-config/TemplateIndexPartiesField";
import type {
  IndexConfigurationField,
  IndexConfigurationOptionBlock,
} from "./template-config/types";

export type {
  IndexConfigurationField,
  IndexConfigurationOptionBlock,
} from "./template-config/types";

type Props = {
  templateId: string;
  fields: IndexConfigurationField[];
  /** Todos los Bloques de opciones del Machote, incluidos los que todavía no
   * tienen configurado el mapeo de Hora/Minutos. */
  optionBlocks: IndexConfigurationOptionBlock[];
  configuration: TemplateIndexConfiguration | null;
  /** templates.write — sin este permiso, toda la sección es de solo
   * lectura. */
  readOnly?: boolean;
  /** Valor que heredarán las nuevas Escrituras creadas desde este Machote
   * (documents.include_in_notarial_index al crear — snapshot, no vínculo
   * permanente). Cambiarlo marca dirty y se persiste junto con el resto del
   * Índice en `TemplateIndexConfigurationHandle.save` — no guarda al
   * instante. */
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
  /** Notifica cada vez que cambia si hay mapeos (Partes/campos simples) sin
   * guardar — el guardado único (`TemplateWorkspace`) lo suma a su dirty
   * global; no hay botón de guardado propio en esta sección. */
  onDirtyChange?: (dirty: boolean) => void;
};

export type TemplateIndexConfigurationHandle = {
  isDirty: () => boolean;
  /**
   * Guarda los mapeos actuales. `freshFields` reemplaza `fields` justo
   * antes de guardar — el guardado único llama esto después de guardar el
   * machote y de pedir una lista fresca de `template_fields`, para que una
   * variable recién creada en la misma sesión ya tenga el `id` real que
   * este guardado necesita referenciar (ver `getTemplateIndexFieldOptionsAction`).
   */
  save: (
    freshFields: IndexConfigurationField[],
  ) => Promise<{ success: boolean; message?: string }>;
};

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

export const TemplateIndexConfigurationSection = forwardRef<
  TemplateIndexConfigurationHandle,
  Props
>(function TemplateIndexConfigurationSection(
  {
    templateId,
    fields: fieldsProp,
    optionBlocks,
    configuration,
    readOnly = false,
    includeByDefault,
    onIncludeByDefaultSaved,
    onSaveOptionBlockTimeMapping,
    onDirtyChange,
  }: Props,
  ref,
) {
  const { showToast } = useToast();
  // Reemplazable por una lista fresca justo antes de guardar (ver
  // `TemplateIndexConfigurationHandle.save`) sin depender de que el padre
  // vuelva a renderizar esta sección primero.
  const [fields, setFields] = useState(fieldsProp);
  const lastSyncedFieldsProp = useRef(fieldsProp);
  useEffect(() => {
    if (lastSyncedFieldsProp.current !== fieldsProp) {
      lastSyncedFieldsProp.current = fieldsProp;
      setFields(fieldsProp);
    }
  }, [fieldsProp]);
  const [inclusion, setInclusion] = useState(includeByDefault);
  // A response acknowledges the submitted value without replacing later edits.
  const [savedInclusion, setSavedInclusion] = useState(includeByDefault);
  const inclusionDirty = inclusion !== savedInclusion;

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
  // Tri-estado explícito de Partes — reemplaza el checkbox ambiguo
  // "confirmo que no requiere Partes" (que solo aparecía cuando la
  // selección ya estaba vacía, y no distinguía "no lo he decidido" de
  // "confirmé que no aplica"). `allowEmpty`/`selectedIds` siguen siendo lo
  // que de verdad se envía al guardar — `partiesMode` es solo la capa de
  // UI que los mantiene sincronizados y decide qué se muestra. A nivel de
  // datos, "pending" y "required" con 0 variables seleccionadas son
  // indistinguibles después de recargar (mismo payload: sin variables,
  // `allow_empty = false`) — es una distinción de intención dentro de la
  // sesión, no algo que el modelo persistido necesite representar aparte.
  const [partiesMode, setPartiesMode] = useState<TemplateIndexPartiesMode>(() => {
    if ((configuration?.fields.length ?? 0) > 0) return "required";
    return configuration?.allowEmpty ? "not_required" : "pending";
  });
  function handlePartiesModeChange(mode: TemplateIndexPartiesMode) {
    setPartiesMode(mode);
    if (mode === "not_required") {
      setSelectedIds([]);
      setAllowEmpty(true);
    } else if (mode === "pending") {
      setSelectedIds([]);
      setAllowEmpty(false);
    } else {
      setAllowEmpty(false);
    }
  }
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
    for (const { key } of TEMPLATE_INDEX_SIMPLE_FIELDS) {
      initial[key] = initialSimpleFieldValue(key, configuration);
    }
    return initial;
  });

  // Sin `useActionState`/`<form action>`: el guardado único (`TemplateWorkspace`)
  // dispara esta sección a través de `TemplateIndexConfigurationHandle.save`
  // (ver más abajo), no de un submit nativo — así puede esperar el guardado
  // del machote y pedir una lista fresca de `template_fields` ANTES de que
  // esta pantalla guarde, sin que el usuario tenga que hacerlo en dos pasos
  // manuales. El RPC (`saveTemplateIndexConfigurationAction`) sigue siendo
  // exactamente el mismo; solo cambia quién lo invoca y cuándo.
  const [state, setState] = useState<TemplateIndexConfigurationState>(initialState);
  const [pending, setPending] = useState(false);

  // Línea base contra la que se compara para decidir si hay mapeos sin
  // guardar — no un `JSON.stringify` de todo el estado (frágil ante orden),
  // solo los campos que de verdad importan, comparados por valor. Separado
  // de `inclusionDirty` (arriba) a propósito: son dos escrituras
  // independientes (`saveTemplateIndexConfigurationAction` vs
  // `setTemplateNotarialIndexDefaultAction`) — `save()` solo dispara cada
  // una si de verdad tiene cambios, para no forzar una decisión sobre
  // Partes/campos simples solo porque el usuario tocó el toggle de
  // inclusión.
  const [snapshot, setSnapshot] = useState({
    selectedIds,
    separator,
    fixedSuffix,
    allowEmpty,
    simpleFieldValues,
    partiesMode,
  });
  const mappingDirty = useMemo(() => {
    const snap = snapshot;
    if (separator !== snap.separator) return true;
    if (fixedSuffix !== snap.fixedSuffix) return true;
    if (allowEmpty !== snap.allowEmpty) return true;
    if (partiesMode !== snap.partiesMode) return true;
    if (selectedIds.length !== snap.selectedIds.length) return true;
    if (selectedIds.some((id, index) => id !== snap.selectedIds[index])) return true;
    return TEMPLATE_INDEX_SIMPLE_FIELDS.some(
      ({ key }) => simpleFieldValues[key] !== snap.simpleFieldValues[key],
    );
  }, [selectedIds, separator, fixedSuffix, allowEmpty, partiesMode, simpleFieldValues, snapshot]);
  const isDirty = mappingDirty || inclusionDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Una variable configurada en la misma sesión (todavía sin guardar cuando
  // se cargó esta pantalla) llega en `fields` con un id sintético
  // `local:<clave>` (ver `TemplateWorkspace`) — se puede elegir para
  // Partes/campos simples igual que cualquier otra, pero el RPC necesita el
  // `id` real de `template_fields`. `resolveFieldId` lo traduce contra la
  // lista fresca que trae `freshFields`, pedida justo después de guardar el
  // machote — para entonces esa variable ya tiene un id real.
  function resolveFieldId(
    candidateId: string,
    freshFieldsByKey: Map<string, string>,
  ): string | null {
    if (!candidateId.startsWith("local:")) return candidateId;
    return freshFieldsByKey.get(candidateId.slice("local:".length)) ?? null;
  }

  useImperativeHandle(
    ref,
    () => ({
      isDirty: () => isDirty,
      async save(freshFields) {
        setFields(freshFields);

        // Dos escrituras independientes que comparten este único punto de
        // entrada — cada una solo corre si de verdad tiene cambios. Sin
        // esto, tocar solo el toggle de inclusión (machote sin ningún
        // mapeo todavía) forzaría también el RPC de mapeo, que hoy exige
        // decidir Partes (seleccionar variables o confirmar vacío) para
        // poder guardar — ver limitación conocida sobre el estado
        // "Pendiente" de Partes.
        let mappingOk = true;
        let inclusionOk = true;
        let errorMessage: string | undefined;

        if (mappingDirty) {
          const freshFieldsByKey = new Map(
            freshFields.map((field) => [field.fieldKey, field.id]),
          );

          const resolvedSelectedIds: string[] = [];
          for (const id of selectedIds) {
            const resolved = resolveFieldId(id, freshFieldsByKey);
            if (!resolved) {
              const message =
                "Una de las variables seleccionadas para Partes todavía no " +
                "terminó de guardarse. Vuelve a intentar.";
              setState({ message });
              return { success: false, message };
            }
            resolvedSelectedIds.push(resolved);
          }

          const resolvedSimpleFieldValues: Record<SimpleIndexMappingKey, string> =
            { ...simpleFieldValues };
          for (const { key } of TEMPLATE_INDEX_SIMPLE_FIELDS) {
            const raw = simpleFieldValues[key];
            if (key === "authorized_time") {
              if (raw.startsWith("field:")) {
                const resolved = resolveFieldId(
                  raw.slice("field:".length),
                  freshFieldsByKey,
                );
                if (!resolved) {
                  const message =
                    "La variable elegida para Hora de autorización todavía " +
                    "no terminó de guardarse. Vuelve a intentar.";
                  setState({ message });
                  return { success: false, message };
                }
                resolvedSimpleFieldValues[key] = `field:${resolved}`;
              }
              continue;
            }
            if (!raw) continue;
            const resolved = resolveFieldId(raw, freshFieldsByKey);
            if (!resolved) {
              const message =
                "Una de las variables mapeadas todavía no terminó de " +
                "guardarse. Vuelve a intentar.";
              setState({ message });
              return { success: false, message };
            }
            resolvedSimpleFieldValues[key] = resolved;
          }

          setPending(true);
          const formData = new FormData();
          formData.set("party_separator", separator);
          formData.set("fixed_suffix", fixedSuffix);
          if (allowEmpty) formData.set("allow_empty", "on");
          for (const id of resolvedSelectedIds) {
            formData.append("selected_field", id);
          }
          for (const { key } of TEMPLATE_INDEX_SIMPLE_FIELDS) {
            const name =
              key === "authorized_time" ? "authorized_time_source" : `${key}_field_id`;
            formData.set(name, resolvedSimpleFieldValues[key]);
          }

          const result = await saveTemplateIndexConfigurationAction(
            templateId,
            initialState,
            formData,
          );
          setPending(false);

          if (result.success) {
            // Reemplaza cualquier id sintético `local:<clave>` por el id
            // real recién resuelto — si no, en el siguiente render
            // `fieldsById` (ya construido sobre `freshFields`, con ids
            // reales) no encontraría esas claves, y la selección se vería
            // "configurada" en el resumen pero vacía en la vista previa.
            setSelectedIds(current => current === selectedIds ? resolvedSelectedIds : current);
            setSimpleFieldValues(current => current === simpleFieldValues ? resolvedSimpleFieldValues : current);
            setSnapshot({
              selectedIds: resolvedSelectedIds,
              separator,
              fixedSuffix,
              allowEmpty,
              simpleFieldValues: resolvedSimpleFieldValues,
              partiesMode,
            });
          } else {
            mappingOk = false;
            errorMessage =
              result.message ??
              "No fue posible guardar la configuración del Índice.";
            if (
              result.errors?.template_field_ids ||
              result.errors?.party_separator ||
              result.errors?.fixed_suffix
            ) {
              setOpenRowId("parties");
            }
          }
        }

        if (inclusionDirty) {
          const result = await setTemplateNotarialIndexDefaultAction(
            templateId,
            inclusion,
          );
          if (result.success && result.includeByDefault !== undefined) {
            setSavedInclusion(result.includeByDefault);
            if (result.updatedAt) onIncludeByDefaultSaved?.(result.updatedAt);
          } else {
            inclusionOk = false;
            errorMessage ??=
              result.message ??
              "No fue posible actualizar la inclusión en el Índice Notarial.";
          }
        }

        const success = mappingOk && inclusionOk;
        setState(success ? { success: true } : { message: errorMessage });
        if (success) {
          if (mappingDirty || inclusionDirty) showToast("Configuración guardada.");
          return { success: true };
        }
        return { success: false, message: errorMessage };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedIds,
      separator,
      fixedSuffix,
      allowEmpty,
      partiesMode,
      simpleFieldValues,
      inclusion,
      mappingDirty,
      inclusionDirty,
      isDirty,
      templateId,
    ],
  );

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

  const simpleConfiguredCount = TEMPLATE_INDEX_SIMPLE_FIELDS.filter(
    ({ key }) => simpleFieldValues[key] !== "",
  ).length;
  const partiesConfigured = selectedIds.length > 0;
  // Tri-estado: "Pendiente de definir" y "Requiere partes" sin ninguna
  // variable mapeada todavía cuentan como pendientes; "Requiere partes"
  // con al menos una variable, o "No requiere partes", cuentan como
  // configurados — la única fila con status "optional" es "No requiere
  // partes" (semánticamente configurada, pero sin datos que mapear).
  const partiesStatus: "configured" | "pending" | "optional" =
    partiesMode === "not_required"
      ? "optional"
      : partiesConfigured
        ? "configured"
        : "pending";
  const partiesCountsAsConfigured = partiesStatus !== "pending";
  const configuredCount = simpleConfiguredCount + (partiesCountsAsConfigured ? 1 : 0);
  const pendingCount =
    TEMPLATE_INDEX_SIMPLE_FIELDS.length -
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
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="px-6 py-4 text-sm font-semibold text-slate-900 border-b border-slate-200">
        Configuración del índice notarial
      </div>

      <div className="flex items-start gap-2 border-b border-slate-100 px-6 py-4">
        <input
          id="template-notarial-inclusion-toggle"
          type="checkbox"
          checked={inclusion}
          disabled={readOnly}
          onChange={(event) => setInclusion(event.target.checked)}
          className="mt-0.5 size-4 accent-accent-700"
        />
        <label
          htmlFor="template-notarial-inclusion-toggle"
          className="text-sm text-slate-700"
        >
          <span className="font-medium text-slate-900">
            Incluir en Índice Notarial
          </span>
          <br />
          Las nuevas Escrituras creadas desde este Machote aparecerán en el
          Índice Notarial por defecto. Podrás cambiar esta decisión
          individualmente en una Escritura si fuera necesario.
        </label>
      </div>
      {!inclusion && (
        <p className="border-b border-slate-100 px-6 py-4 text-sm text-slate-500">
          Este Machote no utilizará configuración del Índice.
        </p>
      )}
      {/* Fuera del contenedor `hidden={!inclusion}` de abajo a propósito:
          un error al guardar el toggle de inclusión (con el índice
          desactivado, así que sin ningún mapeo dirty) debe seguir siendo
          visible aunque `inclusion` esté en false. */}
      {!inclusion && state.message && (
        <p role="alert" className="border-b border-slate-100 px-6 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {/* Ya no es un `<form>` con Server Action propia — el guardado único
          (`TemplateWorkspace`) invoca `TemplateIndexConfigurationHandle.save`
          directamente; este contenedor solo agrupa visualmente. */}
      <div className="px-6 py-5" hidden={!inclusion}>
        {readOnly && (
          <div
            role="status"
            className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
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
        {TEMPLATE_INDEX_SIMPLE_FIELDS.map(({ key }) => (
          <input
            key={key}
            type="hidden"
            name={key === "authorized_time" ? "authorized_time_source" : `${key}_field_id`}
            value={simpleFieldValues[key]}
          />
        ))}

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          <TemplateIndexSimpleFields
            values={simpleFieldValues}
            onChange={(key, value) =>
              setSimpleFieldValues((current) => ({ ...current, [key]: value }))
            }
            describeValue={simpleFieldMeta}
            openRowId={openRowId}
            onToggle={toggleRow}
            readOnly={readOnly}
            fields={fields}
            optionBlocks={optionBlocks}
            onSaveOptionBlockTimeMapping={onSaveOptionBlockTimeMapping}
          />
          <TemplateIndexPartiesField
            mode={partiesMode}
            configured={partiesConfigured}
            status={partiesStatus}
            selectedIds={selectedIds}
            open={openRowId === "parties"}
            onToggle={() => toggleRow("parties")}
            onModeChange={handlePartiesModeChange}
            readOnly={readOnly}
            search={partiesSearch}
            onSearchChange={(value) => {
              setPartiesSearch(value);
              setPartiesActiveIndex(0);
            }}
            onSearchKeyDown={handlePartiesSearchKeyDown}
            listboxId={partiesListboxId}
            visibleFields={visibleFields}
            activeIndex={clampedPartiesActiveIndex}
            onActiveIndexChange={setPartiesActiveIndex}
            onToggleField={toggleField}
            onMoveField={moveField}
            separator={separator}
            onSeparatorChange={setSeparator}
            fixedSuffix={fixedSuffix}
            onFixedSuffixChange={setFixedSuffix}
            errors={state.errors}
            previewIncomplete={previewIncomplete}
            previewMessage={previewMessage}
          />
        </div>

        {state.message && <p role="alert" className="mt-4 text-sm text-red-700">{state.message}</p>}
        {pending && (
          <p role="status" className="mt-4 text-sm text-slate-500">
            Guardando…
          </p>
        )}
      </div>
    </section>
  );
});
