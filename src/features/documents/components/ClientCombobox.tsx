"use client";

/**
 * Selector searchable de Cliente: combobox accesible (patrón ARIA
 * combobox + listbox) que filtra por nombre o número de identificación
 * (sin importar guiones ni espacios — ver `matchesClientSearch`).
 * Cada opción muestra el nombre completo y la cédula del Cliente.
 *
 * El valor mostrado cuando no hay búsqueda en curso es solo una referencia
 * visual de la sesión (qué Cliente se usó para copiar datos por última
 * vez): nunca se persiste, y "Quitar cliente" solo borra esa referencia,
 * nunca los valores ya copiados.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  matchesClientSearch,
  type DocumentClientOption,
} from "../model/role-autofill";
import { isLegalEntityType } from "@/features/clients/domain";

type Props = {
  clients: DocumentClientOption[];
  selectedClient: DocumentClientOption | null;
  disabled: boolean;
  label: string;
  onSelect: (client: DocumentClientOption) => void;
  onClear: () => void;
};

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function ClientCombobox({
  clients,
  selectedClient,
  disabled,
  label,
  onSelect,
  onClear,
}: Props) {
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(
    () => clients.filter((client) => matchesClientSearch(client, query)),
    [clients, query],
  );

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(0);
  }

  function selectClient(client: DocumentClientOption) {
    onSelect(client);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function clearSelection() {
    onClear();
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        selectClient(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  }

  const displayValue = open || query !== ""
    ? query
    : (selectedClient?.full_name ?? "");

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="mt-1.5 block text-xs text-slate-600">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={inputId}
          role="combobox"
          type="text"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          disabled={disabled}
          value={displayValue}
          placeholder="Buscar o seleccionar cliente…"
          onChange={(event) => {
            setQuery(event.target.value);
            openList();
          }}
          onFocus={openList}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50"
        />
        {selectedClient && !open && query === "" && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Quitar cliente"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <XIcon />
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          ref={listRef}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md"
        >
          {clients.length === 0 ? (
            <li className="px-3.5 py-2 text-sm text-slate-500">
              No tienes clientes registrados todavía.
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-3.5 py-2 text-sm text-slate-500">
              No hay clientes que coincidan.
            </li>
          ) : (
            filtered.map((client, index) => (
              <li
                key={client.id}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectClient(client);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3.5 py-2 text-sm ${
                  index === activeIndex
                    ? "bg-accent-50 text-accent-900"
                    : "text-slate-700"
                }`}
              >
                <p className="font-medium">{client.full_name}</p>
                <p className="text-xs text-slate-500">
                  {isLegalEntityType(client.identification_type)
                    ? "Cédula jurídica"
                    : "Cédula"}
                  : {client.identification_number}
                </p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
