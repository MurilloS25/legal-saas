"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { generateIndexParties } from "../../model/parties";
import type { TemplateIndexConfiguration } from "../../model/template-index-configuration";
import type {
  IndexConfigurationField,
  TemplateIndexPartiesMode,
} from "./types";

export function useTemplateIndexParties(
  fields: IndexConfigurationField[],
  configuration: TemplateIndexConfiguration | null,
) {
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
  const [mode, setMode] = useState<TemplateIndexPartiesMode>(() => {
    if ((configuration?.fields.length ?? 0) > 0) return "required";
    return configuration?.allowEmpty ? "not_required" : "pending";
  });
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();

  function changeMode(next: TemplateIndexPartiesMode) {
    setMode(next);
    if (next === "not_required") {
      setSelectedIds([]);
      setAllowEmpty(true);
    } else if (next === "pending") {
      setSelectedIds([]);
      setAllowEmpty(false);
    } else {
      setAllowEmpty(false);
    }
  }

  function changeSearch(value: string) {
    setSearch(value);
    setActiveIndex(0);
  }

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

  const fieldsById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const orderedFields = [
    ...selectedIds.flatMap((id) => {
      const field = fieldsById.get(id);
      return field ? [field] : [];
    }),
    ...fields.filter((field) => !selectedIds.includes(field.id)),
  ];
  const normalizedSearch = search.trim().toLocaleLowerCase("es-CR");
  const visibleFields = orderedFields.filter((field) => {
    if (selectedIds.includes(field.id)) return true;
    if (normalizedSearch === "") return true;
    return (
      field.label.toLocaleLowerCase("es-CR").includes(normalizedSearch) ||
      field.fieldKey.toLocaleLowerCase("es-CR").includes(normalizedSearch)
    );
  });
  const clampedActiveIndex = Math.min(
    activeIndex,
    Math.max(visibleFields.length - 1, 0),
  );
  if (clampedActiveIndex !== activeIndex) {
    setActiveIndex(clampedActiveIndex);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.min(current + 1, visibleFields.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      const field = visibleFields[activeIndex];
      if (!field) return;
      event.preventDefault();
      toggleField(field.id, !selectedIds.includes(field.id));
    } else if (event.key === "Escape" && search !== "") {
      event.preventDefault();
      setSearch("");
    }
  }

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
  const configured = selectedIds.length > 0;
  const status: "configured" | "pending" | "optional" =
    mode === "not_required"
      ? "optional"
      : configured
        ? "configured"
        : "pending";

  return {
    mode,
    changeMode,
    selectedIds,
    setSelectedIds,
    separator,
    setSeparator,
    fixedSuffix,
    setFixedSuffix,
    allowEmpty,
    search,
    changeSearch,
    handleSearchKeyDown,
    listboxId,
    visibleFields,
    activeIndex: clampedActiveIndex,
    setActiveIndex,
    toggleField,
    moveField,
    configured,
    status,
    previewIncomplete,
    previewMessage,
  };
}

export type TemplateIndexPartiesController = ReturnType<
  typeof useTemplateIndexParties
>;
