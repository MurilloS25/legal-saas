"use client";

/**
 * Contenedor de pestañas de Cuenta y configuración (Perfil/Configuración/
 * Despacho), accesible desde el menú de usuario del navbar. Mismo patrón
 * de navegación por `?tab=` que el resto de workspaces con pestañas
 * (ver DESIGN.md), pero con navegación lateral en vez de horizontal —
 * patrón aprobado en el prototipo para esta pantalla en particular.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { BuildingIcon, GearIcon, UsersIcon } from "@/app/(dashboard)/_components/icons";
import { ProfileSection } from "./ProfileSection";
import { DocumentSettingsSection, type DocumentSettingsData } from "./DocumentSettingsSection";
import { WorkspaceSection, type LawyerProfileData } from "./WorkspaceSection";
import type { TeamMember } from "@/app/(dashboard)/dashboard/team/MemberRow";
import type { WorkspaceActivityEvent } from "@/app/(dashboard)/dashboard/team/activity-format";
import type { WorkspaceRole } from "@/lib/server/permissions";

type Section = "profile" | "document" | "workspace";

const SECTIONS: { key: Section; label: string; description: string; Icon: typeof UsersIcon }[] = [
  { key: "profile", label: "Perfil", description: "Tu cuenta", Icon: UsersIcon },
  { key: "document", label: "Configuración", description: "Formato de los documentos", Icon: GearIcon },
  { key: "workspace", label: "Despacho", description: "Identidad profesional y equipo", Icon: BuildingIcon },
];

type Props = {
  userEmail: string | null;
  canManage: boolean;
  initialProfile: LawyerProfileData | null;
  initialSettings: DocumentSettingsData | null;
  team: {
    canManageMembers: boolean;
    members: TeamMember[];
    activity: WorkspaceActivityEvent[];
    callerUserId: string;
    callerRole: WorkspaceRole;
  } | null;
};

export function SettingsTabs({ userEmail, canManage, initialProfile, initialSettings, team }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const section: Section = requested === "document" || requested === "workspace" ? requested : "profile";

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav
        className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible"
        aria-label="Secciones de configuración"
      >
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => router.push(`/dashboard/settings?tab=${s.key}`)}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13px] font-medium transition-colors lg:w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                active ? "bg-accent-50 text-accent-800" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <s.Icon className="size-4 shrink-0" />
              <span>
                <span className="block">{s.label}</span>
                <span className={`hidden text-[11px] font-normal lg:block ${active ? "text-accent-700/70" : "text-slate-400"}`}>
                  {s.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {section === "profile" && <ProfileSection userEmail={userEmail} />}
        {section === "document" && (
          <DocumentSettingsSection initialSettings={initialSettings} canManage={canManage} />
        )}
        {section === "workspace" && (
          <WorkspaceSection initialProfile={initialProfile} canManage={canManage} team={team} />
        )}
      </div>
    </div>
  );
}
