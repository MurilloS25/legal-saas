/**
 * Registro de recursos creados por un spec E2E para limpiarlos al final.
 *
 * Lógica pura (sin Playwright ni red): el borrado real se inyecta como
 * `Deleter`, lo que permite probar el orden y la tolerancia a fallos con
 * vitest sin tocar la base de datos.
 */

export type CleanupTable =
  | "documents"
  | "template_fields"
  | "templates"
  | "clients";

/** Orden seguro según claves foráneas: hijos antes que padres. */
export const CLEANUP_ORDER: readonly CleanupTable[] = [
  "documents",
  "template_fields",
  "templates",
  "clients",
];

export type CleanupResource = { table: CleanupTable; id: string };

/**
 * Borra un recurso. Devuelve "deleted" si existía, "missing" si ya no
 * existe (p. ej. el propio test lo eliminó) — ambos son resultados válidos.
 */
export type Deleter = (
  resource: CleanupResource,
) => Promise<"deleted" | "missing">;

export type CleanupReport = {
  deleted: number;
  missing: number;
  failures: { resource: CleanupResource; error: string }[];
};

export class CleanupRegistry {
  private resources: CleanupResource[] = [];

  register(table: CleanupTable, id: string): void {
    if (!id) return;
    const exists = this.resources.some(
      (r) => r.table === table && r.id === id,
    );
    if (!exists) this.resources.push({ table, id });
  }

  get pending(): readonly CleanupResource[] {
    return [...this.resources];
  }

  /**
   * Elimina todo lo registrado en orden seguro (por tabla según
   * CLEANUP_ORDER; dentro de cada tabla, lo último creado primero).
   * Un recurso ya inexistente no es un fallo. Los fallos reales se
   * recopilan en el reporte — nunca se lanzan, para no enmascarar el
   * resultado de la prueba principal.
   */
  async cleanup(deleteResource: Deleter): Promise<CleanupReport> {
    const report: CleanupReport = { deleted: 0, missing: 0, failures: [] };

    for (const table of CLEANUP_ORDER) {
      const ofTable = this.resources
        .filter((r) => r.table === table)
        .reverse();

      for (const resource of ofTable) {
        try {
          const outcome = await deleteResource(resource);
          if (outcome === "deleted") report.deleted += 1;
          else report.missing += 1;
        } catch (error) {
          report.failures.push({
            resource,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Solo quedan pendientes los que fallaron, por si se reintenta.
    this.resources = this.resources.filter((r) =>
      report.failures.some(
        (f) => f.resource.table === r.table && f.resource.id === r.id,
      ),
    );

    return report;
  }
}
