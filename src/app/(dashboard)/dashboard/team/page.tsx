import { redirect } from "next/navigation";
import { getTeamRouteDestination } from "@/features/settings/server";

// "Mi equipo" se consolidó dentro de Despacho (menú de usuario → Despacho),
// ver `src/features/settings/components/WorkspaceSection.tsx`.
// Esta ruta se conserva para no romper enlaces existentes. Mismo gate que
// antes: sin `members.manage` no
// hay nada que gestionar aquí, así que se manda a /dashboard igual que el
// comportamiento previo (no a Despacho, que no mostraría equipo de todos
// modos, para no cambiar el destino observable de este chequeo de permisos).
export default async function TeamPage() {
  redirect(await getTeamRouteDestination());
}
