import { describe, expect, it } from "vitest";
import { applyNotarialNavigationChanges } from "./navigation";

describe("applyNotarialNavigationChanges", () => {
  it("applies search, resets page and preserves period and other filters", () => {
    const current = new URLSearchParams(
      "year=2026&month=7&half=FIRST_HALF&page=4&completeness=complete&act_type=Compraventa&sort=instrument",
    );

    const result = applyNotarialNavigationChanges(current, {
      search: "Persona Uno",
    });

    expect(result.get("search")).toBe("Persona Uno");
    expect(result.has("page")).toBe(false);
    expect(result.get("year")).toBe("2026");
    expect(result.get("month")).toBe("7");
    expect(result.get("half")).toBe("FIRST_HALF");
    expect(result.get("completeness")).toBe("complete");
    expect(result.get("act_type")).toBe("Compraventa");
    expect(result.get("sort")).toBe("instrument");
  });

  it("removes search without clearing the selected period or filters", () => {
    const current = new URLSearchParams(
      "year=2026&month=7&half=SECOND_HALF&search=Persona&completeness=incomplete",
    );

    const result = applyNotarialNavigationChanges(current, { search: "" });

    expect(result.has("search")).toBe(false);
    expect(result.get("half")).toBe("SECOND_HALF");
    expect(result.get("completeness")).toBe("incomplete");
  });

  it("updates the fortnight and resets pagination", () => {
    const current = new URLSearchParams(
      "year=2026&month=7&half=FIRST_HALF&page=2&search=Persona",
    );

    const result = applyNotarialNavigationChanges(current, {
      selection: { year: 2027, month: 2, half: "SECOND_HALF" },
    });

    expect(result.get("year")).toBe("2027");
    expect(result.get("month")).toBe("2");
    expect(result.get("half")).toBe("SECOND_HALF");
    expect(result.get("search")).toBe("Persona");
    expect(result.has("page")).toBe(false);
  });
});
