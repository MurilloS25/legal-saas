import { beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  role: "solo_lectura",
  from: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({
  requireWorkspace: async () => ({
    supabase: { from: auth.from },
    user: { id: "reader" },
    workspaceId: "workspace",
    role: auth.role,
  }),
}));
vi.mock("./parties-generation", () => ({
  generateConfiguredParties: vi.fn(),
}));

import { saveNotarialMetadataAction } from "./metadata-actions";

beforeEach(() => {
  auth.role = "solo_lectura";
  auth.from.mockReset();
});

it("rejects inline metadata writes without notarial management permission", async () => {
  const result = await saveNotarialMetadataAction(
    "00000000-0000-4000-8000-000000000001",
    {},
    new FormData(),
  );

  expect(result).toEqual({
    message: "No tienes permiso para editar los datos del Índice.",
  });
  expect(auth.from).not.toHaveBeenCalled();
});
