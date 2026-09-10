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
import type { OptionBlockSummary } from "@/lib/editor/option-blocks";
import { IndexSummaryHeader } from "./IndexSummaryHeader";
import { CollapsibleFieldRow } from "./CollapsibleFieldRow";
import { OptionBlockTimeMappingEditor } from "./OptionBlockTimeMappingEditor";

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

type PartiesMode = "pending" | "required" | "not_required";

const PARTIES_MODE_OPTIONS: Array<{ mode: PartiesMode; label: string }> = [
  { mode: "pending", label: "Pendiente de definir" },
  { mode: "required", label: "Requiere partes" },
  { mode: "not_required", label: "No requiere partes" },
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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600";

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
  const [partiesMode, setPartiesMode] = useState<PartiesMode>(() => {
    if ((configuration?.fields.length ?? 0) > 0) return "required";
    return configuration?.allowEmpty ? "not_required" : "pending";
  });
  function handlePartiesModeChange(mode: PartiesMode) {
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
    for (const { key } of SIMPLE_FIELDS) {
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
    return SIMPLE_FIELDS.some(
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
          for (const { key } of SIMPLE_FIELDS) {
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
          for (const { key } of SIMPLE_FIELDS) {
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

  const simpleConfiguredCount = SIMPLE_FIELDS.filter(
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
        {SIMPLE_FIELDS.map(({ key }) => (
          <input
            key={key}
            type="hidden"
            name={key === "authorized_time" ? "authorized_time_source" : `${key}_field_id`}
            value={simpleFieldValues[key]}
          />
        ))}

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
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
                className="mb-1 block text-xs font-medium text-slate-700"
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
              partiesMode === "required"
                ? partiesConfigured
                  ? `${selectedIds.length} variable${selectedIds.length === 1 ? "" : "s"} seleccionada${selectedIds.length === 1 ? "" : "s"}`
                  : "¿Quiénes aparecen en la columna “Partes”?"
                : partiesMode === "not_required"
                  ? "Confirmado sin Partes"
                  : "Sin decidir todavía"
            }
            status={partiesStatus}
            statusLabel={partiesStatus === "optional" ? "Confirmado" : undefined}
            open={openRowId === "parties"}
            onToggle={() => toggleRow("parties")}
          >
            <fieldset disabled={readOnly}>
              <legend className="text-xs font-medium text-slate-700">
                ¿Este machote tiene Partes para el índice?
              </legend>
              <div
                role="radiogroup"
                aria-label="¿Este machote tiene Partes para el índice?"
                className="mt-2 flex flex-wrap gap-2"
              >
                {PARTIES_MODE_OPTIONS.map(({ mode, label }) => {
                  const active = partiesMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={readOnly}
                      onClick={() => handlePartiesModeChange(mode)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-accent-600 bg-accent-50 text-accent-800"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {partiesMode === "pending" && (
              <p className="mt-3 text-sm text-slate-500">
                Aún no has decidido si este machote necesita Partes para el
                índice. El machote puede guardarse igual — podrás definirlo
                más adelante.
              </p>
            )}

            {partiesMode === "not_required" && (
              <div className="mt-3">
                <p className="text-sm text-slate-600">
                  Este Machote no necesita generar automáticamente el campo
                  &ldquo;Partes&rdquo; del índice.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Podrás completarlo manualmente en cada Escritura.
                </p>
              </div>
            )}

            {partiesMode === "required" && (
              <>
            <p className="mt-3 text-xs text-slate-500">
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
              className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200"
            >
              {visibleFields.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500">
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
                    className={`flex min-h-12 items-center gap-3 px-3 py-2 ${
                      active ? "bg-accent-50" : ""
                    }`}
                  >
                    <input
                      id={`index-party-${field.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleField(field.id, event.target.checked)}
                      disabled={readOnly}
                      className="h-4 w-4 rounded border-slate-300 text-accent-700 focus:ring-accent-600"
                    />
                    <label
                      htmlFor={`index-party-${field.id}`}
                      className="min-w-0 flex-1 text-sm text-slate-800"
                    >
                      <span className="font-medium">{field.label}</span>
                      <span className="ml-2 text-xs text-slate-500">{field.fieldKey}</span>
                    </label>
                    {selected && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Subir ${field.label}`}
                          disabled={readOnly || selectedIndex === 0}
                          onClick={() => moveField(field.id, -1)}
                          className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar ${field.label}`}
                          disabled={readOnly || selectedIndex === selectedIds.length - 1}
                          onClick={() => moveField(field.id, 1)}
                          className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
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
                <label htmlFor="party_separator" className="mb-1 block text-xs font-medium text-slate-700">
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
                <label htmlFor="fixed_suffix" className="mb-1 block text-xs font-medium text-slate-700">
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

            {state.errors?.template_field_ids && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {state.errors.template_field_ids}
              </p>
            )}

            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase text-slate-500">Vista previa</p>
              <p
                className={`mt-1 text-sm ${
                  selectedIds.length === 0 || previewIncomplete
                    ? "text-slate-500"
                    : "text-slate-900"
                }`}
              >
                {previewMessage}
              </p>
            </div>
              </>
            )}
          </CollapsibleFieldRow>
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
