import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./SetPasswordForm";

// Paso final tras aceptar la invitación (confirm-actions.ts ya dejó la
// sesión activa y la membresía en 'active'). Server Component: igual que
// /update-password, verifica la sesión ANTES de mostrar el formulario.
export default async function SetInvitePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Enlace no válido o expirado
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Pide a quien te invitó que te envíe un nuevo enlace.
          </p>
          <p className="mt-6 text-sm text-slate-500">
            <Link
              href="/login"
              className="font-medium text-accent-600 hover:text-accent-700 focus:outline-none focus:underline"
            >
              Ir a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <SetPasswordForm />;
}
