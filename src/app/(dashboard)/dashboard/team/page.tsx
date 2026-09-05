import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

// "Mi equipo" se consolidó dentro de Despacho (menú de usuario → Despacho),
// ver `src/app/(dashboard)/dashboard/settings/_components/WorkspaceSection.tsx`.
// Esta ruta se conserva para no romper enlaces existentes; los componentes
// y server actions de este directorio siguen siendo la implementación real,
// solo importados desde ahí. Mismo gate que antes: sin `members.manage` no
// hay nada que gestionar aquí, así que se manda a /dashboard igual que el
// comportamiento previo (no a Despacho, que no mostraría equipo de todos
// modos, para no cambiar el destino observable de este chequeo de permisos).
export default async function TeamPage() {
  const { role } = await requireWorkspace();

  if (!hasPermission(role, "members.manage")) {
    redirect("/dashboard");
  }

  redirect("/dashboard/settings?tab=workspace");
}
