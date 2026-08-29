"use client";

/**
 * Módulo Clientes como list+detail (iteración 3, ver
 * docs/design/EXPERIMENT_DIRECTION_V3.md § Clientes).
 *
 * Antes: lista de página completa + página de detalle completa aparte (dos
 * navegaciones para ver a un cliente). Ahora: la lista vive siempre visible
 * en un panel, y seleccionar un cliente abre su detalle en el panel de al
 * lado sin abandonar la lista — mismo patrón que Índice Notarial/Machotes
 * esta iteración.
 *
 * La URL sigue siendo deep-linkable: `/dashboard/clients/[id]` resuelve
 * server-side (ver la página de esa ruta) al mismo componente, con el
 * detalle inicial ya cargado. La selección subsecuente actualiza la URL
 * vía `history.pushState` sin una navegación real — mismo mecanismo que
 * `TemplateWorkspace` usa para su `?section=`, aplicado aquí a un segmento
 * de ruta en vez de un query param porque el detalle es una página propia
 * deep-linkable.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PageContainer } from "@/components/layout/PageContainer";
import { TablePagination } from "@/components/ui/TablePagination";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WorkspaceRole } from "@/lib/server/permissions";
import { getClientDetailAction, type ClientDetailPayload } from "../server/detail-action";
import { clientsQueryToParams } from "../model/workspace-query";
import type { ClientRow } from "../model/types";
import { ClientsTable } from "./ClientsTable";
import { ClientDetail } from "./ClientDetail";
import { ClientForm } from "./ClientForm";

// ------------------------------------------------------------------ selection state

type Selection =
  | { kind: "detail"; data: ClientDetailPayload }
  | { kind: "create" }
  | { kind: "loading"; id: string }
  | { kind: "error"; id: string }
  | null;

export type ClientsWorkspaceInitialSelection = Selection;

type Props = {
  clients: ClientRow[];
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  canWrite: boolean;
  role: WorkspaceRole;
  initialSelection: ClientsWorkspaceInitialSelection;
};

// ------------------------------------------------------------------ small icons

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function UsersEmptyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ------------------------------------------------------------------ component

export function ClientsWorkspace({
  clients,
  page,
  pageCount,
  total,
  pageSize,
  canWrite,
  role,
  initialSelection,
}: Props) {
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const requestRef = useRef(0);
  const reducedMotion = useReducedMotion();

  // Función pura, definida y usada enteramente en el cliente — a diferencia
  // de una prop `pageHref: (page: number) => string` recibida desde un
  // Server Component (ilegal: las funciones no son serializables a través
  // del límite servidor/cliente, y este componente es "use client").
  function pageHref(targetPage: number): string {
    const params = clientsQueryToParams({ page: targetPage });
    const qs = new URLSearchParams(params).toString();
    return qs ? `/dashboard/clients?${qs}` : "/dashboard/clients";
  }

  async function loadDetail(id: string) {
    const requestId = ++requestRef.current;
    setSelection({ kind: "loading", id });
    const result = await getClientDetailAction(id);
    // El usuario pudo haber seleccionado otra fila mientras esta petición
    // seguía en vuelo — solo aplica el resultado si sigue siendo el actual.
    if (requestRef.current !== requestId) return;
    setSelection(result ? { kind: "detail", data: result } : { kind: "error", id });
  }

  function selectClient(id: string) {
    if (selection?.kind === "detail" && selection.data.client.id === id) return;
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/dashboard/clients/${id}`);
    }
    void loadDetail(id);
  }

  function openCreate() {
    if (selection?.kind === "create") return;
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/dashboard/clients/new");
    }
    requestRef.current += 1; // invalida cualquier fetch de detalle en vuelo
    setSelection({ kind: "create" });
  }

  function closeSelection() {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/dashboard/clients");
    }
    requestRef.current += 1;
    setSelection(null);
  }

  // Sincroniza con atrás/adelante del navegador. No vuelve a hacer
  // `pushState` (ya está hecho) — solo reconcilia el estado con la URL.
  useEffect(() => {
    function onPopState() {
      const match = /^\/dashboard\/clients\/([^/]+)\/?$/.exec(
        window.location.pathname,
      );
      if (!match) {
        requestRef.current += 1;
        setSelection(null);
        return;
      }
      const segment = decodeURIComponent(match[1]);
      if (segment === "new") {
        requestRef.current += 1;
        setSelection({ kind: "create" });
        return;
      }
      void loadDetail(segment);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Se registra una sola vez; `loadDetail` solo cierra sobre refs/setState
    // estables, no necesita re-suscribirse en cada render.
  }, []);

  const selectedId =
    selection?.kind === "detail"
      ? selection.data.client.id
      : selection?.kind === "loading" || selection?.kind === "error"
        ? selection.id
        : undefined;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const panelTransition = reducedMotion
    ? { duration: 0.1 }
    : { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const };

  return (
    <PageContainer>
      {/* ---- header ---- */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Directorio de clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta y edita tus clientes sin perder la lista de vista.
          </p>
        </div>
        {canWrite && (total > 0 || !!selection) && (
          <button
            type="button"
            onClick={openCreate}
            className="press-feedback mt-1 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1 h-9"
          >
            <PlusIcon />
            Nuevo cliente
          </button>
        )}
      </div>

      {/* ---- empty state (no clients at all, nothing being created either) ---- */}
      {total === 0 && !selection ? (
        <EmptyState
          icon={<UsersEmptyIcon />}
          title="Aún no tienes clientes registrados"
          description="Agrega tu primer cliente para reutilizar sus datos en los machotes."
          action={
            canWrite ? (
              <button
                type="button"
                onClick={openCreate}
                className="press-feedback inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent-600 px-3 text-xs font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1"
              >
                <PlusIcon />
                Nuevo cliente
              </button>
            ) : undefined
          }
          className="py-20"
        />
      ) : (
        /* ---- list + detail ---- */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
          {/* List panel — en mobile se oculta mientras hay una selección
              abierta (el detalle ocupa toda la pantalla ahí); en desktop
              queda siempre visible al lado. Si aún no hay ningún cliente
              (p. ej. se llegó directo a /new) muestra un aviso compacto en
              vez de la tabla vacía. */}
          <div className={selection ? "hidden lg:block" : "block"}>
            {total === 0 ? (
              <EmptyState
                icon={<UsersEmptyIcon />}
                title="Sin clientes todavía"
                description="El primero que crees aparecerá aquí."
                className="py-12"
              />
            ) : (
              <Card padding="none" className="overflow-hidden">
                <ClientsTable rows={clients} onSelect={selectClient} selectedId={selectedId} />
                <TablePagination
                  page={page}
                  pageCount={pageCount}
                  countLabel={`${rangeStart}–${rangeEnd} de ${total}`}
                  pageHref={pageHref}
                />
              </Card>
            )}
          </div>

          {/* Detail panel */}
          <div className={selection ? "block" : "hidden lg:block"}>
            <AnimatePresence mode="wait">
              {!selection && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={panelTransition}
                >
                  <EmptyState
                    title="Selecciona un cliente"
                    description="Elige un registro de la lista para ver y editar su información."
                    className="py-20"
                  />
                </motion.div>
              )}

              {selection?.kind === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={panelTransition}
                  className="rounded-xl border border-slate-200 bg-white p-8 shadow-ink-sm"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="animate-pulse space-y-4">
                    <div className="h-14 w-14 rounded-full bg-slate-200" />
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </motion.div>
              )}

              {selection?.kind === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={panelTransition}
                >
                  <EmptyState
                    title="No fue posible cargar este cliente"
                    description="Puede que ya no exista o que no tengas acceso a él."
                    className="py-20"
                  />
                </motion.div>
              )}

              {selection?.kind === "create" && (
                <motion.div
                  key="create"
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={panelTransition}
                >
                  <button
                    type="button"
                    onClick={closeSelection}
                    className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-accent-700 focus:outline-none focus-visible:underline lg:hidden"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Clientes
                  </button>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold tracking-tight text-ink-900">
                      Nuevo cliente
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Registra los datos de la persona física.
                    </p>
                  </div>
                  <ClientForm mode="create" onCancel={closeSelection} />
                </motion.div>
              )}

              {selection?.kind === "detail" && (
                <motion.div
                  key={selection.data.client.id}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={panelTransition}
                >
                  <ClientDetail
                    client={selection.data.client}
                    documents={selection.data.documents}
                    receivables={selection.data.receivables}
                    role={role}
                    onBack={closeSelection}
                    onCancelEdit={closeSelection}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
