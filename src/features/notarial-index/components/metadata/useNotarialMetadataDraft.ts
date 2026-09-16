"use client";

import { useEffect, useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/navigation/NavigationGuard";
import {
  isNotarialComplete,
  notarialMissingFields,
  type NotarialMetadata,
} from "../../model/notarial";
import type {
  NotarialMetadataPrefill,
  NotarialPrefillField,
} from "../../model/prefill";
import { matchesPersistedNotarialSnapshot } from "../../model/confirmation-snapshot";

type Options = {
  metadata: NotarialMetadata | null;
  prefill: NotarialMetadataPrefill;
  actNamePreview: string | null;
  generatedPartiesPreview: string | null;
};

function initialPrefillValue(field: NotarialPrefillField): string {
  return field.source === "suggestion" ? "" : field.value;
}

function useSyncedPrefillField(
  serverValue: string,
  value: string,
  setValue: (next: string) => void,
) {
  const lastSynced = useRef(serverValue);
  useEffect(() => {
    if (lastSynced.current === serverValue) return;
    const untouched = value === lastSynced.current;
    lastSynced.current = serverValue;
    if (untouched) setValue(serverValue);
    // The local value intentionally stays out of the dependencies: a server
    // prefill change may replace only the last value synchronized from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverValue]);
}

export function useNotarialMetadataDraft({
  metadata,
  prefill,
  actNamePreview,
  generatedPartiesPreview,
}: Options) {
  const [instrument, setInstrument] = useState(
    initialPrefillValue(prefill.instrumentNumber),
  );
  const [authorizedDate, setAuthorizedDate] = useState(
    initialPrefillValue(prefill.authorizedAt.date),
  );
  const [authorizedTime, setAuthorizedTime] = useState(
    initialPrefillValue(prefill.authorizedAt.time),
  );
  const [protocolBook, setProtocolBook] = useState(
    initialPrefillValue(prefill.protocolBook),
  );
  const [initialFolio, setInitialFolio] = useState(
    initialPrefillValue(prefill.initialFolio),
  );
  const [finalFolio, setFinalFolio] = useState(
    initialPrefillValue(prefill.finalFolio),
  );
  const [actName, setActName] = useState(prefill.actName.value);
  const [parties, setParties] = useState(metadata?.parties_override ?? "");
  const [notes, setNotes] = useState(metadata?.notes ?? "");

  useSyncedPrefillField(
    initialPrefillValue(prefill.instrumentNumber),
    instrument,
    setInstrument,
  );
  useSyncedPrefillField(
    initialPrefillValue(prefill.authorizedAt.date),
    authorizedDate,
    setAuthorizedDate,
  );
  useSyncedPrefillField(
    initialPrefillValue(prefill.authorizedAt.time),
    authorizedTime,
    setAuthorizedTime,
  );
  useSyncedPrefillField(
    initialPrefillValue(prefill.protocolBook),
    protocolBook,
    setProtocolBook,
  );
  useSyncedPrefillField(
    initialPrefillValue(prefill.initialFolio),
    initialFolio,
    setInitialFolio,
  );
  useSyncedPrefillField(
    initialPrefillValue(prefill.finalFolio),
    finalFolio,
    setFinalFolio,
  );
  useSyncedPrefillField(prefill.actName.value, actName, setActName);

  const authorizedAt =
    authorizedDate && authorizedTime
      ? `${authorizedDate}T${authorizedTime}`
      : "";
  const partiesFallback = metadata?.generated_parties ?? generatedPartiesPreview;
  const liveMetadata = {
    notes,
    authorizedDate,
    authorizedTime,
    instrument_number: instrument === "" ? null : Number(instrument),
    authorized_at: authorizedAt,
    protocol_book: protocolBook,
    initial_folio: initialFolio,
    final_folio: finalFolio,
    act_name_override: actName,
    act_name_snapshot: metadata?.act_name_snapshot ?? actNamePreview,
    parties_override: parties,
    generated_parties: partiesFallback,
  };
  const complete = isNotarialComplete(liveMetadata);
  const matchesPersisted = matchesPersistedNotarialSnapshot(liveMetadata, metadata);
  const [initialInput] = useState(JSON.stringify(liveMetadata));
  const dirty = metadata
    ? !matchesPersisted
    : JSON.stringify(liveMetadata) !== initialInput;
  useUnsavedChanges(dirty);

  const status = {
    instrumentConfigured: instrument !== "" && Number(instrument) > 0,
    authorizedAtConfigured: authorizedAt !== "",
    protocolBookConfigured: protocolBook.trim() !== "",
    foliosConfigured:
      initialFolio.trim() !== "" && finalFolio.trim() !== "",
    actNameConfigured:
      actName.trim() !== "" || !!(metadata?.act_name_snapshot ?? actNamePreview),
    partiesConfigured: parties.trim() !== "" || !!partiesFallback,
  };
  const requiredRows = [
    status.instrumentConfigured,
    status.authorizedAtConfigured,
    status.protocolBookConfigured,
    status.foliosConfigured,
    status.actNameConfigured,
    status.partiesConfigured,
  ];
  const configuredCount = requiredRows.filter(Boolean).length;

  return {
    values: {
      instrument,
      authorizedDate,
      authorizedTime,
      protocolBook,
      initialFolio,
      finalFolio,
      actName,
      parties,
      notes,
    },
    setters: {
      setInstrument,
      setAuthorizedDate,
      setAuthorizedTime,
      setProtocolBook,
      setInitialFolio,
      setFinalFolio,
      setActName,
      setParties,
      setNotes,
    },
    authorizedAt,
    partiesFallback,
    liveMetadata,
    complete,
    matchesPersisted,
    dirty,
    missingFields: notarialMissingFields(liveMetadata),
    configuredCount,
    pendingCount: requiredRows.length - configuredCount,
    status,
  };
}

export type NotarialMetadataDraft = ReturnType<typeof useNotarialMetadataDraft>;
