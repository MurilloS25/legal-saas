import { describe, it, expect } from "vitest";
import {
  CleanupRegistry,
  type CleanupResource,
} from "./cleanup-registry";

function trackingDeleter(log: CleanupResource[]) {
  return async (resource: CleanupResource) => {
    log.push(resource);
    return "deleted" as const;
  };
}

describe("CleanupRegistry", () => {
  it("registers resources and exposes them as pending", () => {
    const registry = new CleanupRegistry();
    registry.register("templates", "t1");
    registry.register("documents", "d1");
    expect(registry.pending).toHaveLength(2);
  });

  it("ignores duplicate registrations", () => {
    const registry = new CleanupRegistry();
    registry.register("templates", "t1");
    registry.register("templates", "t1");
    expect(registry.pending).toHaveLength(1);
  });

  it("ignores empty ids", () => {
    const registry = new CleanupRegistry();
    registry.register("templates", "");
    expect(registry.pending).toHaveLength(0);
  });

  it("deletes children before parents regardless of registration order", async () => {
    const registry = new CleanupRegistry();
    registry.register("clients", "c1");
    registry.register("templates", "t1");
    registry.register("template_fields", "f1");
    registry.register("documents", "d1");

    const log: CleanupResource[] = [];
    await registry.cleanup(trackingDeleter(log));

    expect(log.map((r) => r.table)).toEqual([
      "documents",
      "template_fields",
      "templates",
      "clients",
    ]);
  });

  it("deletes newest resources first within the same table", async () => {
    const registry = new CleanupRegistry();
    registry.register("templates", "t1");
    registry.register("templates", "t2");

    const log: CleanupResource[] = [];
    await registry.cleanup(trackingDeleter(log));

    expect(log.map((r) => r.id)).toEqual(["t2", "t1"]);
  });

  it("treats already-deleted resources as missing, not failures", async () => {
    const registry = new CleanupRegistry();
    registry.register("documents", "gone");

    const report = await registry.cleanup(async () => "missing");

    expect(report.missing).toBe(1);
    expect(report.deleted).toBe(0);
    expect(report.failures).toHaveLength(0);
  });

  it("collects deleter errors as failures without throwing", async () => {
    const registry = new CleanupRegistry();
    registry.register("templates", "t1");
    registry.register("templates", "t2");

    const report = await registry.cleanup(async ({ id }) => {
      if (id === "t1") throw new Error("network down");
      return "deleted";
    });

    expect(report.deleted).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].resource.id).toBe("t1");
    expect(report.failures[0].error).toContain("network down");
  });

  it("keeps only failed resources pending after cleanup", async () => {
    const registry = new CleanupRegistry();
    registry.register("templates", "ok");
    registry.register("templates", "bad");

    await registry.cleanup(async ({ id }) => {
      if (id === "bad") throw new Error("boom");
      return "deleted";
    });

    expect(registry.pending).toEqual([{ table: "templates", id: "bad" }]);
  });

  it("empties the registry when everything succeeds", async () => {
    const registry = new CleanupRegistry();
    registry.register("documents", "d1");
    await registry.cleanup(async () => "deleted");
    expect(registry.pending).toHaveLength(0);
  });
});
