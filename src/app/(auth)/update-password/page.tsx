import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

// Cambio de contraseña de una sesión ordinaria. La acción exige además la
// contraseña actual; la recuperación vive completamente en /reset-password.
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 px-8 py-10 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Inicia sesión
          </h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Debes iniciar sesión para cambiar tu contraseña.
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

  return <UpdatePasswordForm />;
}
