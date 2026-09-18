import { z } from "zod";
import { INVITABLE_ROLES } from "@/lib/server/permissions";

export const InviteMemberSchema = z.object({
  email: z.email("Ingresa un correo electrónico válido"),
  role: z.enum(INVITABLE_ROLES, { error: "Selecciona un rol válido" }),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
