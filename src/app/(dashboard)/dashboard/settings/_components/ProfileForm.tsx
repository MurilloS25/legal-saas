"use client";

import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "../actions";

export type LawyerProfileData = {
  full_name: string;
  professional_code: string | null;
  email: string | null;
  phone: string | null;
};

interface Props {
  initialData: LawyerProfileData | null;
}

const initialState: ProfileState = {};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50";

export function ProfileForm({ initialData }: Props) {
  const [state, formAction, pending] = useActionState(
    saveProfileAction,
    initialState,
  );

  return (
    <section aria-labelledby="profile-heading">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h2
            id="profile-heading"
            className="text-base font-semibold text-slate-900"
          >
            Perfil del abogado
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Información que se usará en los documentos generados.
          </p>
        </div>

        <div className="px-6 py-6">
          {state.success && (
            <div
              role="status"
              className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700"
            >
              {state.message}
            </div>
          )}

          {state.message && !state.success && !state.errors && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </div>
          )}

          <form action={formAction} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
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
                defaultValue={initialData?.full_name ?? ""}
                className={inputClass}
                placeholder="Lic. Ana García López"
                aria-describedby={
                  state.errors?.full_name ? "full_name-error" : undefined
                }
                aria-invalid={!!state.errors?.full_name}
              />
              {state.errors?.full_name && (
                <p
                  id="full_name-error"
                  role="alert"
                  className="mt-1.5 text-xs text-red-700"
                >
                  {state.errors.full_name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="professional_code"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Código profesional
              </label>
              <input
                id="professional_code"
                name="professional_code"
                type="text"
                defaultValue={initialData?.professional_code ?? ""}
                className={inputClass}
                placeholder="NP-1234"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-email"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Correo de contacto
                </label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={initialData?.email ?? ""}
                  className={inputClass}
                  placeholder="ana@despacho.com"
                  aria-describedby={
                    state.errors?.email ? "profile-email-error" : undefined
                  }
                  aria-invalid={!!state.errors?.email}
                />
                {state.errors?.email && (
                  <p
                    id="profile-email-error"
                    role="alert"
                    className="mt-1.5 text-xs text-red-700"
                  >
                    {state.errors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Teléfono
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={initialData?.phone ?? ""}
                  className={inputClass}
                  placeholder="8888-8888"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pending ? "Guardando…" : "Guardar perfil"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
