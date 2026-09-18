import { describe, expect, it } from "vitest";
import type { ReceivableEntry } from "@/features/receivables";
import {
  daysUntil,
  greeting,
  relativeTime,
  selectAttentionReceivables,
} from "./dashboard-presenters";

function receivable(
  id: string,
  status: ReceivableEntry["status"],
  dueAt: string | null,
): ReceivableEntry {
  return {
    id,
    client_id: null,
    document_id: null,
    concept: id,
    currency: "CRC",
    amount_total: "1000",
    issued_at: "2026-09-01",
    due_at: dueAt,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-01T12:00:00.000Z",
    client_name: "Cliente",
    document_title: null,
    paid_amount: "0",
    balance_due: "1000",
    status,
  };
}

describe("dashboard presenters", () => {
  const now = new Date(2026, 8, 16, 10, 0, 0);

  it("preserves greeting and relative date rules", () => {
    expect(greeting(now)).toBe("Buenos días");
    expect(daysUntil("2026-09-18", now)).toBe(2);
    expect(relativeTime("2026-09-16T09:30:00", now)).toBe("hace 30 min");
  });

  it("selects overdue and upcoming unpaid receivables in due-date order", () => {
    const result = selectAttentionReceivables(
      [
        receivable("later", "pending", "2026-09-22"),
        receivable("paid", "paid", "2026-09-15"),
        receivable("far", "pending", "2026-10-01"),
        receivable("overdue", "overdue", "2026-09-10"),
        receivable("soon", "partial", "2026-09-17"),
      ],
      now,
    );

    expect(result.map(({ id }) => id)).toEqual(["overdue", "soon", "later"]);
  });
});
