import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/lib/server/errors";
import {
  collectExactExportRows,
  NOTARIAL_EXPORT_LIMIT,
} from "./export-queries";

describe("collectExactExportRows", () => {
  it("retrieves every row in bounded pages", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, offset) => from + offset),
    );

    const rows = await collectExactExportRows(1_201, fetchPage);

    expect(rows).toHaveLength(1_201);
    expect(rows.at(-1)).toBe(1_200);
    expect(fetchPage.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1200],
    ]);
  });

  it("rejects an export above the explicit product limit before reading rows", async () => {
    const fetchPage = vi.fn();

    await expect(
      collectExactExportRows(NOTARIAL_EXPORT_LIMIT + 1, fetchPage),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("fails explicitly when a backend page is truncated", async () => {
    await expect(
      collectExactExportRows(501, async (from, to) =>
        from === 0
          ? Array.from({ length: to - from }, (_, offset) => offset)
          : [],
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
