"use client";

import type { TemplateOptionBlockAttrs } from "@/lib/editor/types";
import type { SimpleIndexMappingKey } from "../../model/template-index-configuration";
import type {
  IndexConfigurationField,
  IndexConfigurationOptionBlock,
} from "./types";
import { CollapsibleFieldRow } from "../CollapsibleFieldRow";
import { OptionBlockTimeMappingEditor } from "../OptionBlockTimeMappingEditor";

export const TEMPLATE_INDEX_SIMPLE_FIELDS: Array<{
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

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600";

type Props = {
  values: Record<SimpleIndexMappingKey, string>;
  onChange: (key: SimpleIndexMappingKey, value: string) => void;
  describeValue: (key: SimpleIndexMappingKey) => string;
  openRowId: string | null;
  onToggle: (id: string) => void;
  readOnly: boolean;
  fields: IndexConfigurationField[];
  optionBlocks: IndexConfigurationOptionBlock[];
  onSaveOptionBlockTimeMapping?: (
    blockId: string,
    structuredOutput: TemplateOptionBlockAttrs["structuredOutput"],
  ) => void;
};

export function TemplateIndexSimpleFields({
  values,
  onChange,
  describeValue,
  openRowId,
  onToggle,
  readOnly,
  fields,
  optionBlocks,
  onSaveOptionBlockTimeMapping,
}: Props) {
  return (
    <>
      {TEMPLATE_INDEX_SIMPLE_FIELDS.map(({ key, label }) => (
        <CollapsibleFieldRow
          key={key}
          id={`idx-${key}`}
          name={label}
          meta={describeValue(key)}
          status={values[key] ? "configured" : "pending"}
          open={openRowId === key}
          onToggle={() => onToggle(key)}
        >
          <label
            htmlFor={`${key}_field_id`}
            className="mb-1 block text-xs font-medium text-slate-700"
          >
            Variable sugerida
          </label>
          <select
            id={`${key}_field_id`}
            value={values[key]}
            onChange={(event) => onChange(key, event.target.value)}
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
                      <option key={block.blockId} value={`block:${block.blockId}`}>
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
            values[key].startsWith("block:") &&
            onSaveOptionBlockTimeMapping &&
            (() => {
              const selectedBlock = optionBlocks.find(
                (block) => `block:${block.blockId}` === values[key],
              );
              if (!selectedBlock) return null;
              return (
                <>
                  {selectedBlock.structuredOutput?.type !== "time" && (
                    <p className="mt-2 text-xs text-amber-700">
                      Este bloque todavía no tiene mapeo de hora guardado —
                      configúralo abajo y guarda los cambios del machote antes
                      de guardar esta selección.
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
    </>
  );
}
