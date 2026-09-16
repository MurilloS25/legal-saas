"use client";

/**
 * Pestaña "Despacho": identidad profesional del notario/despacho
 * (`lawyer_profiles`, compartida por workspace) + equipo. El equipo se
 * embebe aquí en vez de vivir en `/dashboard/team` (esa ruta ahora
 * redirige aquí) — mismos componentes y acciones que existían, solo
 * consolidados en el menú de usuario en vez de un ítem de navegación
 * aparte. Sin cambios de permisos: el equipo solo se muestra si
 * `canManageMembers` (mismo gate que antes, `members.manage`).
 */

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "../actions";
import { FieldError } from "@/components/forms/FieldError";
import { SettingsActionsBar } from "./SettingsActionsBar";
import { useToast } from "@/components/feedback/Toast";
import { InviteMemberForm } from "@/app/(dashboard)/dashboard/team/InviteMemberForm";
import { TeamMembersTable } from "@/app/(dashboard)/dashboard/team/TeamMembersTable";
import { WorkspaceActivityList } from "@/app/(dashboard)/dashboard/team/WorkspaceActivityList";
import type { WorkspaceActivityEvent } from "@/app/(dashboard)/dashboard/team/activity-format";
import type { TeamMember } from "@/app/(dashboard)/dashboard/team/MemberRow";
import type { WorkspaceRole } from "@/lib/server/permissions";

export type LawyerProfileData = {
  full_name: string;
  professional_code: string | null;
  email: string | null;
  phone: string | null;
};

type FormValues = {
  full_name: string;
  professional_code: string;
  email: string;
  phone: string;
};

function buildValues(profile: LawyerProfileData | null): FormValues {
  return {
    full_name: profile?.full_name ?? "",
    professional_code: profile?.professional_code ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

const initialState: ProfileState = {};

type Props = {
  initialProfile: LawyerProfileData | null;
  canManage: boolean;
  team: {
    canManageMembers: boolean;
    members: TeamMember[];
    activity: WorkspaceActivityEvent[];
    callerUserId: string;
    callerRole: WorkspaceRole;
  } | null;
};

export function WorkspaceSection({ initialProfile, canManage, team }: Props) {
  const initialValues = buildValues(initialProfile);
  const savedRef = useRef<FormValues>(initialValues);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(saveProfileAction, initialState);

  const { showToast } = useToast();
  const lastHandled = useRef<ProfileState | null>(null);
  useEffect(() => {
    if (state.success && lastHandled.current !== state) {
      lastHandled.current = state;
      savedRef.current = values;
      setDirty(false);
      showToast(state.message ?? "Despacho actualizado.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function setField<K extends keyof FormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function handleDiscard() {
    setValues(savedRef.current);
    setDirty(false);
  }

  const errors = state.errors;

  return (
    <div className="space-y-4">
      <form action={formAction} noValidate className="space-y-4">
        {state.message && !state.success && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {state.message}
          </div>
        )}

        {!canManage && (
          <div
            role="status"
            className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600"
          >
            Solo el propietario o un administrador pueden editar esta
            información. La ves en modo lectura.
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">Perfil profesional</h2>
            <p className="text-xs text-slate-500">
              Información que se utilizará en los documentos generados.
            </p>
          </div>

          <div className="px-6 py-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className={labelClass}>
                Nombre completo{" "}
                <span aria-hidden="true" className="text-red-500">
                  *
                </span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                disabled={!canManage}
                value={values.full_name}
                onChange={(e) => setField("full_name", e.target.value)}
                className={inputClass}
                placeholder="Lic. Ana García López"
                aria-describedby={errors?.full_name ? "full_name-error" : undefined}
                aria-invalid={!!errors?.full_name}
              />
              <FieldError id="full_name-error" message={errors?.full_name} />
            </div>

            <div>
              <label htmlFor="professional_code" className={labelClass}>
                Código profesional
              </label>
              <input
                id="professional_code"
                name="professional_code"
                type="text"
                disabled={!canManage}
                value={values.professional_code}
                onChange={(e) => setField("professional_code", e.target.value)}
                className={inputClass}
                placeholder="NP-1234"
              />
            </div>

            <div>
              <label htmlFor="profile-email" className={labelClass}>
                Correo de contacto
              </label>
              <input
                id="profile-email"
                name="email"
                type="email"
                autoComplete="email"
                disabled={!canManage}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                className={inputClass}
                placeholder="ana@despacho.com"
                aria-describedby={errors?.email ? "profile-email-error" : undefined}
                aria-invalid={!!errors?.email}
              />
              <FieldError id="profile-email-error" message={errors?.email} />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>
                Teléfono
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                disabled={!canManage}
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className={inputClass}
                placeholder="8888-8888"
              />
            </div>
          </div>
        </section>

        {canManage && (
          <SettingsActionsBar dirty={dirty} pending={pending} onDiscard={handleDiscard} />
        )}
      </form>

      {team?.canManageMembers && (
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-semibold text-slate-900">Equipo</h2>
          <InviteMemberForm />
          <TeamMembersTable
            members={team.members}
            callerUserId={team.callerUserId}
            callerRole={team.callerRole}
          />
          <WorkspaceActivityList events={team.activity} />
        </div>
      )}
    </div>
  );
}
