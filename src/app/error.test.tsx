import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AppError from "./error";

describe("AppError", () => {
  it("renders safe recovery actions without exposing the internal error", () => {
    const markup = renderToStaticMarkup(
      <AppError
        error={new Error("22P02 sensitive database detail")}
        unstable_retry={vi.fn()}
      />,
    );

    expect(markup).toContain("Algo salió mal");
    expect(markup).toContain("Intentar de nuevo");
    expect(markup).toContain("Volver al panel");
    expect(markup).toContain('href="/dashboard"');
    expect(markup).not.toContain("22P02");
    expect(markup).not.toContain("sensitive database detail");
  });
});
