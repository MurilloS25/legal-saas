"use client";

import { useState } from "react";
import type { CreatedClient } from "@/features/clients";
import type { OptionSelectionsMap } from "@/lib/editor/render";
import type { FillableTemplateField } from "@/features/templates/domain";
import type { DocumentClientOption } from "../model/role-autofill";

type InitialDraft = {
  title: string;
  field_values: Record<string, string>;
  option_selections: OptionSelectionsMap;
} | null;

type Params = {
  fields: FillableTemplateField[];
  clients: DocumentClientOption[];
  initialClientId: string | null;
  initialTitle: string;
  draft: InitialDraft;
  markDirty: () => void;
};

export function useDocumentDraftFields(params: Params) {
  const [title, setTitle] = useState(params.draft?.title ?? params.initialTitle);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of params.fields) {
      initial[field.field_key] = params.draft?.field_values[field.field_key] ?? "";
    }
    return initial;
  });
  const [clientId, setClientId] = useState(params.initialClientId ?? "");
  const [clientOptions, setClientOptions] = useState(params.clients);
  const [editingTarget, setEditingTarget] = useState<
    { nodeId: string; variableKey: string } | undefined
  >();
  const [optionSelections, setOptionSelections] = useState<OptionSelectionsMap>(
    () => params.draft?.option_selections ?? {},
  );

  function changeTitle(value: string) {
    setTitle(value);
    params.markDirty();
  }

  function changeClient(value: string) {
    setClientId(value);
    params.markDirty();
  }

  function changeField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    params.markDirty();
  }

  function applyRoleAutofill(fieldValues: Record<string, string>) {
    setValues((current) => ({ ...current, ...fieldValues }));
    params.markDirty();
  }

  function handleClientCreated(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
    setClientId(client.id);
    params.markDirty();
  }

  function handleClientRegistered(client: CreatedClient) {
    setClientOptions((current) => [...current, client]);
  }

  function selectVariant(blockId: string, variantId: string) {
    setOptionSelections((current) => ({ ...current, [blockId]: variantId }));
    params.markDirty();
  }

  return {
    title,
    values,
    clientId,
    clientOptions,
    editingTarget,
    optionSelections,
    changeTitle,
    changeClient,
    changeField,
    applyRoleAutofill,
    handleClientCreated,
    handleClientRegistered,
    selectVariant,
    startEditingField: (nodeId: string, variableKey: string) =>
      setEditingTarget({ nodeId, variableKey }),
    stopEditingField: () => setEditingTarget(undefined),
  };
}
